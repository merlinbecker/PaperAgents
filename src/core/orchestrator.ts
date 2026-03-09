import { AgentDefinition, Parameter, ToolCallInfo, WebSearchAnnotation, AgenticLoopConfig } from "../types";
import { ConversationManager } from "./conversation";
import { OpenRouterClient, LLMMessage, LLMToolDefinition, LLMToolCall, StreamCallbacks, OpenRouterConfig, ContentPart } from "./openrouter";
import ToolRegistry from "./tool-registry";
import { globalLogger } from "../utils/logger";
import { globalMetrics } from "../utils/metrics";
import { PREDEFINED_TOOL_IDS, randomId } from "../utils/constants";

const MAX_TOOL_CALL_ROUNDS = 10;

export interface OrchestratorConfig {
  openRouterConfig: OpenRouterConfig;
  maxToolCallRounds?: number;
}

export interface OrchestratorCallbacks {
  onToken?: (token: string) => void;
  onToolCallStart?: (toolId: string, params: Record<string, unknown>) => void;
  onToolCallEnd?: (toolId: string, result: unknown, error?: string) => void;
  onAnnotations?: (annotations: WebSearchAnnotation[]) => void;
  onComplete?: (content: string) => void;
  onError?: (error: Error) => void;
}

export interface AgenticLoopCallbacks extends OrchestratorCallbacks {
  onIterationStart?: (iteration: number, maxIterations: number) => void;
  onIterationEnd?: (iteration: number, done: boolean) => void | Promise<void>;
  onLoopComplete?: (iterations: number, finalContent: string) => void | Promise<void>;
  /** Called when the agent invokes ask_user(); resolves with the user's answer. */
  onHITLPause?: (question: string) => Promise<string>;
}

export class Orchestrator {
  private readonly client: OpenRouterClient;
  private readonly conversationManager: ConversationManager;
  private readonly toolRegistry: ToolRegistry;
  private readonly maxToolCallRounds: number;

  constructor(
    config: OrchestratorConfig,
    conversationManager: ConversationManager,
    toolRegistry: ToolRegistry
  ) {
    this.client = new OpenRouterClient(config.openRouterConfig);
    this.conversationManager = conversationManager;
    this.toolRegistry = toolRegistry;
    this.maxToolCallRounds = config.maxToolCallRounds || MAX_TOOL_CALL_ROUNDS;
  }

  updateConfig(config: Partial<OpenRouterConfig>): void {
    this.client.updateConfig(config);
  }

  async sendMessage(
    agent: AgentDefinition,
    conversationId: string,
    userMessage: string,
    callbacks?: OrchestratorCallbacks
  ): Promise<string> {
    this.conversationManager.addMessage(conversationId, "user", userMessage);
    return this.continueConversation(agent, conversationId, callbacks);
  }

  async continueConversation(
    agent: AgentDefinition,
    conversationId: string,
    callbacks?: OrchestratorCallbacks
  ): Promise<string> {
    const traceId = globalMetrics.generateTraceId();
    const span = globalMetrics.startTrace(traceId, "orchestrator.continueConversation", undefined, {
      agentId: agent.id,
      conversationId,
    });

    try {
      const tools = this.buildToolDefinitions(agent);
      const plugins = this.buildPluginList(agent);
      let round = 0;
      let finalContent = "";

      while (round < this.maxToolCallRounds) {
        round++;
        const { content, done } = await this.processChatRound(
          agent, conversationId, tools, plugins, callbacks, traceId, span.spanId
        );
        if (content !== null) finalContent = content;
        if (done) break;
      }

      callbacks?.onComplete?.(finalContent);
      globalMetrics.endTrace(span, "success");
      globalMetrics.recordExecution("orchestrator.continueConversation", Date.now() - span.startTime, true);

      return finalContent;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      globalLogger.error("Orchestrator error", { error: errorMsg, traceId });
      globalMetrics.endTrace(span, "error", { error: errorMsg });
      globalMetrics.recordExecution("orchestrator.continueConversation", Date.now() - span.startTime, false);

      this.conversationManager.addMessage(
        conversationId,
        "system",
        `Error: ${errorMsg}`
      );

      callbacks?.onError?.(error instanceof Error ? error : new Error(errorMsg));
      throw error;
    }
  }

  private async processChatRound(
    agent: AgentDefinition,
    conversationId: string,
    tools: LLMToolDefinition[],
    plugins: Array<{ id: string } & Record<string, unknown>>,
    callbacks: OrchestratorCallbacks | undefined,
    traceId: string,
    spanId: string
  ): Promise<{ content: string | null; done: boolean }> {
    const messages = this.buildLLMMessages(agent, conversationId);
    const streamCallbacks: StreamCallbacks = {
      onToken: callbacks?.onToken,
      onAnnotations: callbacks?.onAnnotations,
      onError: callbacks?.onError,
    };

    const response = await this.client.chatStream(messages, streamCallbacks, tools, agent.model, plugins, agent.transforms);
    const choice = response.choices[0];
    if (!choice) return { content: null, done: true };

    const assistantMessage = choice.message;
    const content = assistantMessage.content ?? null;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      this.conversationManager.addMessage(conversationId, "assistant", assistantMessage.content || "");
      for (const toolCall of assistantMessage.tool_calls) {
        await this.executeToolCall(conversationId, toolCall, callbacks, traceId, spanId);
      }
      return { content, done: false };
    }

    this.conversationManager.addMessage(conversationId, "assistant", assistantMessage.content || "");
    return { content, done: true };
  }

  private async executeToolCall(
    conversationId: string,
    toolCall: LLMToolCall,
    callbacks: OrchestratorCallbacks | undefined,
    traceId: string,
    parentSpanId: string
  ): Promise<void> {
    const toolName = toolCall.function.name;
    let params: Record<string, unknown> = {};

    try {
      params = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      globalLogger.warn("Failed to parse tool call arguments", {
        toolName,
        args: toolCall.function.arguments,
      });
    }

    const toolSpan = globalMetrics.startTrace(traceId, `tool.${toolName}`, parentSpanId, {
      toolName,
      params,
    });

    callbacks?.onToolCallStart?.(toolName, params);

    try {
      const tool = this.toolRegistry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const context = {
        parameters: params,
        previousStepOutputs: {},
        date: new Date().toISOString().split("T")[0] || "",
        time: new Date().toISOString().split("T")[1]?.split(".")[0] || "",
        randomId: randomId(8),
      };

      const result = await tool.execute(context);

      const toolCallInfo: ToolCallInfo = {
        toolId: toolName,
        parameters: params,
        result: result.data,
        error: result.error,
      };

      this.conversationManager.addMessage(
        conversationId,
        "tool",
        JSON.stringify(result.data || result.error || "No output"),
        toolCallInfo
      );

      callbacks?.onToolCallEnd?.(toolName, result.data, result.error);
      globalMetrics.endTrace(toolSpan, result.success ? "success" : "error");
      globalMetrics.recordExecution(`tool.${toolName}`, Date.now() - toolSpan.startTime, result.success);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      const toolCallInfo: ToolCallInfo = {
        toolId: toolName,
        parameters: params,
        error: errorMsg,
      };

      this.conversationManager.addMessage(
        conversationId,
        "tool",
        `Error executing ${toolName}: ${errorMsg}`,
        toolCallInfo
      );

      callbacks?.onToolCallEnd?.(toolName, undefined, errorMsg);
      globalMetrics.endTrace(toolSpan, "error", { error: errorMsg });
      globalMetrics.recordExecution(`tool.${toolName}`, Date.now() - toolSpan.startTime, false);
    }
  }

  /** Formats a tool call result as a plain-text assistant message (fallback). */
  private formatToolResultAsText(toolId: string, result: unknown, error: string | undefined): string {
    return `[Tool Call: ${toolId}]\nResult: ${JSON.stringify(result || error)}`;
  }

  private buildLLMMessages(agent: AgentDefinition, conversationId: string): LLMMessage[] {
    const contextMessages = this.conversationManager.getMessagesForContext(
      conversationId,
      agent.memory,
      agent.systemPrompt
    );

    const formatted: LLMMessage[] = [
      { role: "system", content: agent.systemPrompt },
    ];

    for (const msg of contextMessages) {
      if (msg.role === "tool" && msg.toolCall?.toolId === PREDEFINED_TOOL_IDS.READ_BINARY_FILE) {
        // Format binary file result as OpenRouter multimodal file content
        const result = msg.toolCall.result as { base64?: string; mimeType?: string; filePath?: string } | undefined | null;
        if (result?.base64 && result?.mimeType && result?.filePath) {
          const filename = result.filePath.split("/").pop() || result.filePath;
          const dataUrl = `data:${result.mimeType};base64,${result.base64}`;
          const content: ContentPart[] = [
            { type: "file", file: { filename, data: dataUrl } },
          ];
          formatted.push({ role: "user", content });
        } else {
          // Fallback to text if result data is incomplete
          formatted.push({
            role: "assistant",
            content: this.formatToolResultAsText(msg.toolCall.toolId, msg.toolCall.result, msg.toolCall.error),
          });
        }
      } else if (msg.role === "tool" && msg.toolCall) {
        formatted.push({
          role: "assistant",
          content: this.formatToolResultAsText(msg.toolCall.toolId, msg.toolCall.result, msg.toolCall.error),
        });
      } else {
        formatted.push({
          role: msg.role === "tool" ? "assistant" : msg.role as LLMMessage["role"],
          content: msg.content,
        });
      }
    }

    return formatted;
  }
  private buildToolParameterSchema(
    params: Parameter[]
  ): { properties: Record<string, { type: string; description?: string }>; required: string[] | undefined } {
    const properties: Record<string, { type: string; description?: string }> = {};
    const required: string[] = [];
    for (const param of params) {
      properties[param.name] = { type: param.type, description: param.description };
      if (param.required) required.push(param.name);
    }
    return { properties, required: required.length > 0 ? required : undefined };
  }

  private buildToolDefinitions(agent: AgentDefinition): LLMToolDefinition[] {
    const definitions: LLMToolDefinition[] = [];

    for (const toolId of agent.tools) {
      // websearch and file_parser are server-side plugins, not function tools
      if (toolId === PREDEFINED_TOOL_IDS.WEBSEARCH) continue;
      if (toolId === PREDEFINED_TOOL_IDS.FILE_PARSER) continue;

      const toolMeta = this.toolRegistry.listTools().find((t) => t.id === toolId);
      if (!toolMeta) continue;

      const { properties, required } = this.buildToolParameterSchema(toolMeta.parameters);

      definitions.push({
        type: "function",
        function: {
          name: toolId,
          description: toolMeta.description || toolMeta.name,
          parameters: { type: "object", properties, required },
        },
      });
    }

    return definitions;
  }

  private buildPluginList(agent: AgentDefinition): Array<{ id: string } & Record<string, unknown>> {
    const plugins: Array<{ id: string } & Record<string, unknown>> = [];
    if (agent.tools.includes(PREDEFINED_TOOL_IDS.WEBSEARCH)) {
      const plugin: { id: string } & Record<string, unknown> = { id: "web" };
      if (agent.websearchConfig?.maxResults !== undefined) {
        plugin["max_results"] = agent.websearchConfig.maxResults;
      }
      plugins.push(plugin);
    }
    if (agent.tools.includes(PREDEFINED_TOOL_IDS.FILE_PARSER)) {
      const plugin: { id: string } & Record<string, unknown> = { id: "file-parser" };
      if (agent.ocrConfig?.model) {
        plugin["model"] = agent.ocrConfig.model;
      }
      plugins.push(plugin);
    }
    return plugins;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.client.testConnection();
  }

  async runAgenticLoop(
    agent: AgentDefinition,
    conversationId: string,
    userMessage: string,
    callbacks?: AgenticLoopCallbacks
  ): Promise<string> {
    const loopConfig = agent.agenticLoop;
    if (!loopConfig?.enabled) {
      return this.sendMessage(agent, conversationId, userMessage, callbacks);
    }

    const augmentedAgent = this.augmentAgentForLoop(agent, loopConfig);
    this.conversationManager.addMessage(conversationId, "user", userMessage);

    let finalContent = "";
    let completedIterations = 0;

    for (let i = 1; i <= loopConfig.maxIterations; i++) {
      callbacks?.onIterationStart?.(i, loopConfig.maxIterations);

      if (loopConfig.iterationPrompt && i > 1) {
        this.conversationManager.addMessage(conversationId, "user", loopConfig.iterationPrompt);
      }

      const content = await this.continueConversation(augmentedAgent, conversationId, callbacks);
      finalContent = content;
      completedIterations = i;

      // Handle HITL pause: agent called ask_user()
      const askUserQuestion = this.getAskUserQuestion(conversationId);
      if (askUserQuestion !== null && callbacks?.onHITLPause) {
        const userAnswer = await callbacks.onHITLPause(askUserQuestion);
        if (userAnswer) {
          this.conversationManager.addMessage(conversationId, "user", userAnswer);
        }
        await callbacks?.onIterationEnd?.(i, false);
        continue;
      }

      const done = this.checkLoopTermination(content, loopConfig, conversationId);
      await callbacks?.onIterationEnd?.(i, done);

      if (done) break;
    }

    await callbacks?.onLoopComplete?.(completedIterations, finalContent);
    return finalContent;
  }

  private augmentAgentForLoop(agent: AgentDefinition, config: AgenticLoopConfig): AgentDefinition {
    const augmented = { ...agent };

    if (config.terminationCheck === "auto") {
      const doneInstruction =
        "\n\nWhen you have fully completed the assigned task, start your final response with `[DONE]`.";
      augmented.systemPrompt = agent.systemPrompt + doneInstruction;
    }

    // Inject finish_task when terminationCheck is "tool"
    if (config.terminationCheck === "tool") {
      if (!augmented.tools.includes(PREDEFINED_TOOL_IDS.FINISH_TASK)) {
        augmented.tools = [...augmented.tools, PREDEFINED_TOOL_IDS.FINISH_TASK];
      }
    }

    // Always inject ask_user so the agent can pause and request human input
    if (!augmented.tools.includes(PREDEFINED_TOOL_IDS.ASK_USER)) {
      augmented.tools = [...augmented.tools, PREDEFINED_TOOL_IDS.ASK_USER];
    }

    // Enable middle-out context-window compression via OpenRouter transforms.
    // This prevents context-overflow errors during long agentic loops by letting
    // OpenRouter automatically truncate middle messages when the prompt exceeds
    // the model's context limit, preserving the beginning (system + task) and
    // the most recent messages.
    augmented.transforms = ["middle-out"];

    return augmented;
  }

  private checkLoopTermination(content: string, config: AgenticLoopConfig, conversationId: string): boolean {
    switch (config.terminationCheck) {
      case "auto":
        return content.trimStart().startsWith("[DONE]");
      case "phrase":
        return config.terminationPhrase ? content.includes(config.terminationPhrase) : false;
      case "tool":
        return this.hasFinishTaskCall(conversationId);
    }
  }

  private hasFinishTaskCall(conversationId: string): boolean {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) return false;
    const messages = conversation.messages;
    // Search backward. Stop when a second assistant message is encountered (i.e. from a
    // prior iteration), so we only check tool calls made in the most recent iteration.
    let seenAssistant = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role === "tool" && msg.toolCall?.toolId === PREDEFINED_TOOL_IDS.FINISH_TASK) {
        return true;
      }
      if (msg.role === "assistant") {
        if (seenAssistant) break;
        seenAssistant = true;
      }
    }
    return false;
  }

  /**
   * Returns the question string from the most recent ask_user tool call in the
   * current iteration, or null if no such call was found.
   */
  private getAskUserQuestion(conversationId: string): string | null {
    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) return null;
    const messages = conversation.messages;
    let seenAssistant = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      if (msg.role === "tool" && msg.toolCall?.toolId === PREDEFINED_TOOL_IDS.ASK_USER) {
        const question = msg.toolCall.parameters["question"];
        return typeof question === "string" ? question : null;
      }
      if (msg.role === "assistant") {
        if (seenAssistant) break;
        seenAssistant = true;
      }
    }
    return null;
  }
}

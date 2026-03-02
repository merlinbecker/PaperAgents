import { AgentDefinition, ToolCallInfo } from "../types";
import { ConversationManager } from "./conversation";
import { OpenRouterClient, LLMMessage, LLMToolDefinition, LLMToolCall, StreamCallbacks, OpenRouterConfig } from "./openrouter";
import ToolRegistry from "./tool-registry";
import { globalLogger } from "../utils/logger";
import { globalMetrics } from "../utils/metrics";
import { PREDEFINED_TOOL_IDS } from "../utils/constants";

const MAX_TOOL_CALL_ROUNDS = 10;

export interface OrchestratorConfig {
  openRouterConfig: OpenRouterConfig;
  maxToolCallRounds?: number;
}

export interface OrchestratorCallbacks {
  onToken?: (token: string) => void;
  onToolCallStart?: (toolId: string, params: Record<string, unknown>) => void;
  onToolCallEnd?: (toolId: string, result: unknown, error?: string) => void;
  onComplete?: (content: string) => void;
  onError?: (error: Error) => void;
}

export class Orchestrator {
  private client: OpenRouterClient;
  private conversationManager: ConversationManager;
  private toolRegistry: ToolRegistry;
  private maxToolCallRounds: number;

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

        const messages = this.buildLLMMessages(agent, conversationId);

        const streamCallbacks: StreamCallbacks = {
          onToken: callbacks?.onToken,
          onError: callbacks?.onError,
        };

        const response = await this.client.chatStream(messages, streamCallbacks, tools, agent.model, plugins);

        const choice = response.choices[0];
        if (!choice) break;

        const assistantMessage = choice.message;

        if (assistantMessage.content) {
          finalContent = assistantMessage.content;
        }

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          this.conversationManager.addMessage(
            conversationId,
            "assistant",
            assistantMessage.content || ""
          );

          for (const toolCall of assistantMessage.tool_calls) {
            await this.executeToolCall(
              conversationId,
              toolCall,
              callbacks,
              traceId,
              span.spanId
            );
          }

          continue;
        }

        this.conversationManager.addMessage(
          conversationId,
          "assistant",
          assistantMessage.content || ""
        );

        break;
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
        randomId: Math.random().toString(36).substring(7) || "",
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

  private buildLLMMessages(agent: AgentDefinition, conversationId: string): LLMMessage[] {
    const contextMessages = this.conversationManager.getMessagesForContext(
      conversationId,
      agent.memory,
      agent.systemPrompt
    );

    return this.conversationManager
      .formatMessagesForLLM(contextMessages, agent.systemPrompt)
      .map((msg) => ({
        role: msg.role as LLMMessage["role"],
        content: msg.content,
      }));
  }

  private buildToolDefinitions(agent: AgentDefinition): LLMToolDefinition[] {
    const definitions: LLMToolDefinition[] = [];

    for (const toolId of agent.tools) {
      // websearch is a server-side plugin, not a function tool
      if (toolId === PREDEFINED_TOOL_IDS.WEBSEARCH) continue;

      const toolMeta = this.toolRegistry.listTools().find((t) => t.id === toolId);
      if (!toolMeta) continue;

      const properties: Record<string, { type: string; description?: string }> = {};
      const required: string[] = [];

      for (const param of toolMeta.parameters) {
        properties[param.name] = {
          type: param.type === "array" ? "array" : param.type === "object" ? "object" : param.type,
          description: param.description,
        };
        if (param.required) {
          required.push(param.name);
        }
      }

      definitions.push({
        type: "function",
        function: {
          name: toolId,
          description: toolMeta.description || toolMeta.name,
          parameters: {
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
          },
        },
      });
    }

    return definitions;
  }

  private buildPluginList(agent: AgentDefinition): string[] {
    const plugins: string[] = [];
    if (agent.tools.includes(PREDEFINED_TOOL_IDS.WEBSEARCH)) {
      plugins.push("web-search");
    }
    return plugins;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return this.client.testConnection();
  }
}

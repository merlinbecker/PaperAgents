import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));

import { Orchestrator } from "../../../src/core/orchestrator";
import { ConversationManager } from "../../../src/core/conversation";
import ToolRegistry from "../../../src/core/tool-registry";
import { AgentDefinition } from "../../../src/types";
import { requestUrl } from "obsidian";
import { FinishTaskFactory, AskUserFactory } from "../../../src/tools/predefined";
import { PREDEFINED_TOOL_IDS } from "../../../src/utils/constants";

const mockRequestUrl = vi.mocked(requestUrl);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeAgent = (): AgentDefinition => ({
  id: "test-agent",
  name: "Test Agent",
  systemPrompt: "You are a helpful assistant.",
  tools: [],
  memory: { type: "conversation", maxMessages: 50 },
});

const makeOrchestratorConfig = () => ({
  openRouterConfig: {
    apiKey: "test-key",
    model: "openai/gpt-4",
    temperature: 0.7,
    maxTokens: 1024,
  },
  maxToolCallRounds: 5,
});

/** Build a mock SSE streaming response. Accepts one or more content strings. */
function makeStreamResponse(content: string | string[]): object {
  const chunks = Array.isArray(content) ? content : [content];
  const lines = chunks.map(
    (c) => `data: {"id":"gen","choices":[{"index":0,"delta":{"content":"${c}"},"finish_reason":null}]}`
  );
  lines.push(`data: {"id":"gen","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`, "data: [DONE]");
  return { status: 200, text: lines.join("\n") };
}

/** Build a mock SSE response that contains a single tool call followed by finish. */
function makeToolCallStreamResponse(toolName: string, args: Record<string, unknown>): object {
  const argsStr = JSON.stringify(args).replaceAll('"', String.raw`\"`);
  const lines = [
    `data: {"id":"gen","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call1","type":"function","function":{"name":"${toolName}","arguments":""}}]},"finish_reason":null}]}`,
    `data: {"id":"gen","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"${argsStr}"}}]},"finish_reason":null}]}`,
    `data: {"id":"gen","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`,
    "data: [DONE]",
  ];
  return { status: 200, text: lines.join("\n") };
}

/** Extract the parsed JSON body from the first requestUrl call. */
function getRequestBody(): Record<string, unknown> {
  const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
  return JSON.parse(call.body as string) as Record<string, unknown>;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;
  let conversationManager: ConversationManager;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    conversationManager = new ConversationManager();
    toolRegistry = new ToolRegistry();
    toolRegistry.registerPredefined(FinishTaskFactory);
    toolRegistry.registerPredefined(AskUserFactory);
    orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Core messaging ───────────────────────────────────────────────────────────

  it("sends a message and returns assistant response", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse(["Hello", " there!"]) as never);

    const agent = makeAgent();
    const convId = "conv-1";
    conversationManager.createConversation(convId, agent.id);

    const result = await orchestrator.sendMessage(agent, convId, "Hello");
    expect(result).toBe("Hello there!");
  });

  it("calls onToken callback during streaming", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Hi") as never);

    const agent = makeAgent();
    const convId = "conv-2";
    conversationManager.createConversation(convId, agent.id);

    const tokens: string[] = [];
    await orchestrator.sendMessage(agent, convId, "Test", { onToken: (t) => tokens.push(t) });

    expect(tokens.length).toBeGreaterThan(0);
  });

  it("calls onError callback on failure", async () => {
    mockRequestUrl.mockRejectedValueOnce(new Error("API down"));

    const agent = makeAgent();
    const convId = "conv-3";
    conversationManager.createConversation(convId, agent.id);

    let errorReceived: Error | null = null;
    await expect(
      orchestrator.sendMessage(agent, convId, "Test", { onError: (e) => { errorReceived = e; } })
    ).rejects.toThrow();

    expect(errorReceived).not.toBeNull();
  });

  it("continueConversation sends existing history without adding a user message", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse(["Continuing", " response"]) as never);

    const agent = makeAgent();
    const convId = "conv-continue";
    conversationManager.createConversation(agent.id, convId);
    conversationManager.addMessage(convId, "user", "Previous message");

    const messagesBefore = conversationManager.getMessages(convId).length;
    const result = await orchestrator.continueConversation(agent, convId, {});

    expect(result).toBe("Continuing response");
    const messagesAfter = conversationManager.getMessages(convId);
    expect(messagesAfter.length).toBe(messagesBefore + 1);
    expect(messagesAfter[messagesAfter.length - 1]?.role).toBe("assistant");
  });

  // ── Client delegation ────────────────────────────────────────────────────────

  it("testConnection delegates to client", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: { data: [{ id: "openai/gpt-4" }] },
    } as never);

    const result = await orchestrator.testConnection();
    expect(result.success).toBe(true);
  });

  it("updateConfig updates the client config", () => {
    orchestrator.updateConfig({ model: "new-model" });
  });

  // ── Model selection ──────────────────────────────────────────────────────────

  it("uses agent model when specified in agent definition", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("OK") as never);

    const agent = { ...makeAgent(), model: "anthropic/claude-3-opus" };
    const convId = "conv-model";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");
    expect(getRequestBody().model).toBe("anthropic/claude-3-opus");
  });

  it("uses client default model when agent has no model specified", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("OK") as never);

    const agent = makeAgent();
    const convId = "conv-default-model";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");
    expect(getRequestBody().model).toBe("openai/gpt-4");
  });

  // ── WebSearch plugin ─────────────────────────────────────────────────────────

  it("passes plugins array when agent uses websearch tool", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Search result") as never);

    const agent = { ...makeAgent(), tools: ["websearch"] };
    const convId = "conv-websearch";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Search the web");
    expect(getRequestBody().plugins).toEqual([{ id: "web" }]);
  });

  it("includes max_results when websearchConfig is set on agent", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Done") as never);

    const agent = { ...makeAgent(), tools: ["websearch"], websearchConfig: { maxResults: 5 } };
    const convId = "conv-websearch-mr";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Search");
    expect(getRequestBody().plugins).toEqual([{ id: "web", max_results: 5 }]);
  });

  it("does not include websearch as a function tool definition", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Done") as never);

    const agent = { ...makeAgent(), tools: ["websearch"] };
    const convId = "conv-websearch-notools";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");
    // tools array should be absent since websearch is a plugin, not a function tool
    expect(getRequestBody().tools).toBeUndefined();
  });

  it("does not include plugins when agent has no websearch tool", async () => {
    mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("OK") as never);

    const agent = makeAgent();
    const convId = "conv-no-websearch";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");
    expect(getRequestBody().plugins).toBeUndefined();
  });

  // ── Agentic Loop ─────────────────────────────────────────────────────────────

  describe("runAgenticLoop", () => {
    it("falls back to sendMessage when agenticLoop is not enabled", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Normal reply") as never);

      const agent = makeAgent(); // no agenticLoop
      const convId = "loop-fallback";
      conversationManager.createConversation(convId, agent.id);

      const result = await orchestrator.runAgenticLoop(agent, convId, "Hi");
      expect(result).toBe("Normal reply");
    });

    it("runs a single iteration and stops on [DONE] signal", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("[DONE] Task complete.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 5, terminationCheck: "auto", showProgress: true },
      };
      const convId = "loop-done";
      conversationManager.createConversation(convId, agent.id);

      const iterationEndCalls: Array<{ i: number; done: boolean }> = [];
      const result = await orchestrator.runAgenticLoop(agent, convId, "Research topic X", {
        onIterationEnd: (i, done) => iterationEndCalls.push({ i, done }),
      });

      expect(result).toContain("[DONE]");
      expect(iterationEndCalls).toHaveLength(1);
      expect(iterationEndCalls[0]?.done).toBe(true);
    });

    it("runs multiple iterations until max when [DONE] never appears", async () => {
      mockRequestUrl
        .mockResolvedValueOnce(makeStreamResponse("Step 1 done.") as never)
        .mockResolvedValueOnce(makeStreamResponse("Step 2 done.") as never)
        .mockResolvedValueOnce(makeStreamResponse("Step 3 done.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 3, terminationCheck: "auto", showProgress: true },
      };
      const convId = "loop-max";
      conversationManager.createConversation(convId, agent.id);

      const starts: number[] = [];
      await orchestrator.runAgenticLoop(agent, convId, "Never finishes", {
        onIterationStart: (i) => starts.push(i),
      });

      expect(starts).toEqual([1, 2, 3]);
    });

    it("stops on custom phrase when terminationCheck is phrase", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Work done. FERTIG") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: {
          enabled: true,
          maxIterations: 5,
          terminationCheck: "phrase",
          terminationPhrase: "FERTIG",
          showProgress: true,
        },
      };
      const convId = "loop-phrase";
      conversationManager.createConversation(convId, agent.id);

      const ends: boolean[] = [];
      await orchestrator.runAgenticLoop(agent, convId, "Task", {
        onIterationEnd: (_, done) => ends.push(done),
      });

      expect(ends[0]).toBe(true);
    });

    it("calls onLoopComplete with correct iteration count", async () => {
      mockRequestUrl
        .mockResolvedValueOnce(makeStreamResponse("Not done yet") as never)
        .mockResolvedValueOnce(makeStreamResponse("[DONE] Finished") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 10, terminationCheck: "auto", showProgress: true },
      };
      const convId = "loop-complete";
      conversationManager.createConversation(convId, agent.id);

      let completedIter = -1;
      await orchestrator.runAgenticLoop(agent, convId, "Task", {
        onLoopComplete: (iterations) => { completedIter = iterations; },
      });

      expect(completedIter).toBe(2);
    });

    it("injects finish_task into agent tools when terminationCheck is tool", async () => {
      // First call: tool call to finish_task; second call: final text after tool result
      mockRequestUrl
        .mockResolvedValueOnce(makeToolCallStreamResponse("finish_task", { summary: "Done!" }) as never)
        .mockResolvedValueOnce(makeStreamResponse("Task finished.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 5, terminationCheck: "tool" },
      };
      const convId = "loop-tool-inject";
      conversationManager.createConversation(agent.id, convId);

      await orchestrator.runAgenticLoop(agent, convId, "Do the task");

      // The first request body should contain finish_task in tools
      const body = getRequestBody();
      const tools = body.tools as Array<{ function: { name: string } }>;
      expect(tools).toBeDefined();
      expect(tools.some((t) => t.function.name === PREDEFINED_TOOL_IDS.FINISH_TASK)).toBe(true);
    });

    it("terminates loop when finish_task tool is called", async () => {
      // First iteration: LLM calls finish_task, then returns final text
      mockRequestUrl
        .mockResolvedValueOnce(makeToolCallStreamResponse("finish_task", { summary: "All done!" }) as never)
        .mockResolvedValueOnce(makeStreamResponse("Here is your summary.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 5, terminationCheck: "tool" },
      };
      const convId = "loop-tool-term";
      conversationManager.createConversation(agent.id, convId);

      const ends: boolean[] = [];
      await orchestrator.runAgenticLoop(agent, convId, "Finish the task", {
        onIterationEnd: (_, done) => ends.push(done),
      });

      // Loop should terminate after 1 iteration because finish_task was called
      expect(ends).toHaveLength(1);
      expect(ends[0]).toBe(true);
    });

    it("injects ask_user tool for every agentic loop run", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("[DONE] Done.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 3, terminationCheck: "auto" },
      };
      const convId = "loop-ask-user-inject";
      conversationManager.createConversation(agent.id, convId);

      await orchestrator.runAgenticLoop(agent, convId, "Do something");

      const body = getRequestBody();
      const tools = body.tools as Array<{ function: { name: string } }>;
      expect(tools).toBeDefined();
      expect(tools.some((t) => t.function.name === PREDEFINED_TOOL_IDS.ASK_USER)).toBe(true);
    });

    it("sends transforms: [middle-out] in agentic loop requests", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("[DONE] Done.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 3, terminationCheck: "auto" },
      };
      const convId = "loop-transforms";
      conversationManager.createConversation(agent.id, convId);

      await orchestrator.runAgenticLoop(agent, convId, "Do something");

      const body = getRequestBody();
      expect(body.transforms).toEqual(["middle-out"]);
    });

    it("does not send transforms in regular sendMessage calls", async () => {
      mockRequestUrl.mockResolvedValueOnce(makeStreamResponse("Hello!") as never);

      const agent = makeAgent(); // no agenticLoop
      const convId = "regular-no-transforms";
      conversationManager.createConversation(agent.id, convId);

      await orchestrator.sendMessage(agent, convId, "Hello");

      const body = getRequestBody();
      expect(body.transforms).toBeUndefined();
    });

    it("pauses and resumes loop when ask_user is called", async () => {
      // Iteration 1: agent calls ask_user("What is your name?")
      // Iteration 2 (after user answer): agent responds with [DONE]
      mockRequestUrl
        .mockResolvedValueOnce(makeToolCallStreamResponse("ask_user", { question: "What is your name?" }) as never)
        .mockResolvedValueOnce(makeStreamResponse("Noted.") as never) // tool result reply
        .mockResolvedValueOnce(makeStreamResponse("[DONE] Done.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 5, terminationCheck: "auto" },
      };
      const convId = "loop-hitl-pause";
      conversationManager.createConversation(agent.id, convId);

      const pausedQuestions: string[] = [];
      const iterationEnds: Array<{ i: number; done: boolean }> = [];

      await orchestrator.runAgenticLoop(agent, convId, "Research for me", {
        onHITLPause: async (question) => {
          pausedQuestions.push(question);
          return "Alice";
        },
        onIterationEnd: (i, done) => iterationEnds.push({ i, done }),
      });

      // onHITLPause should have been called with the question
      expect(pausedQuestions).toEqual(["What is your name?"]);
      // Iteration 1 ends with done=false (HITL pause), iteration 2 ends with done=true
      expect(iterationEnds.some((e) => !e.done)).toBe(true);
      expect(iterationEnds.some((e) => e.done)).toBe(true);

      // User's answer should have been added to the conversation
      const messages = conversationManager.getMessages(convId);
      const userAnswerMsg = messages.find((m) => m.role === "user" && m.content === "Alice");
      expect(userAnswerMsg).toBeDefined();
    });

    it("awaits async onIterationEnd callbacks so persistence runs before next iteration", async () => {
      mockRequestUrl
        .mockResolvedValueOnce(makeStreamResponse("Step 1 done.") as never)
        .mockResolvedValueOnce(makeStreamResponse("[DONE] All done.") as never);

      const agent: AgentDefinition = {
        ...makeAgent(),
        agenticLoop: { enabled: true, maxIterations: 5, terminationCheck: "auto", showProgress: true },
      };
      const convId = "loop-async-iteration-end";
      conversationManager.createConversation(agent.id, convId);

      const order: string[] = [];
      await orchestrator.runAgenticLoop(agent, convId, "Do work", {
        onIterationStart: (i) => order.push(`start:${i}`),
        onIterationEnd: async (i, done) => {
          // Simulate async save (e.g., writing to vault)
          await Promise.resolve();
          order.push(`saved:${i}:${done}`);
        },
      });

      // Each "saved" entry must appear before the next "start" entry
      expect(order[0]).toBe("start:1");
      expect(order[1]).toBe("saved:1:false");
      expect(order[2]).toBe("start:2");
      expect(order[3]).toBe("saved:2:true");
    });
  });
});

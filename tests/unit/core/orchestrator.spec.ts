import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));

import { Orchestrator } from "../../../src/core/orchestrator";
import { ConversationManager } from "../../../src/core/conversation";
import ToolRegistry from "../../../src/core/tool-registry";
import { AgentDefinition } from "../../../src/types";
import { requestUrl } from "obsidian";

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
  });
});

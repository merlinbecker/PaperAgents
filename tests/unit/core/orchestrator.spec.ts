import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => {
  return {
    requestUrl: vi.fn(),
  };
});

import { Orchestrator } from "../../../src/core/orchestrator";
import { ConversationManager } from "../../../src/core/conversation";
import ToolRegistry from "../../../src/core/tool-registry";
import { AgentDefinition } from "../../../src/types";
import { requestUrl } from "obsidian";

const mockRequestUrl = vi.mocked(requestUrl);

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

describe("Orchestrator", () => {
  let conversationManager: ConversationManager;
  let toolRegistry: ToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    conversationManager = new ConversationManager();
    toolRegistry = new ToolRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a message and returns assistant response", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-1","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}',
        'data: {"id":"gen-1","choices":[{"index":0,"delta":{"content":" there!"},"finish_reason":null}]}',
        'data: {"id":"gen-1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent();

    const convId = "conv-1";
    conversationManager.createConversation(convId, agent.id);

    const result = await orchestrator.sendMessage(agent, convId, "Hello");
    expect(result).toBe("Hello there!");
  });

  it("calls onToken callback during streaming", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-1","choices":[{"index":0,"delta":{"role":"assistant","content":"Hi"},"finish_reason":null}]}',
        'data: {"id":"gen-1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent();
    const convId = "conv-2";
    conversationManager.createConversation(convId, agent.id);

    const tokens: string[] = [];
    await orchestrator.sendMessage(agent, convId, "Test", {
      onToken: (t) => tokens.push(t),
    });

    expect(tokens.length).toBeGreaterThan(0);
  });

  it("calls onError callback on failure", async () => {
    mockRequestUrl.mockRejectedValueOnce(new Error("API down"));

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent();
    const convId = "conv-3";
    conversationManager.createConversation(convId, agent.id);

    let errorReceived: Error | null = null;
    await expect(
      orchestrator.sendMessage(agent, convId, "Test", {
        onError: (e) => { errorReceived = e; },
      })
    ).rejects.toThrow();

    expect(errorReceived).not.toBeNull();
  });

  it("testConnection delegates to client", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: { data: [{ id: "openai/gpt-4" }] },
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const result = await orchestrator.testConnection();
    expect(result.success).toBe(true);
  });

  it("updateConfig updates the client config", () => {
    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    orchestrator.updateConfig({ model: "new-model" });
  });

  it("continueConversation sends existing history without adding a user message", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-2","choices":[{"index":0,"delta":{"role":"assistant","content":"Continuing"},"finish_reason":null}]}',
        'data: {"id":"gen-2","choices":[{"index":0,"delta":{"content":" response"},"finish_reason":null}]}',
        'data: {"id":"gen-2","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent();
    const convId = "conv-continue";
    // agentId first, then custom id
    conversationManager.createConversation(agent.id, convId);
    conversationManager.addMessage(convId, "user", "Previous message");

    const messagesBefore = conversationManager.getMessages(convId).length;
    const result = await orchestrator.continueConversation(agent, convId, {});

    expect(result).toBe("Continuing response");
    // Only the assistant reply was added, not a new user message
    const messagesAfter = conversationManager.getMessages(convId);
    expect(messagesAfter.length).toBe(messagesBefore + 1);
    expect(messagesAfter[messagesAfter.length - 1]?.role).toBe("assistant");
  });

  it("uses agent model when specified in agent definition", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-5","choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}',
        'data: {"id":"gen-5","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = { ...makeAgent(), model: "anthropic/claude-3-opus" };
    const convId = "conv-model";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.model).toBe("anthropic/claude-3-opus");
  });

  it("uses client default model when agent has no model specified", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-6","choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}',
        'data: {"id":"gen-6","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent(); // no model set
    const convId = "conv-default-model";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.model).toBe("openai/gpt-4"); // from makeOrchestratorConfig
  });

  it("passes plugins array when agent uses websearch tool", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-ws","choices":[{"index":0,"delta":{"role":"assistant","content":"Search result"},"finish_reason":null}]}',
        'data: {"id":"gen-ws","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = { ...makeAgent(), tools: ["websearch"] };
    const convId = "conv-websearch";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Search the web");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.plugins).toEqual([{ id: "web-search" }]);
  });

  it("includes max_results when websearchConfig is set on agent", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-ws-mr","choices":[{"index":0,"delta":{"role":"assistant","content":"Done"},"finish_reason":null}]}',
        'data: {"id":"gen-ws-mr","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = { ...makeAgent(), tools: ["websearch"], websearchConfig: { maxResults: 5 } };
    const convId = "conv-websearch-mr";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Search");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.plugins).toEqual([{ id: "web-search", max_results: 5 }]);
  });

  it("does not include websearch as a function tool definition", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-ws2","choices":[{"index":0,"delta":{"role":"assistant","content":"Done"},"finish_reason":null}]}',
        'data: {"id":"gen-ws2","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = { ...makeAgent(), tools: ["websearch"] };
    const convId = "conv-websearch-notools";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    // tools array should be absent since websearch is a plugin, not a function tool
    expect(body.tools).toBeUndefined();
  });

  it("does not include plugins when agent has no websearch tool", async () => {
    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      text: [
        'data: {"id":"gen-nows","choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}',
        'data: {"id":"gen-nows","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
      ].join("\n"),
    } as never);

    const orchestrator = new Orchestrator(makeOrchestratorConfig(), conversationManager, toolRegistry);
    const agent = makeAgent(); // no tools
    const convId = "conv-no-websearch";
    conversationManager.createConversation(convId, agent.id);

    await orchestrator.sendMessage(agent, convId, "Test");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.plugins).toBeUndefined();
  });

});

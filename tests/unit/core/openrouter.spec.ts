import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("obsidian", () => {
  return {
    requestUrl: vi.fn(),
  };
});

import { OpenRouterClient, OpenRouterError } from "../../../src/core/openrouter";
import { requestUrl } from "obsidian";

const mockRequestUrl = vi.mocked(requestUrl);

const makeClient = (overrides?: Record<string, unknown>) =>
  new OpenRouterClient({
    apiKey: "test-key",
    model: "openai/gpt-4",
    temperature: 0.7,
    maxTokens: 1024,
    ...overrides,
  });

describe("OpenRouterClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs with config and exposes it via getConfig", () => {
    const client = makeClient();
    const cfg = client.getConfig();
    expect(cfg.apiKey).toBe("test-key");
    expect(cfg.model).toBe("openai/gpt-4");
    expect(cfg.temperature).toBe(0.7);
    expect(cfg.maxTokens).toBe(1024);
  });

  it("updateConfig merges partial config", () => {
    const client = makeClient();
    client.updateConfig({ model: "anthropic/claude-3", temperature: 0.5 });
    const cfg = client.getConfig();
    expect(cfg.model).toBe("anthropic/claude-3");
    expect(cfg.temperature).toBe(0.5);
    expect(cfg.apiKey).toBe("test-key");
  });

  it("chat sends correct request and returns response", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: {
        id: "gen-123",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
        model: "openai/gpt-4",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    } as never);

    const response = await client.chat([
      { role: "user", content: "Hi" },
    ]);

    expect(response.choices[0]?.message.content).toBe("Hello!");
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call.method).toBe("POST");

    const headers = call.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("chat with tools includes tools in request body", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: {
        id: "gen-456",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "tc-1",
                  type: "function",
                  function: { name: "read_file", arguments: '{"path":"test.md"}' },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        model: "openai/gpt-4",
      },
    } as never);

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "read_file",
          description: "Read a file",
          parameters: {
            type: "object" as const,
            properties: { path: { type: "string", description: "File path" } },
            required: ["path"],
          },
        },
      },
    ];

    const response = await client.chat(
      [{ role: "user", content: "Read test.md" }],
      tools
    );

    expect(response.choices[0]?.message.tool_calls).toHaveLength(1);
    expect(response.choices[0]?.message.tool_calls?.[0]?.function.name).toBe("read_file");

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string);
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toBe("auto");
  });

  it("retries on 429 status", async () => {
    const client = makeClient();

    mockRequestUrl
      .mockResolvedValueOnce({ status: 429, json: { error: { message: "Rate limited" } } } as never)
      .mockResolvedValueOnce({
        status: 200,
        json: {
          id: "gen-789",
          choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
          model: "openai/gpt-4",
        },
      } as never);

    vi.useFakeTimers();
    const chatPromise = client.chat([{ role: "user", content: "test" }]);
    await vi.runAllTimersAsync();
    const result = await chatPromise;
    vi.useRealTimers();

    expect(result.choices[0]?.message.content).toBe("OK");
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });

  it("throws OpenRouterError on non-retryable failure", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 401,
      json: { error: { message: "Unauthorized" } },
    } as never);

    await expect(
      client.chat([{ role: "user", content: "test" }])
    ).rejects.toThrow(OpenRouterError);
  });

  it("testConnection succeeds with valid key", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: { data: [{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }] },
    } as never);

    const result = await client.testConnection();
    expect(result.success).toBe(true);
    expect(result.models).toBeDefined();
  });

  it("testConnection fails with invalid key", async () => {
    const client = makeClient();

    mockRequestUrl.mockRejectedValueOnce(new Error("Network error"));

    const result = await client.testConnection();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("includes referer header when configured", async () => {
    const client = makeClient({ referer: "https://example.com" });

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: {
        id: "gen-ref",
        choices: [{ index: 0, message: { role: "assistant", content: "Hi" }, finish_reason: "stop" }],
        model: "openai/gpt-4",
      },
    } as never);

    await client.chat([{ role: "user", content: "test" }]);

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const headers = call.headers as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBe("https://example.com");
  });

  it("includes plugins in request body when plugins are provided", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: {
        id: "gen-plugin",
        choices: [{ index: 0, message: { role: "assistant", content: "Result" }, finish_reason: "stop" }],
        model: "openai/gpt-4",
      },
    } as never);

    await client.chat([{ role: "user", content: "Search the web" }], undefined, ["web-search"]);

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.plugins).toEqual([{ id: "web-search" }]);
  });

  it("does not include plugins field when no plugins provided", async () => {
    const client = makeClient();

    mockRequestUrl.mockResolvedValueOnce({
      status: 200,
      json: {
        id: "gen-noplugin",
        choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
        model: "openai/gpt-4",
      },
    } as never);

    await client.chat([{ role: "user", content: "Hello" }]);

    const call = mockRequestUrl.mock.calls[0]?.[0] as Record<string, unknown>;
    const body = JSON.parse(call.body as string) as Record<string, unknown>;
    expect(body.plugins).toBeUndefined();
  });
});

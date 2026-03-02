import { requestUrl, RequestUrlParam } from "obsidian";
import { globalLogger } from "../utils/logger";

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  referer?: string;
  title?: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface OpenRouterResponse {
  id: string;
  choices: {
    index: number;
    message: LLMMessage;
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface StreamChunk {
  id: string;
  choices: {
    index: number;
    delta: Partial<LLMMessage> & {
      tool_calls?: (Partial<LLMToolCall> & { index?: number })[];
    };
    finish_reason: string | null;
  }[];
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: LLMToolCall) => void;
  onComplete?: (response: OpenRouterResponse) => void;
  onError?: (error: Error) => void;
}

export class OpenRouterError extends Error {
  statusCode: number;
  retryable: boolean;

  constructor(message: string, statusCode: number, retryable: boolean) {
    super(message);
    this.name = "OpenRouterError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

const API_BASE = "https://openrouter.ai/api/v1";
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 60000;
const RATE_LIMIT_RPM = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

export class OpenRouterClient {
  private config: OpenRouterConfig;
  private requestTimestamps: number[] = [];

  constructor(config: OpenRouterConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<OpenRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<OpenRouterConfig> {
    return { ...this.config };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.config.apiKey}`,
      "X-Title": this.config.title || "Paper Agents (Obsidian Plugin)",
    };

    if (this.config.referer) {
      headers["HTTP-Referer"] = this.config.referer;
    }

    return headers;
  }

  private buildRequestBody(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    stream = false,
    modelOverride?: string,
    plugins?: string[]
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: modelOverride ?? this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    if (plugins && plugins.length > 0) {
      body.plugins = plugins.map((id) => ({ id }));
    }

    return body;
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503;
  }

  private getRetryDelay(attempt: number, retryAfterHeader?: string): number {
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) return seconds * 1000;
    }
    return BASE_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 500;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Proactive rate limiting: waits if we're about to exceed RPM limit
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (this.requestTimestamps.length >= RATE_LIMIT_RPM) {
      const oldestInWindow = this.requestTimestamps[0]!;
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow) + 100;
      globalLogger.info(`Rate limit approaching, waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }

    this.requestTimestamps.push(Date.now());
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    plugins?: string[]
  ): Promise<OpenRouterResponse> {
    const body = this.buildRequestBody(messages, tools, false, undefined, plugins);

    await this.enforceRateLimit();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const params: RequestUrlParam = {
          url: `${API_BASE}/chat/completions`,
          method: "POST",
          headers: this.buildHeaders(),
          body: JSON.stringify(body),
          throw: false,
        };

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new OpenRouterError("Request timed out", 0, true)), REQUEST_TIMEOUT);
        });
        let response;
        try {
          response = await Promise.race([requestUrl(params), timeoutPromise]);
        } finally {
          clearTimeout(timeoutId!);
        }

        if (response.status >= 200 && response.status < 300) {
          const data = response.json as OpenRouterResponse;
          globalLogger.debug("OpenRouter response received", {
            model: data.model,
            usage: data.usage,
          });
          return data;
        }

        if (this.isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          const delay = this.getRetryDelay(attempt);
          globalLogger.warn(`OpenRouter ${response.status}, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
          });
          await this.sleep(delay);
          continue;
        }

        const errorBody = response.text || "Unknown error";
        throw new OpenRouterError(
          `OpenRouter API error: ${response.status} - ${errorBody}`,
          response.status,
          this.isRetryableStatus(response.status)
        );
      } catch (error) {
        if (error instanceof OpenRouterError) throw error;

        if (attempt < MAX_RETRIES) {
          const delay = this.getRetryDelay(attempt);
          globalLogger.warn("OpenRouter request error, retrying", {
            attempt: attempt + 1,
            error: String(error),
          });
          await this.sleep(delay);
          continue;
        }

        throw new OpenRouterError(
          `Network error after ${MAX_RETRIES + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
          0,
          false
        );
      }
    }

    throw new OpenRouterError("Max retries exceeded", 0, false);
  }

  async chatStream(
    messages: LLMMessage[],
    callbacks: StreamCallbacks,
    tools?: LLMToolDefinition[],
    modelOverride?: string,
    plugins?: string[]
  ): Promise<OpenRouterResponse> {
    const body = this.buildRequestBody(messages, tools, true, modelOverride, plugins);

    await this.enforceRateLimit();

    const params: RequestUrlParam = {
      url: `${API_BASE}/chat/completions`,
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      throw: false,
    };

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new OpenRouterError("Stream request timed out", 0, true)), REQUEST_TIMEOUT * 2);
    });

    let response;
    try {
      response = await Promise.race([requestUrl(params), timeoutPromise]);
    } catch (err) {
      clearTimeout(timeoutId!);
      const error = err instanceof OpenRouterError
        ? err
        : new OpenRouterError(
            `Stream request failed: ${err instanceof Error ? err.message : String(err)}`,
            0,
            false
          );
      callbacks.onError?.(error);
      throw error;
    }
    clearTimeout(timeoutId!);

    if (response.status < 200 || response.status >= 300) {
      const error = new OpenRouterError(
        `OpenRouter stream error: ${response.status} - ${response.text}`,
        response.status,
        this.isRetryableStatus(response.status)
      );
      callbacks.onError?.(error);
      throw error;
    }

    const fullContent: string[] = [];
    const toolCallsMap: Map<number, LLMToolCall> = new Map();
    let finishReason: string | null = null;
    let responseId = "";
    let responseModel = "";

    const lines = response.text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") break;

      try {
        const chunk = JSON.parse(data) as StreamChunk;
        responseId = chunk.id || responseId;

        for (const choice of chunk.choices) {
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (choice.delta.content) {
            fullContent.push(choice.delta.content);
            callbacks.onToken?.(choice.delta.content);
          }

          if (choice.delta.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || "",
                  type: "function",
                  function: { name: "", arguments: "" },
                });
              }
              const existing = toolCallsMap.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        globalLogger.debug("Skipping unparseable SSE chunk", { data });
      }
    }

    const toolCalls = Array.from(toolCallsMap.values());
    for (const tc of toolCalls) {
      callbacks.onToolCall?.(tc);
    }

    const completeResponse: OpenRouterResponse = {
      id: responseId,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: fullContent.join("") || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: finishReason,
      }],
      model: responseModel || this.config.model,
    };

    callbacks.onComplete?.(completeResponse);
    return completeResponse;
  }

  async testConnection(): Promise<{ success: boolean; error?: string; models?: string[] }> {
    try {
      const params: RequestUrlParam = {
        url: `${API_BASE}/models`,
        method: "GET",
        headers: this.buildHeaders(),
        throw: false,
      };

      const response = await requestUrl(params);

      if (response.status === 200) {
        const data = response.json as { data?: { id: string }[] };
        const models = (data.data || []).slice(0, 10).map((m) => m.id);
        return { success: true, models };
      }

      return { success: false, error: `HTTP ${response.status}: ${response.text}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const params: RequestUrlParam = {
        url: `${API_BASE}/models`,
        method: "GET",
        headers: this.buildHeaders(),
        throw: false,
      };

      const response = await requestUrl(params);
      if (response.status === 200) {
        const data = response.json as { data?: { id: string }[] };
        return (data.data || []).map((m) => m.id);
      }
      return [];
    } catch {
      return [];
    }
  }

  static validateApiKey(key: string): boolean {
    return typeof key === "string" && key.trim().length > 0 && key.startsWith("sk-");
  }
}

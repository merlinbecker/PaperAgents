import { requestUrl, RequestUrlParam } from "obsidian";
import { globalLogger } from "../utils/logger";
import type { WebSearchAnnotation } from "../types";

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
  annotations?: WebSearchAnnotation[];
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
      annotations?: WebSearchAnnotation[];
    };
    finish_reason: string | null;
  }[];
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: LLMToolCall) => void;
  onAnnotations?: (annotations: WebSearchAnnotation[]) => void;
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

/** Mutable accumulator used while parsing an SSE stream response. */
interface StreamState {
  fullContent: string[];
  toolCallsMap: Map<number, LLMToolCall>;
  allAnnotations: WebSearchAnnotation[];
  finishReason: string | null;
  responseId: string;
  responseModel: string;
}
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
    plugins?: Array<{ id: string } & Record<string, unknown>>
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
      body.plugins = plugins;
    }

    return body;
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503;
  }

  private getRetryDelay(attempt: number, retryAfterHeader?: string): number {
    if (retryAfterHeader) {
      const seconds = Number.parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(seconds)) return seconds * 1000;
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

  private async performChatRequest(body: Record<string, unknown>): Promise<OpenRouterResponse> {
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

    const errorBody = response.text || "Unknown error";
    throw new OpenRouterError(
      `OpenRouter API error: ${response.status} - ${errorBody}`,
      response.status,
      this.isRetryableStatus(response.status)
    );
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    plugins?: Array<{ id: string } & Record<string, unknown>>
  ): Promise<OpenRouterResponse> {
    const body = this.buildRequestBody(messages, tools, false, undefined, plugins);

    await this.enforceRateLimit();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.performChatRequest(body);
      } catch (error) {
        if (error instanceof OpenRouterError) {
          if (!error.retryable || attempt >= MAX_RETRIES) throw error;
          const delay = this.getRetryDelay(attempt);
          globalLogger.warn(`OpenRouter ${error.statusCode}, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: MAX_RETRIES,
          });
          await this.sleep(delay);
        } else if (attempt >= MAX_RETRIES) {
          throw new OpenRouterError(
            `Network error after ${MAX_RETRIES + 1} attempts: ${error instanceof Error ? error.message : String(error)}`,
            0,
            false
          );
        } else {
          const delay = this.getRetryDelay(attempt);
          globalLogger.warn("OpenRouter request error, retrying", {
            attempt: attempt + 1,
            error: String(error),
          });
          await this.sleep(delay);
        }
      }
    }

    throw new OpenRouterError("Max retries exceeded", 0, false);
  }

  async chatStream(
    messages: LLMMessage[],
    callbacks: StreamCallbacks,
    tools?: LLMToolDefinition[],
    modelOverride?: string,
    plugins?: Array<{ id: string } & Record<string, unknown>>
  ): Promise<OpenRouterResponse> {
    const body = this.buildRequestBody(messages, tools, true, modelOverride, plugins);
    await this.enforceRateLimit();

    const text = await this.performStreamHttpRequest(body, callbacks);
    const state = this.collectStreamData(text, callbacks);

    const toolCalls = Array.from(state.toolCallsMap.values());
    for (const tc of toolCalls) {
      callbacks.onToolCall?.(tc);
    }

    if (state.allAnnotations.length > 0) {
      callbacks.onAnnotations?.(state.allAnnotations);
    }

    const completeResponse: OpenRouterResponse = {
      id: state.responseId,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: state.fullContent.join("") || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          annotations: state.allAnnotations.length > 0 ? state.allAnnotations : undefined,
        },
        finish_reason: state.finishReason,
      }],
      model: state.responseModel || this.config.model,
    };

    callbacks.onComplete?.(completeResponse);
    return completeResponse;
  }

  /** Makes the streaming HTTP request with timeout; returns the raw response text. */
  private async performStreamHttpRequest(
    body: Record<string, unknown>,
    callbacks: StreamCallbacks
  ): Promise<string> {
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
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = err instanceof OpenRouterError
        ? err
        : new OpenRouterError(`Stream request failed: ${errorMessage}`, 0, false);
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

    return response.text;
  }

  /** Parses all SSE lines from a stream response and returns the accumulated state. */
  private collectStreamData(text: string, callbacks: StreamCallbacks): StreamState {
    const state: StreamState = {
      fullContent: [],
      toolCallsMap: new Map(),
      allAnnotations: [],
      finishReason: null,
      responseId: "",
      responseModel: "",
    };

    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed?.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") break;

      try {
        const chunk = JSON.parse(data) as StreamChunk;
        state.responseId = chunk.id || state.responseId;
        for (const choice of chunk.choices) {
          this.processStreamChoice(choice, state, callbacks);
        }
      } catch {
        globalLogger.debug("Skipping unparseable SSE chunk", { data });
      }
    }

    return state;
  }

  /** Processes a single choice delta from a stream chunk, updating the accumulated state. */
  private processStreamChoice(
    choice: StreamChunk["choices"][0],
    state: StreamState,
    callbacks: StreamCallbacks
  ): void {
    if (choice.finish_reason) state.finishReason = choice.finish_reason;

    if (choice.delta.content) {
      state.fullContent.push(choice.delta.content);
      callbacks.onToken?.(choice.delta.content);
    }

    if (choice.delta.annotations) {
      state.allAnnotations.push(...choice.delta.annotations);
    }

    if (choice.delta.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        this.mergeToolCallFragment(tc, state.toolCallsMap);
      }
    }
  }

  /** Merges an incremental tool-call fragment into the accumulation map. */
  private mergeToolCallFragment(
    tc: Partial<LLMToolCall> & { index?: number },
    toolCallsMap: Map<number, LLMToolCall>
  ): void {
    const idx = tc.index ?? 0;
    if (!toolCallsMap.has(idx)) {
      toolCallsMap.set(idx, { id: tc.id || "", type: "function", function: { name: "", arguments: "" } });
    }
    const existing = toolCallsMap.get(idx)!;
    if (tc.id) existing.id = tc.id;
    if (tc.function?.name) existing.function.name += tc.function.name;
    if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
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

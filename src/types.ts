/**
 * Paper Agents - Central Type Definitions
 * Single Source of Truth für alle Agent-, Tool- und Execution-Interfaces
 */

import type { App } from "obsidian";

// ============================================================================
// COMMON TYPE ALIASES
// ============================================================================

export type YAMLPrimitive = string | number | boolean | null;

// ============================================================================
// PARAMETER TYPES & VALIDATION
// ============================================================================

export type ParameterType = "string" | "number" | "boolean" | "array" | "object";

export interface Parameter {
  name: string;
  type: ParameterType;
  description?: string;
  required: boolean;
  default?: unknown;
}

// ============================================================================
// AGENT & TOOL DEFINITION
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: "single" | "chain";
  parameters: Parameter[];
  toolDefinition?: ToolDefinition; // Nur bei type: "single" - Tool-Ausführung optional
  steps?: Step[]; // Nur bei type: "chain"
  preprocess?: string; // JavaScript code mit // @preprocess Marker
  postprocess?: string; // JavaScript code mit // @postprocess Marker
}

export interface ToolDefinition {
  toolId: string; // ID des Predefined Tools (z.B. "read_file")
  parameters: Record<string, unknown>; // Tool-Parameter
}

export interface Step {
  name: string;
  parameters: Record<string, unknown>;
  continueOnError?: boolean;
  condition?: StepCondition;
  loop?: StepLoop;
  retry?: StepRetry;
}

export interface StepCondition {
  field: string;
  operator?: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists";
  value?: unknown;
  equals?: unknown;
}

export interface StepLoop {
  over: string;
  as: string;
  maxIterations?: number;
}

export interface StepRetry {
  maxAttempts: number;
  backoffMs?: number;
  retryOn?: string[];
}

// ============================================================================
// EXECUTION CONTEXT & RESULTS
// ============================================================================

export interface ExecutionContext {
  parameters: Record<string, unknown>; // User-Input
  previousStepOutputs: Record<string, unknown>; // Für Chaining
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  randomId: string; // UUID
}

export interface ToolExecution {
  toolName: string;
  parameters: Record<string, unknown>;
  output?: unknown;
  error?: string;
  hitlRequired?: boolean;
  hitlConfirmed?: boolean;
  timestamp: number;
  phase?: string;
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  log: ToolExecution[];
}

// ============================================================================
// EXECUTABLE TOOL INTERFACE
// ============================================================================

export interface IExecutableTool {
  name: string;
  parameters: Parameter[];
  execute(ctx: ExecutionContext): Promise<ExecutionResult>;
  shouldRequireHITL(parameters: Record<string, unknown>): boolean;
}

// ============================================================================
// TOOL FACTORY INTERFACE
// ============================================================================

export interface IToolFactory {
  name: string;
  description: string;
  parameters?: Parameter[];
  create(app?: App): IExecutableTool;
}

// ============================================================================
// TOOL REGISTRY INTERFACE (for dependency inversion)
// ============================================================================

export interface IToolRegistry {
  getTool(id: string): IExecutableTool | null;
  listTools(): ToolMetadata[];
}

// ============================================================================
// TOOL METADATA (für UI/Registry)
// ============================================================================

export interface ToolMetadata {
  id: string;
  name: string;
  description?: string;
  type: "predefined" | "custom" | "chain";
  parameters: Parameter[];
  category?: string; // "System Tools" | "Custom Tools" | "Chains"
  icon?: string; // Emoji oder Icon-Name
  isPlugin?: boolean; // True for server-side plugins (e.g., websearch)
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// YAML PARSING
// ============================================================================

export interface YAMLFrontmatter {
  tool?: boolean;
  id?: string;
  name?: string;
  description?: string;
  type?: "single" | "chain";
  parameters?: Parameter[];
  custom_function?: string;
  steps?: Step[];
  [key: string]: unknown;
}

export interface ParsedToolFile {
  frontmatter: YAMLFrontmatter;
  toolBlock?: string; // Extracted YAML tool execution block (für Single-Tools)
  steps?: string; // Extracted YAML/steps block (für Chain-Tools)
  preprocess?: string; // JavaScript code mit // @preprocess Marker
  postprocess?: string; // JavaScript code mit // @postprocess Marker
  rawContent: string;
}

// ============================================================================
// PLACEHOLDER REPLACEMENT
// ============================================================================

export interface PlaceholderContext {
  parameters: Record<string, unknown>;
  previousStepOutputs: Record<string, unknown>;
  date: string;
  time: string;
  randomId: string;
}

export interface PlaceholderMatch {
  placeholder: string;
  value: unknown;
  path: string;
}

// ============================================================================
// TOOL LOADER
// ============================================================================

export interface ToolFile {
  path: string;
  name: string;
  content: string;
}

export interface LoadToolsResult {
  successful: Agent[];
  failed: {
    file: string;
    error: string;
  }[];
}

// ============================================================================
// WEBSEARCH PLUGIN CONFIG
// ============================================================================

export interface WebSearchConfig {
  maxResults?: number;
}

// ============================================================================
// AGENT DEFINITION (Phase 4 - LLM-basierte Agenten)
// ============================================================================

export type MemoryType = "conversation" | "summary" | "none";

export interface MemoryConfig {
  type: MemoryType;
  maxMessages?: number;
  maxTokens?: number;
  summarizeAfter?: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  model?: string;
  tools: string[];
  memory: MemoryConfig;
  systemPrompt: string;
  contextTemplate?: string;
  temperature?: number;
  maxTokens?: number;
  websearchConfig?: WebSearchConfig;
}

export interface AgentFrontmatter {
  agent: boolean;
  id: string;
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
  memory?: MemoryConfig | Partial<MemoryConfig>;
  temperature?: number;
  maxTokens?: number;
  websearchConfig?: WebSearchConfig | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedAgentFile {
  frontmatter: AgentFrontmatter;
  systemPrompt: string;
  contextTemplate?: string;
  rawContent: string;
}

// ============================================================================
// CONVERSATION & MESSAGES
// ============================================================================

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  role: MessageRole;
  content: string;
  timestamp?: number;
  toolCall?: ToolCallInfo;
}

export interface ToolCallInfo {
  toolId: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationFrontmatter {
  conversation: boolean;
  id: string;
  agentId: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  [key: string]: unknown;
}

export interface ConversationContext {
  agent: AgentDefinition;
  conversation: Conversation;
  vaultPath?: string;
  currentDate: string;
  currentTime: string;
}

// ============================================================================
// AGENT LOADER
// ============================================================================

export interface LoadAgentsResult {
  successful: AgentDefinition[];
  failed: {
    file: string;
    error: string;
  }[];
}

// ============================================================================
// WEBSEARCH ANNOTATIONS (OpenRouter web-search plugin response)
// ============================================================================

export interface WebSearchUrlCitation {
  url: string;
  title?: string;
  content?: string;
  start_index?: number;
  end_index?: number;
}

export interface WebSearchAnnotation {
  type: "url_citation" | string;
  url_citation?: WebSearchUrlCitation;
}

/**
 * Paper Agents - Central Type Definitions
 * Single Source of Truth für alle Agent-, Tool- und Execution-Interfaces
 */

// ============================================================================
// PARAMETER TYPES & VALIDATION
// ============================================================================

export type ParameterType = "string" | "number" | "boolean" | "array" | "object";

export interface Parameter {
  name: string;
  type: ParameterType;
  description?: string;
  required: boolean;
  default?: any;
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
  parameters: Record<string, any>; // Tool-Parameter
}

export interface Step {
  name: string;
  parameters: Record<string, any>;
}

// ============================================================================
// EXECUTION CONTEXT & RESULTS
// ============================================================================

export interface ExecutionContext {
  parameters: Record<string, any>; // User-Input
  previousStepOutputs: Record<string, any>; // Für Chaining
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  randomId: string; // UUID
}

export interface ToolExecution {
  toolName: string;
  parameters: Record<string, any>;
  output?: any;
  error?: string;
  hitlRequired?: boolean;
  hitlConfirmed?: boolean;
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
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
  shouldRequireHITL(parameters: Record<string, any>): boolean;
}

// ============================================================================
// TOOL FACTORY INTERFACE
// ============================================================================

export interface IToolFactory {
  name: string;
  description: string;
  create(app?: any): IExecutableTool;
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
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
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
  [key: string]: any;
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
  parameters: Record<string, any>;
  previousStepOutputs: Record<string, any>;
  date: string;
  time: string;
  randomId: string;
}

export interface PlaceholderMatch {
  placeholder: string;
  value: any;
  path: string; // z.B. "param_name" oder "prev_step.output.field"
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
  [key: string]: any;
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
  parameters: Record<string, any>;
  result?: any;
  error?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
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

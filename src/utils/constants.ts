/**
 * Shared Constants - Zentrale Konstanten für das Plugin
 */

// Tool-Typen und IDs
export const TOOL_SIDEBAR_TYPE = "paper-agents-tool-sidebar";
export const PREDEFINED_TOOL_IDS = {
  SEARCH_FILES: "search_files",
  READ_FILE: "read_file",
  WRITE_FILE: "write_file",
  REST_REQUEST: "rest_request",
};

// Default-Pfade
export const DEFAULT_PATHS = {
  CUSTOM_TOOLS: "paper-agents-tools",
  AGENTS: "paper-agents-agents",
  CONVERSATIONS: "paper-agents-conversations",
  LOGS: "/.obsidian/plugins/paper-agents/logs/",
};

// OpenRouter Defaults
export const OPENROUTER_DEFAULTS = {
  API_URL: "https://openrouter.ai/api/v1",
  DEFAULT_MODEL: "openai/gpt-4o-mini",
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4096,
  MODELS: [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash-001",
    "google/gemini-2.5-pro-preview",
    "meta-llama/llama-3.1-70b-instruct",
    "mistralai/mistral-large",
  ],
};
export const DEFAULT_TOOLS_PATH = DEFAULT_PATHS.CUSTOM_TOOLS;
export const DEFAULT_LOGS_PATH = DEFAULT_PATHS.LOGS;

// Timeout und Limits
export const DEFAULT_SANDBOX_TIMEOUT = 5000; // ms
export const DEFAULT_SANDBOX_MEMORY = 256; // MB
export const DEFAULT_HITL_TIMEOUT = 30000; // ms
export const MAX_CHAIN_STEPS = 50;
export const MAX_PLACEHOLDER_RECURSION = 10;

// Tool-Kategorien
export const TOOL_CATEGORIES = {
  PREDEFINED: "Predefined Tools",
  SYSTEM: "System Tools",
  CUSTOM: "Custom Tools",
  CHAINS: "Chains",
  CHAIN: "Chains",
  AGENTS: "Agents",
};

// Icons
export const TOOL_ICONS = {
  PREDEFINED: "🔧",
  SYSTEM: "🔧",
  CUSTOM: "📝",
  CHAIN: "🔗",
  AGENTS: "🤖",
  DEFAULT: "⚙️",
};

// Error Messages
export const ERROR_MESSAGES = {
  TOOL_NOT_FOUND: "Tool not found",
  INVALID_PARAMETERS: "Invalid parameters",
  YAML_PARSE_ERROR: "Failed to parse YAML",
  EXECUTION_TIMEOUT: "Tool execution timeout",
  HITL_TIMEOUT: "Confirmation timeout",
  HITL_DENIED: "User denied the operation",
  FILE_NOT_FOUND: "File not found",
  API_ERROR: "API request failed",
};

// Success Messages
export const SUCCESS_MESSAGES = {
  TOOL_EXECUTED: "Tool executed successfully",
  FILE_CREATED: "File created",
  FILE_MODIFIED: "File modified",
  API_SUCCESS: "API request successful",
};

// Regex Patterns
export const PATTERNS = {
  // YAML Frontmatter: --- ... ---
  FRONTMATTER: /^---\n([\s\S]*?)\n---/,
  
  // Placeholders: {{param_name}} oder {{prev_step.output.field}}
  PLACEHOLDER: /\{\{([a-zA-Z0-9_.]+)\}\}/g,
  
  // Tool ID: alphanumeric + underscores
  TOOL_ID: /^[a-zA-Z0-9_]+$/,
  
  // UUID: standard format
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// UI Constants
export const UI_CONSTANTS = {
  MIN_TOUCH_TARGET: 44, // px
  MAX_PREVIEW_LENGTH: 500, // characters
  SEARCH_DEBOUNCE: 300, // ms
  MODAL_MIN_WIDTH: 500, // px
  MODAL_MAX_WIDTH: 800, // px
};

export default {
  TOOL_SIDEBAR_TYPE,
  PREDEFINED_TOOL_IDS,
  DEFAULT_TOOLS_PATH,
  DEFAULT_LOGS_PATH,
  DEFAULT_SANDBOX_TIMEOUT,
  DEFAULT_SANDBOX_MEMORY,
  DEFAULT_HITL_TIMEOUT,
  MAX_CHAIN_STEPS,
  MAX_PLACEHOLDER_RECURSION,
  TOOL_CATEGORIES,
  TOOL_ICONS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PATTERNS,
  UI_CONSTANTS,
};

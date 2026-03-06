/**
 * Agent Parser - Parst Agenten-Definitionen aus Markdown-Dateien
 * 
 * Format:
 * ---
 * agent: true
 * id: my_agent
 * name: "My Agent"
 * tools:
 *   - search_files
 *   - read_file
 * memory:
 *   type: conversation
 *   maxMessages: 20
 * ---
 * 
 * ## System Prompt
 * Du bist ein hilfreicher Assistent...
 * 
 * ## Kontext
 * Vault: {{vault_path}}
 * Datum: {{current_date}}
 */

import {
  AgentDefinition,
  AgentFrontmatter,
  ParsedAgentFile,
  MemoryConfig,
  MemoryType,
  WebSearchConfig,
  AgenticLoopConfig,
  TerminationCheckMode,
} from "../types";
import { YAMLParseError, YAMLParser } from "./yaml-parser";

export class AgentParseError extends Error {
  field?: string;
  
  constructor(message: string, field?: string) {
    super(message);
    this.name = "AgentParseError";
    this.field = field;
  }
}

export class AgentParser {
  private static readonly DEFAULT_MEMORY: MemoryConfig = {
    type: "conversation",
    maxMessages: 50,
  };

  static parseAgentFile(content: string): ParsedAgentFile {
    const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    
    if (!frontmatterMatch?.[1]) {
      throw new AgentParseError("No YAML frontmatter found. Agent file must start with ---");
    }

    const yamlContent = frontmatterMatch[1];
    const frontmatter = this.parseFrontmatter(yamlContent);
    
    if (!frontmatter.agent) {
      throw new AgentParseError("File is not an agent definition. Missing 'agent: true'");
    }

    const bodyContent = content.slice(frontmatterMatch[0].length).trim();
    const { systemPrompt, contextTemplate } = this.extractSections(bodyContent);

    return {
      frontmatter,
      systemPrompt,
      contextTemplate,
      rawContent: content,
    };
  }

  private static parseFrontmatter(yaml: string): AgentFrontmatter {
    try {
      const lines = yaml.split("\n");
      const result: Record<string, unknown> = {};

      let currentKey: string | null = null;
      let currentArray: unknown[] = [];
      let inArray = false;
      let nestedKey: string | null = null;
      let nestedObj: Record<string, unknown> = {};

      const nestedKeys: Record<string, string> = {
        "memory:": "memory",
        "websearchConfig:": "websearchConfig",
        "websearch_config:": "websearchConfig",
        "agenticLoop:": "agenticLoop",
        "agentic_loop:": "agenticLoop",
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const leadingSpaces = line.search(/\S/);

        if (trimmed.startsWith("- ") && inArray && currentKey) {
          currentArray.push(YAMLParser.parseValue(trimmed.slice(2).trim()));
          continue;
        }

        if (nestedKey && leadingSpaces >= 2 && trimmed.includes(":")) {
          const [key, value] = YAMLParser.parseKeyValue(trimmed);
          if (key) nestedObj[key] = value;
          continue;
        }

        if (leadingSpaces === 0 && trimmed.includes(":")) {
          if (inArray && currentKey) {
            result[currentKey] = currentArray;
            currentArray = [];
            inArray = false;
          }
          if (nestedKey) {
            result[nestedKey] = nestedObj;
            nestedKey = null;
            nestedObj = {};
          }

          const next = this.processTopLevelKey(trimmed, nestedKeys, result, currentKey);
          currentKey = next.currentKey;
          inArray = next.inArray;
          if (next.inArray) currentArray = [];
          if (next.nestedKey) { nestedKey = next.nestedKey; nestedObj = {}; }
        }
      }

      if (inArray && currentKey) result[currentKey] = currentArray;
      if (nestedKey) result[nestedKey] = nestedObj;

      return result as AgentFrontmatter;
    } catch (error) {
      if (error instanceof YAMLParseError) {
        throw new AgentParseError(`Invalid YAML: ${error.message}`);
      }
      throw error;
    }
  }

  private static processTopLevelKey(
    trimmed: string,
    nestedKeys: Record<string, string>,
    result: Record<string, unknown>,
    currentKey: string | null
  ): { currentKey: string | null; inArray: boolean; nestedKey: string | null } {
    if (trimmed === "tools:") {
      return { currentKey: "tools", inArray: true, nestedKey: null };
    }

    const nestedTarget = nestedKeys[trimmed];
    if (nestedTarget !== undefined) {
      return { currentKey, inArray: false, nestedKey: nestedTarget };
    }

    const [key, value] = YAMLParser.parseKeyValue(trimmed);
    if (key) {
      result[key] = value;
      return { currentKey: key, inArray: false, nestedKey: null };
    }

    return { currentKey, inArray: false, nestedKey: null };
  }

  private static extractSections(body: string): {
    systemPrompt: string;
    contextTemplate?: string;
  } {
    let systemPrompt = "";
    let contextTemplate: string | undefined;

    const systemPromptMatch = /##\s*System\s*Prompt\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i.exec(body);
    if (systemPromptMatch?.[1]) {
      systemPrompt = systemPromptMatch[1].trim();
    }

    const contextMatch = /##\s*Kontext\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i.exec(body);
    if (!contextMatch) {
      const contextMatchEn = /##\s*Context\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i.exec(body);
      if (contextMatchEn?.[1]) {
        contextTemplate = contextMatchEn[1].trim();
      }
    } else if (contextMatch?.[1]) {
      contextTemplate = contextMatch[1].trim();
    }

    if (!systemPrompt) {
      const noSectionContent = body.replaceAll(/##\s*\w+[\s\S]*?(?=\n##\s|$)/gi, "").trim();
      if (noSectionContent && !noSectionContent.startsWith("##")) {
        systemPrompt = noSectionContent;
      }
    }

    return { systemPrompt, contextTemplate };
  }

  static toAgentDefinition(parsed: ParsedAgentFile): AgentDefinition {
    const fm = parsed.frontmatter;

    if (!fm.id) {
      throw new AgentParseError("Missing required field: id", "id");
    }
    if (!fm.name) {
      throw new AgentParseError("Missing required field: name", "name");
    }

    const memory = this.parseMemoryConfig(fm.memory);
    const tools = Array.isArray(fm.tools) ? fm.tools.map(String) : [];

    if (!parsed.systemPrompt) {
      throw new AgentParseError(
        "Missing System Prompt section. Add '## System Prompt' followed by the prompt text.",
        "systemPrompt"
      );
    }

    return {
      id: String(fm.id),
      name: String(fm.name),
      description: fm.description ? String(fm.description) : undefined,
      model: fm.model ? String(fm.model) : undefined,
      tools,
      memory,
      systemPrompt: parsed.systemPrompt,
      contextTemplate: parsed.contextTemplate,
      temperature: typeof fm.temperature === "number" ? fm.temperature : undefined,
      maxTokens: typeof fm.maxTokens === "number" ? fm.maxTokens : undefined,
      websearchConfig: this.parseWebSearchConfig(fm.websearchConfig),
      agenticLoop: this.parseAgenticLoopConfig(fm.agenticLoop),
    };
  }

  private static parseWebSearchConfig(config: unknown): WebSearchConfig | undefined {
    if (!config || typeof config !== "object") return undefined;
    const cfg = config as Record<string, unknown>;
    const maxResults = cfg.maxResults ?? cfg.max_results;
    if (typeof maxResults === "number" && maxResults > 0 && maxResults <= 100) {
      return { maxResults };
    }
    return undefined;
  }

  private static parseAgenticLoopConfig(config: unknown): AgenticLoopConfig | undefined {
    if (!config || typeof config !== "object") return undefined;
    const cfg = config as Record<string, unknown>;
    if (cfg.enabled !== true) return undefined;

    const maxIter = typeof cfg.maxIterations === "number" ? cfg.maxIterations : 10;
    const validModes: TerminationCheckMode[] = ["auto", "phrase", "tool"];
    const rawMode = cfg.terminationCheck as TerminationCheckMode;
    const mode: TerminationCheckMode = validModes.includes(rawMode) ? rawMode : "auto";

    return {
      enabled: true,
      maxIterations: Math.min(Math.max(1, maxIter), 50),
      terminationCheck: mode,
      terminationPhrase: typeof cfg.terminationPhrase === "string" ? cfg.terminationPhrase : undefined,
      iterationPrompt: typeof cfg.iterationPrompt === "string" ? cfg.iterationPrompt : undefined,
      showProgress: cfg.showProgress !== false,
      autoSaveReport: cfg.autoSaveReport === true,
    };
  }

  private static parseMemoryConfig(memory: unknown): MemoryConfig {
    if (!memory || typeof memory !== "object") {
      return { ...this.DEFAULT_MEMORY };
    }

    const mem = memory as Record<string, unknown>;
    const validTypes: MemoryType[] = ["conversation", "summary", "none"];
    const type = validTypes.includes(mem.type as MemoryType) ? (mem.type as MemoryType) : "conversation";

    let maxMessages = 50;
    if (typeof mem.maxMessages === "number") {
      maxMessages = mem.maxMessages;
    } else if (typeof mem.max_messages === "number") {
      maxMessages = mem.max_messages;
    }

    let maxTokens: number | undefined;
    if (typeof mem.maxTokens === "number") {
      maxTokens = mem.maxTokens;
    } else if (typeof mem.max_tokens === "number") {
      maxTokens = mem.max_tokens;
    }

    let summarizeAfter: number | undefined;
    if (typeof mem.summarizeAfter === "number") {
      summarizeAfter = mem.summarizeAfter;
    } else if (typeof mem.summarize_after === "number") {
      summarizeAfter = mem.summarize_after;
    }

    return {
      type,
      maxMessages,
      maxTokens,
      summarizeAfter,
    };
  }

  static parse(content: string): AgentDefinition {
    const parsed = this.parseAgentFile(content);
    return this.toAgentDefinition(parsed);
  }

  static isAgentFile(content: string): boolean {
    try {
      const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
      if (!frontmatterMatch?.[1]) return false;
      
      return frontmatterMatch[1].includes("agent: true");
    } catch {
      return false;
    }
  }

  static validateAgentDefinition(agent: AgentDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!agent.id || agent.id.trim() === "") {
      errors.push("Agent ID is required");
    }
    if (!agent.name || agent.name.trim() === "") {
      errors.push("Agent name is required");
    }
    if (!agent.systemPrompt || agent.systemPrompt.trim() === "") {
      errors.push("System prompt is required");
    }
    if (!agent.memory?.type) {
      errors.push("Memory configuration is required");
    }
    if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
      errors.push("Temperature must be between 0 and 2");
    }
    if (agent.maxTokens !== undefined && agent.maxTokens < 1) {
      errors.push("Max tokens must be at least 1");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default AgentParser;

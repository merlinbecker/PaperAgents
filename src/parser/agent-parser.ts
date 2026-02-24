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
  LoadAgentsResult,
} from "../types";
import { YAMLParser, YAMLParseError } from "./yaml-parser";

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

  private static readonly DEFAULT_MODEL = "openai/gpt-4o-mini";

  static parseAgentFile(content: string): ParsedAgentFile {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch || !frontmatterMatch[1]) {
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
      const result: Record<string, any> = {};
      
      let currentKey: string | null = null;
      let currentArray: any[] = [];
      let inArray = false;
      let inMemory = false;
      let memoryObj: Record<string, any> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const leadingSpaces = line.search(/\S/);

        if (trimmed.startsWith("- ") && inArray && currentKey) {
          const value = trimmed.slice(2).trim();
          currentArray.push(this.parseValue(value));
          continue;
        }

        if (inMemory && leadingSpaces >= 2 && trimmed.includes(":")) {
          const [key, value] = this.parseKeyValue(trimmed);
          if (key) {
            memoryObj[key] = value;
          }
          continue;
        }

        if (leadingSpaces === 0 && trimmed.includes(":")) {
          if (inArray && currentKey) {
            result[currentKey] = currentArray;
            currentArray = [];
            inArray = false;
          }
          if (inMemory) {
            result["memory"] = memoryObj;
            memoryObj = {};
            inMemory = false;
          }

          if (trimmed === "tools:") {
            currentKey = "tools";
            inArray = true;
            currentArray = [];
            continue;
          }

          if (trimmed === "memory:") {
            inMemory = true;
            memoryObj = {};
            continue;
          }

          const [key, value] = this.parseKeyValue(trimmed);
          if (key) {
            result[key] = value;
            currentKey = key;
          }
        }
      }

      if (inArray && currentKey) {
        result[currentKey] = currentArray;
      }
      if (inMemory) {
        result["memory"] = memoryObj;
      }

      return result as AgentFrontmatter;
    } catch (error) {
      if (error instanceof YAMLParseError) {
        throw new AgentParseError(`Invalid YAML: ${error.message}`);
      }
      throw error;
    }
  }

  private static parseKeyValue(line: string): [string, any] {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) return ["", null];
    
    const key = match[1] || "";
    const valueStr = match[2];
    return [key, valueStr ? this.parseValue(valueStr.trim()) : null];
  }

  private static parseValue(str: string): any {
    if (str === "true") return true;
    if (str === "false") return false;
    if (str === "null") return null;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    if (/^\d+\.\d+$/.test(str)) return parseFloat(str);
    if (str.startsWith('"') && str.endsWith('"')) return str.slice(1, -1);
    if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1);
    return str;
  }

  private static extractSections(body: string): {
    systemPrompt: string;
    contextTemplate?: string;
  } {
    let systemPrompt = "";
    let contextTemplate: string | undefined;

    const systemPromptMatch = body.match(/##\s*System\s*Prompt\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i);
    if (systemPromptMatch && systemPromptMatch[1]) {
      systemPrompt = systemPromptMatch[1].trim();
    }

    const contextMatch = body.match(/##\s*Kontext\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i);
    if (!contextMatch) {
      const contextMatchEn = body.match(/##\s*Context\s*\n([\s\S]*?)(?=\n##\s|\n---|$)/i);
      if (contextMatchEn && contextMatchEn[1]) {
        contextTemplate = contextMatchEn[1].trim();
      }
    } else if (contextMatch && contextMatch[1]) {
      contextTemplate = contextMatch[1].trim();
    }

    if (!systemPrompt) {
      const noSectionContent = body.replace(/##\s*\w+[\s\S]*?(?=\n##\s|$)/gi, "").trim();
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
      model: fm.model ? String(fm.model) : this.DEFAULT_MODEL,
      tools,
      memory,
      systemPrompt: parsed.systemPrompt,
      contextTemplate: parsed.contextTemplate,
      temperature: typeof fm.temperature === "number" ? fm.temperature : undefined,
      maxTokens: typeof fm.maxTokens === "number" ? fm.maxTokens : undefined,
    };
  }

  private static parseMemoryConfig(memory: any): MemoryConfig {
    if (!memory || typeof memory !== "object") {
      return { ...this.DEFAULT_MEMORY };
    }

    const validTypes: MemoryType[] = ["conversation", "summary", "none"];
    const type = validTypes.includes(memory.type) ? memory.type : "conversation";

    return {
      type,
      maxMessages: typeof memory.maxMessages === "number" ? memory.maxMessages : 
                   typeof memory.max_messages === "number" ? memory.max_messages : 50,
      maxTokens: typeof memory.maxTokens === "number" ? memory.maxTokens :
                 typeof memory.max_tokens === "number" ? memory.max_tokens : undefined,
      summarizeAfter: typeof memory.summarizeAfter === "number" ? memory.summarizeAfter :
                      typeof memory.summarize_after === "number" ? memory.summarize_after : undefined,
    };
  }

  static parse(content: string): AgentDefinition {
    const parsed = this.parseAgentFile(content);
    return this.toAgentDefinition(parsed);
  }

  static isAgentFile(content: string): boolean {
    try {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch || !frontmatterMatch[1]) return false;
      
      return frontmatterMatch[1].includes("agent:") && 
             frontmatterMatch[1].includes("agent: true");
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
    if (!agent.memory || !agent.memory.type) {
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

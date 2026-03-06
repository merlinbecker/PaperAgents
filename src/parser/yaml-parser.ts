/**
 * YAML Parser - Konvertiert Markdown-Dateien zu Agent-Objekten
 * Extrahiert YAML-Frontmatter und Code-Blöcke
 */

import { Agent, Parameter, Step, YAMLFrontmatter, ParsedToolFile, ParameterType, YAMLPrimitive } from "../types";

export class YAMLParseError extends Error {
  line: number;
  column: number;
  snippet?: string;
  position: { line: number; column: number };

  constructor(message: string, line: number, column: number, snippet?: string) {
    const snippetSuffix = snippet ? `: ${snippet}` : "";
    super(`${message} at line ${line}, column ${column}${snippetSuffix}`);
    this.name = "YAMLParseError";
    this.line = line;
    this.column = column;
    this.snippet = snippet;
    this.position = { line, column };
  }
}

/**
 * Parst eine Markdown-Datei mit YAML-Frontmatter
 * Format:
 * ---
 * tool: true
 * id: "my_tool"
 * name: "My Tool"
 * ...
 * ---
 * 
 * ```javascript
 * function myFunction(input) { ... }
 * return myFunction(input);
 * ```
 */
export class YAMLParser {
  /**
   * Extrahiert YAML-Frontmatter aus Markdown-String
   */
  static parseFrontmatter(content: string): YAMLFrontmatter {
    const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    
    if (!frontmatterMatch?.[1]) {
      throw new YAMLParseError("No YAML frontmatter found. File must start with ---", 1, 1);
    }

    const yamlContent = frontmatterMatch[1];
    const startOfYaml = (frontmatterMatch.index ?? 0) + frontmatterMatch[0].indexOf(frontmatterMatch[1]);
    const baseLine = content.slice(0, startOfYaml).split("\n").length;
    return this.parseYAML(yamlContent, baseLine);
  }

  /**
   * Einfacher YAML-Parser (ohne externe Dependencies)
   * Unterstützt: Strings, Numbers, Booleans, Arrays, Objects
   */
  private static parseYAML(yaml: string, baseLine: number = 1): YAMLFrontmatter {
    const result: YAMLFrontmatter = {};
    const lines = yaml.split("\n");

    let currentKey: string | null = null;
    let currentArray: unknown[] = [];
    let currentItem: Record<string, unknown> | null = null;
    let inArray = false;
    let inNestedObject = false;
    let nestedObjectKey: string | null = null;
    let nestedObject: Record<string, unknown> | null = null;
    const raise = (message: string, lineIndex: number, line: string): never => {
      const column = Math.max(line.search(/\S/), 0) + 1;
      const snippet = line.trim();
      throw new YAMLParseError(
        `Invalid YAML frontmatter: ${message}`,
        lineIndex + baseLine,
        column,
        snippet || undefined
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const leadingSpaces = line.search(/\S/);

      if (!trimmed.includes(":") && !trimmed.startsWith("-")) {
        raise("Expected key-value pair (key: value) or list item", i, line);
      }

      if (trimmed.startsWith("-")) {
        const state = { currentKey, currentArray, currentItem, inArray, inNestedObject, nestedObjectKey, nestedObject };
        const existingArray = currentKey ? (Array.isArray(result[currentKey]) ? (result[currentKey] as unknown[]) : []) : [];
        const next = this.processArrayItem(state, existingArray, trimmed, i, line, raise);
        ({ currentKey, currentArray, currentItem, inArray, inNestedObject, nestedObjectKey, nestedObject } = next);
        if (next.continue) continue;
      }

      if (inArray && currentItem && trimmed.endsWith(":") && leadingSpaces > 2) {
        if (nestedObjectKey && nestedObject) {
          currentItem[nestedObjectKey] = nestedObject;
        }
        nestedObjectKey = trimmed.replace(":", "").trim();
        if (!nestedObjectKey) raise("Invalid nested object key", i, line);
        nestedObject = {};
        inNestedObject = true;
        continue;
      }

      if (inNestedObject && nestedObject && leadingSpaces > 4) {
        const [key, value] = this.parseKeyValue(trimmed);
        if (!key) raise("Invalid nested property, expected key: value", i, line);
        nestedObject[key] = value;
        continue;
      }

      if (inArray && inNestedObject && leadingSpaces <= 2 && !trimmed.startsWith("-")) {
        if (nestedObjectKey && nestedObject && currentItem) {
          currentItem[nestedObjectKey] = nestedObject;
        }
        inNestedObject = false;
        nestedObject = null;
        nestedObjectKey = null;
      }

      if (inArray && !inNestedObject && leadingSpaces > 2 && !trimmed.startsWith("-") && trimmed.includes(":")) {
        if (currentItem) {
          const [key, value] = this.parseKeyValue(trimmed);
          if (!key) raise("Invalid list property, expected key: value", i, line);
          currentItem[key] = value;
          continue;
        }
        raise("List property without current item", i, line);
      }

      const arrayKeyMatch = /^(\w+):\s*$/.exec(trimmed);
      if (arrayKeyMatch?.[1]) {
        if (inArray && currentKey) {
          this.flushArray(result, currentKey, currentArray, currentItem, nestedObjectKey, nestedObject);
          currentArray = [];
          currentItem = null;
          nestedObject = null;
          nestedObjectKey = null;
          inArray = false;
          inNestedObject = false;
        }
        currentKey = arrayKeyMatch[1];
        result[currentKey] = result[currentKey] || [];
        continue;
      }

      if (trimmed.includes(":") && leadingSpaces === 0) {
        if (inArray && currentKey) {
          this.flushArray(result, currentKey, currentArray, currentItem, nestedObjectKey, nestedObject);
          currentArray = [];
          currentItem = null;
          nestedObject = null;
          nestedObjectKey = null;
          inArray = false;
          inNestedObject = false;
        }
        const [key, value] = this.parseKeyValue(trimmed);
        if (!key) raise("Invalid key-value pair", i, line);
        result[key] = value;
        currentKey = key;
        continue;
      }

      raise("Invalid YAML syntax", i, line);
    }

    if (inArray && currentKey) {
      if (nestedObjectKey && nestedObject && currentItem) {
        currentItem[nestedObjectKey] = nestedObject;
      }
      result[currentKey] = currentArray;
    }

    return result;
  }

  private static flushArray(
    result: YAMLFrontmatter,
    currentKey: string,
    currentArray: unknown[],
    currentItem: Record<string, unknown> | null,
    nestedObjectKey: string | null,
    nestedObject: Record<string, unknown> | null
  ): void {
    if (nestedObjectKey && nestedObject && currentItem) {
      currentItem[nestedObjectKey] = nestedObject;
    }
    result[currentKey] = currentArray;
  }

  private static processArrayItem(
    state: {
      currentKey: string | null;
      currentArray: unknown[];
      currentItem: Record<string, unknown> | null;
      inArray: boolean;
      inNestedObject: boolean;
      nestedObjectKey: string | null;
      nestedObject: Record<string, unknown> | null;
    },
    existingArray: unknown[],
    trimmed: string,
    i: number,
    line: string,
    raise: (msg: string, idx: number, ln: string) => never
  ): typeof state & { continue: boolean } {
    if (!state.currentKey) {
      raise("List item without a parent array key", i, line);
    }

    let { currentArray, currentItem, nestedObjectKey, nestedObject } = state;
    let inArray = state.inArray;

    if (!inArray) {
      inArray = true;
      currentArray = [...existingArray];
    }

    if (currentItem && nestedObjectKey && nestedObject) {
      currentItem[nestedObjectKey] = nestedObject;
      nestedObject = null;
      nestedObjectKey = null;
    }

    const itemContent = trimmed.replace(/^-/, "").trim();
    const item: Record<string, unknown> = {};

    if (itemContent) {
      if (itemContent.includes(":")) {
        const [key, value] = this.parseKeyValue(itemContent);
        if (!key) raise("Invalid list entry, expected key: value", i, line);
        item[key] = value;
      } else {
        currentArray.push(this.parseValue(itemContent));
        return { ...state, currentArray, currentItem: null, inArray, nestedObjectKey, nestedObject, inNestedObject: false, continue: true };
      }
    }

    currentArray.push(item);
    currentItem = item;
    return { ...state, currentArray, currentItem, inArray, nestedObjectKey, nestedObject, inNestedObject: false, continue: true };
  }

  /**
   * Parst ein einzelnes Key-Value Paar
   */
  static parseKeyValue(line: string): [string, YAMLPrimitive] {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (!match) {
      return ["", null];
    }

    const key = match[1] || "";
    const valueStr = match[2];
    const value = valueStr ? this.parseValue(valueStr.trim()) : null;
    return [key, value];
  }

  /**
   * Parst ein YAML-Object aus String (z.B. "name: foo, type: bar")
   */
  private static parseYAMLObject(str: string): Record<string, YAMLPrimitive> {
    const obj: Record<string, YAMLPrimitive> = {};
    const pairs = str.split(",").map((p) => p.trim());

    for (const pair of pairs) {
      const [key, value] = this.parseKeyValue(pair);
      if (key) {
        obj[key] = value;
      }
    }

    return obj;
  }

  /**
   * Konvertiert String zu korrektem Typ
   */
  static parseValue(str: string): YAMLPrimitive {
    if (str === "true") return true;
    if (str === "false") return false;
    if (str === "null") return null;
    if (/^\d+$/.test(str)) return Number.parseInt(str, 10);
    if (/^\d+\.\d+$/.test(str)) return Number.parseFloat(str);
    if (str.startsWith('"') && str.endsWith('"')) return str.slice(1, -1);
    if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1);
    return str;
  }

  /**
   * Extrahiert Code-Blöcke mit neuer Notation
   * - `// @preprocess` Marker für Pre-Processing
   * - `// @postprocess` Marker für Post-Processing
   * - ```yaml``` für Tool-Definition oder Steps
   * 
   * Neue Notation erlaubt mehrere JavaScript-Blöcke mit verschiedenen Markern.
   */
  static extractCodeBlocks(content: string): {
    yaml?: string;
    preprocess?: string;
    postprocess?: string;
  } {
    const result: { yaml?: string; preprocess?: string; postprocess?: string } = {};

    // Extrahiere @preprocess Block
    // Pattern: ```javascript\n// @preprocess\n...\n```
    const preprocessMatch = /\/\/\s*@preprocess\n([\s\S]*?)\n```/.exec(content);
    if (preprocessMatch) {
      result.preprocess = preprocessMatch[1];
    }

    // Extrahiere @postprocess Block
    const postprocessMatch = /\/\/\s*@postprocess\n([\s\S]*?)\n```/.exec(content);
    if (postprocessMatch) {
      result.postprocess = postprocessMatch[1];
    }

    // Extrahiere YAML-Block (Tool-Definition oder Steps)
    const yamlMatch = /```yaml\n([\s\S]*?)\n```/.exec(content);
    if (yamlMatch) {
      result.yaml = yamlMatch[1];
    }

    return result;
  }

  /**
   * Komplette Markdown-Datei parsen
   */
  static parseToolFile(content: string): ParsedToolFile {
    const frontmatter = this.parseFrontmatter(content);
    const blocks = this.extractCodeBlocks(content);

    // YAML-Block wird unterschiedlich verwendet:
    // - Bei type: "single" → Tool-Definition (tool: "id", parameters: {...})
    // - Bei type: "chain" → Steps-Definition
    return {
      frontmatter,
      toolBlock: frontmatter.type === "single" ? blocks.yaml : undefined,
      steps: frontmatter.type === "chain" ? blocks.yaml : undefined,
      preprocess: blocks.preprocess,
      postprocess: blocks.postprocess,
      rawContent: content,
    };
  }

  /**
   * Konvertiert ParsedToolFile zu Agent-Objekt
   */
  static toAgent(parsed: ParsedToolFile): Agent {
    const frontmatter = parsed.frontmatter;

    if (!frontmatter.id || !frontmatter.name || !frontmatter.type) {
      throw new Error("Missing required fields: id, name, type");
    }

    const agent: Agent = {
      id: String(frontmatter.id),
      name: String(frontmatter.name),
      description: frontmatter.description ? String(frontmatter.description) : undefined,
      type: frontmatter.type,
      parameters: this.parseParameters((frontmatter.parameters || []) as unknown[] as Array<Record<string, unknown>>),
    };

    // Pre- und Post-Processing hinzufügen (beide für single und chain)
    if (parsed.preprocess) {
      agent.preprocess = parsed.preprocess;
    }
    if (parsed.postprocess) {
      agent.postprocess = parsed.postprocess;
    }

    // Single-Tool: Parse Tool-Definition aus YAML-Block
    if (frontmatter.type === "single" && parsed.toolBlock) {
      agent.toolDefinition = this.parseToolDefinition(parsed.toolBlock);
    }

    // Chain-Tool: Parse Steps
    if (frontmatter.type === "chain") {
      // Steps werden direkt aus dem Frontmatter geparst (als Array von Objects)
      if (Array.isArray(frontmatter.steps) && frontmatter.steps.length > 0) {
        agent.steps = (frontmatter.steps as unknown as Array<Record<string, unknown>>).map((step) => ({
          name: typeof step.name === "string" ? step.name : "",
          parameters: (step.parameters || {}) as Record<string, unknown>,
        }));
      } else if (parsed.steps) {
        // Fallback: Wenn Steps als YAML-String vorhanden
        agent.steps = this.parseSteps(parsed.steps);
      }
    }

    return agent;
  }

  /**
   * Parst Tool-Definition aus YAML-Block
   * Format:
   * ```yaml
   * tool: "read_file"
   * parameters:
   *   filePath: "input.path"
   * ```
   */
  private static parseToolDefinition(yamlBlock: string): { toolId: string; parameters: Record<string, unknown> } {
    const lines = yamlBlock.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));
    
    let toolId = "";
    const parameters: Record<string, unknown> = {};
    let inParameters = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("tool:")) {
        const match = /tool:\s*['"](.*?)['"]/.exec(trimmed) ?? /tool:\s*(\S+)/.exec(trimmed);
        if (match?.[1]) {
          toolId = match[1];
        }
      } else if (trimmed.startsWith("parameters:")) {
        inParameters = true;
      } else if (inParameters && /^\w+:/.test(trimmed)) {
        const [key, value] = this.parseKeyValue(trimmed);
        if (key) {
          parameters[key] = value;
        }
      }
    }

    if (!toolId) {
      throw new Error("Tool-Definition muss 'tool: \"<id>\"' enthalten");
    }

    return { toolId, parameters };
  }

  /**
   * Parst Parameter-Array aus YAML
   */
  private static parseParameters(params: Array<Record<string, unknown>>): Parameter[] {
    if (!Array.isArray(params)) {
      return [];
    }

    return params.map((p) => ({
      name: typeof p.name === "string" ? p.name : "",
      type: (p.type || "string") as ParameterType,
      description: typeof p.description === "string" ? p.description : undefined,
      required: p.required !== false,
      default: p.default,
    }));
  }

  /**
   * Parst Steps aus YAML (Strings oder Objects)
   * Beispiel:
   * ```yaml
   * steps:
   *   - name: "read_file"
   *     parameters:
   *       filePath: "{{file_path}}"
   * ```
   */
  private static parseSteps(stepsYAML: string): Step[] {
    const steps: Step[] = [];
    const lines = stepsYAML.split("\n").filter((line) => line.trim());

    let currentStep: Partial<Step> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("- name:")) {
        if (currentStep?.name) steps.push(currentStep as Step);
        currentStep = { name: this.parseStepName(trimmed), parameters: {} };
      } else if (!trimmed.startsWith("parameters:") && currentStep) {
        this.addStepParameter(currentStep, trimmed);
      }
    }

    if (currentStep?.name) steps.push(currentStep as Step);

    return steps;
  }

  private static parseStepName(trimmed: string): string {
    const nameMatch = /- name:\s*['"](.*?)['"]/.exec(trimmed) ??
                     /- name:\s*(\S+)/.exec(trimmed);
    return nameMatch?.[1] ?? "";
  }

  private static addStepParameter(step: Partial<Step>, trimmed: string): void {
    if (/^\w+:/.test(trimmed) && !trimmed.includes("steps:") && step.parameters) {
      const [key, value] = this.parseKeyValue(trimmed);
      if (key) step.parameters[key] = value;
    }
  }
}

export default YAMLParser;

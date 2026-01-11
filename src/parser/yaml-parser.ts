/**
 * YAML Parser - Konvertiert Markdown-Dateien zu Agent-Objekten
 * Extrahiert YAML-Frontmatter und Code-Blöcke
 */

import { Agent, Parameter, Step, YAMLFrontmatter, ParsedToolFile, ParameterType } from "../types";

export class YAMLParseError extends Error {
  line: number;
  column: number;
  snippet?: string;
  position: { line: number; column: number };

  constructor(message: string, line: number, column: number, snippet?: string) {
    super(`${message} at line ${line}, column ${column}${snippet ? `: ${snippet}` : ""}`);
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
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch || !frontmatterMatch[1]) {
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
    let currentArray: any[] = [];
    let currentItem: Record<string, any> | null = null;
    let inArray = false;
    let inNestedObject = false;
    let nestedObjectKey: string | null = null;
    let nestedObject: Record<string, any> | null = null;
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
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const leadingSpaces = line.search(/\S/);

      if (!trimmed.includes(":") && !trimmed.startsWith("-")) {
        raise("Expected key-value pair (key: value) or list item", i, line);
      }

      // Array-Item Start (z.B. "- name: foo")
      if (trimmed.startsWith("-")) {
        if (!currentKey) {
          raise("List item without a parent array key", i, line);
        }

        if (!inArray) {
          inArray = true;
          currentArray = Array.isArray(result[currentKey]) ? ([...(result[currentKey] as any[])]) : [];
        }

        if (currentItem && nestedObjectKey && nestedObject) {
          currentItem[nestedObjectKey] = nestedObject;
          nestedObject = null;
          nestedObjectKey = null;
        }

        const itemContent = trimmed.replace(/^-/, "").trim();
        const item: Record<string, any> = {};

        if (itemContent) {
          if (itemContent.includes(":")) {
            const [key, value] = this.parseKeyValue(itemContent);
            if (!key) {
              raise("Invalid list entry, expected key: value", i, line);
            }
            item[key] = value;
          } else {
            currentArray.push(this.parseValue(itemContent));
            currentItem = null;
            inNestedObject = false;
            continue;
          }
        }

        currentArray.push(item);
        currentItem = item;
        inNestedObject = false;
        continue;
      }

      // Erkennung von Nested Object (z.B. "parameters:" unter einem Array-Item)
      if (inArray && currentItem && trimmed.endsWith(":") && leadingSpaces > 2) {
        if (nestedObjectKey && nestedObject) {
          currentItem[nestedObjectKey] = nestedObject;
        }
        nestedObjectKey = trimmed.replace(":", "").trim();
        if (!nestedObjectKey) {
          raise("Invalid nested object key", i, line);
        }
        nestedObject = {};
        inNestedObject = true;
        continue;
      }

      // Properties innerhalb eines Nested Objects
      if (inNestedObject && nestedObject && leadingSpaces > 4) {
        const [key, value] = this.parseKeyValue(trimmed);
        if (!key) {
          raise("Invalid nested property, expected key: value", i, line);
        }
        nestedObject[key] = value;
        continue;
      }

      // Beende nested Object wenn Einrückung abnimmt
      if (inArray && inNestedObject && leadingSpaces <= 2 && !trimmed.startsWith("-")) {
        if (nestedObjectKey && nestedObject && currentItem) {
          currentItem[nestedObjectKey] = nestedObject;
        }
        inNestedObject = false;
        nestedObject = null;
        nestedObjectKey = null;
      }

      // Properties direkt im Array-Item (aber nicht nested)
      if (inArray && !inNestedObject && leadingSpaces > 2 && !trimmed.startsWith("-") && trimmed.includes(":")) {
        if (currentItem) {
          const [key, value] = this.parseKeyValue(trimmed);
          if (!key) {
            raise("Invalid list property, expected key: value", i, line);
          }
          currentItem[key] = value;
          continue;
        }
        raise("List property without current item", i, line);
      }

      // Array abschliessen, wenn neuer Top-Level Key beginnt
      const arrayKeyMatch = trimmed.match(/^(\w+):\s*$/);
      if (arrayKeyMatch) {
        if (inArray && currentKey) {
          if (nestedObjectKey && nestedObject && currentItem) {
            currentItem[nestedObjectKey] = nestedObject;
          }
          result[currentKey] = currentArray;
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

      // Parse Key-Value Paare (Top-Level)
      if (trimmed.includes(":") && leadingSpaces === 0) {
        if (inArray && currentKey) {
          if (nestedObjectKey && nestedObject && currentItem) {
            currentItem[nestedObjectKey] = nestedObject;
          }
          result[currentKey] = currentArray;
          currentArray = [];
          currentItem = null;
          nestedObject = null;
          nestedObjectKey = null;
          inArray = false;
          inNestedObject = false;
        }

        const [key, value] = this.parseKeyValue(trimmed);
        if (!key) {
          raise("Invalid key-value pair", i, line);
        }
        result[key] = value;
        currentKey = key;
        continue;
      }

      raise("Invalid YAML syntax", i, line);
    }

    // Cleanup ausstehende Items
    if (inArray && currentKey) {
      if (nestedObjectKey && nestedObject && currentItem) {
        currentItem[nestedObjectKey] = nestedObject;
      }
      result[currentKey] = currentArray;
    }

    return result;
  }

  /**
   * Parst ein einzelnes Key-Value Paar
   */
  private static parseKeyValue(line: string): [string, any] {
    const match = line.match(/^(\w+):\s*(.*)$/);
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
  private static parseYAMLObject(str: string): Record<string, any> {
    const obj: Record<string, any> = {};
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
    const preprocessMatch = content.match(/\/\/\s*@preprocess\n([\s\S]*?)\n```/);
    if (preprocessMatch) {
      result.preprocess = preprocessMatch[1];
    }

    // Extrahiere @postprocess Block
    const postprocessMatch = content.match(/\/\/\s*@postprocess\n([\s\S]*?)\n```/);
    if (postprocessMatch) {
      result.postprocess = postprocessMatch[1];
    }

    // Extrahiere YAML-Block (Tool-Definition oder Steps)
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
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
      type: frontmatter.type as "single" | "chain",
      parameters: this.parseParameters(frontmatter.parameters || []),
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
        agent.steps = (frontmatter.steps as any[]).map((step) => ({
          name: String(step.name || ""),
          parameters: step.parameters || {},
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
  private static parseToolDefinition(yamlBlock: string): { toolId: string; parameters: Record<string, any> } {
    const lines = yamlBlock.split("\n").filter((line) => line.trim() && !line.trim().startsWith("#"));
    
    let toolId = "";
    const parameters: Record<string, any> = {};
    let inParameters = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("tool:")) {
        const match = trimmed.match(/tool:\s*['"](.*?)['"]/) || trimmed.match(/tool:\s*(\S+)/);
        if (match) {
          toolId = match[1];
        }
      } else if (trimmed.startsWith("parameters:")) {
        inParameters = true;
      } else if (inParameters && trimmed.match(/^\w+:/)) {
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
  private static parseParameters(params: any[]): Parameter[] {
    if (!Array.isArray(params)) {
      return [];
    }

    return params.map((p) => ({
      name: String(p.name || ""),
      type: (p.type || "string") as ParameterType,
      description: p.description ? String(p.description) : undefined,
      required: p.required !== false,
      default: p.default !== undefined ? p.default : undefined,
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
        // Neuer Step
        if (currentStep && currentStep.name) {
          steps.push(currentStep as Step);
        }
        const nameMatch = trimmed.match(/- name:\s*['"](.*?)['"]/) || 
                         trimmed.match(/- name:\s*(\S+)/);
        currentStep = {
          name: nameMatch ? nameMatch[1] : "",
          parameters: {},
        };
      } else if (trimmed.startsWith("parameters:")) {
        // Parameters-Section folgt
        // Wird in nächsten Iterationen behandelt
      } else if (
        currentStep &&
        trimmed.match(/^\w+:/) &&
        !trimmed.includes("steps:")
      ) {
        // Parameter hinzufügen
        const [key, value] = this.parseKeyValue(trimmed);
        if (key && currentStep.parameters) {
          currentStep.parameters[key] = value;
        }
      }
    }

    // Letzten Step hinzufügen
    if (currentStep && currentStep.name) {
      steps.push(currentStep as Step);
    }

    return steps;
  }
}

export default YAMLParser;

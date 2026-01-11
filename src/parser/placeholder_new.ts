/**
 * Placeholder Replacement - Ersetzt {{placeholders}} mit Werten
 * Unterstützt:
 * - {{param_name}} → User-Parameter
 * - {{prev_step.output}} → Output vom vorherigen Step
 * - {{prev_step.output.field}} → Nested Fields
 * - {{prev_step.output.results[0].path}} → Array-Zugriff
 * - {{date}} → YYYY-MM-DD
 * - {{time}} → HH:mm:ss
 * - {{random_id}} → UUID
 */

import { PlaceholderContext } from "../types";

export class PlaceholderReplacer {
  /**
   * Findet alle Platzhalter in einem String
   * Regex: {{...}} (auch mit Punkten, Klammern für nested/array access)
   */
  private static findPlaceholders(str: string): string[] {
    const regex = /\{\{([a-zA-Z0-9_.\[\]]+)\}\}/g;
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(str)) !== null) {
      const placeholder = match[1];
      if (placeholder) {
        matches.push(placeholder);
      }
    }

    return matches;
  }

  /**
   * Parse einen Pfad mit Array-Syntax
   * Z.B. "prev_step.output.results[0].path" -> ["prev_step", "output", "results", "0", "path"]
   */
  private static parsePath(path: string): string[] {
    // Ersetze Array-Syntax [n] mit .n
    const normalized = path.replace(/\[(\d+)\]/g, ".$1");
    return normalized.split(".").filter((p) => p.length > 0);
  }

  /**
   * Holt einen Wert aus dem Kontext
   * Unterstuetzt nested access: "prev_step.output.field" und Array-Indizes: "results[0].path"
   */
  private static getValue(context: PlaceholderContext, path: string): any {
    const parts = this.parsePath(path);

    if (parts.length === 0) {
      return null;
    }

    const firstPart = parts[0];

    // Spezielle Kontexte
    if (firstPart === "date") {
      return context.date;
    }
    if (firstPart === "time") {
      return context.time;
    }
    if (firstPart === "random_id") {
      return context.randomId;
    }

    // Parameter-Zugriff
    if (firstPart === "param_name" || (firstPart.match(/^param_/))) {
      const paramName = firstPart === "param_name" ? parts.slice(1).join(".") : path;
      return context.parameters[paramName];
    }

    // prev_step.output... Zugriff
    if (firstPart === "prev_step") {
      let current = context.previousStepOutputs;
      for (let i = 1; i < parts.length; i++) {
        if (current === null || current === undefined) {
          return null;
        }
        const part = parts[i];
        current = current[part];
      }
      return current;
    }

    // Fallback: Direkt Parameter zugreifen
    return context.parameters[path];
  }

  /**
   * Konvertiert einen Wert zu String (für Replacement)
   */
  private static valueToString(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Ersetzt {{placeholders}} in einem String
   */
  static replacePlaceholdersInString(
    str: string,
    context: PlaceholderContext
  ): string {
    const placeholders = this.findPlaceholders(str);

    let result = str;
    for (const placeholder of placeholders) {
      const value = this.getValue(context, placeholder);
      const stringValue = this.valueToString(value);
      result = result.replace(`{{${placeholder}}}`, stringValue);
    }

    return result;
  }

  /**
   * Ersetzt {{placeholders}} in einem Objekt (rekursiv)
   */
  static replacePlaceholdersInObject(
    obj: any,
    context: PlaceholderContext
  ): any {
    if (typeof obj === "string") {
      return this.replacePlaceholdersInString(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replacePlaceholdersInObject(item, context));
    }

    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholdersInObject(value, context);
      }
      return result;
    }

    return obj;
  }

  /**
   * Erstellt einen Placeholder-Kontext aus Parametern
   */
  static createContext(
    parameters: Record<string, any>,
    previousStepOutputs: Record<string, any>
  ): PlaceholderContext {
    return {
      parameters,
      previousStepOutputs,
      date: new Date().toISOString().split("T")[0] || "",
      time: (new Date().toISOString().split("T")[1]?.split(".")[0]) || "",
      randomId: Math.random().toString(36).substring(7) || "",
    };
  }

  /**
   * Findet alle Platzhalter in einem String und gibt ihre Pfade zurück
   */
  static findPlaceholderMatches(str: string): Array<{ placeholder: string; value: any; path: string }> {
    const context: PlaceholderContext = {
      parameters: {},
      previousStepOutputs: {},
      date: "",
      time: "",
      randomId: "",
    };

    const placeholders = this.findPlaceholders(str);
    return placeholders.map((placeholder) => ({
      placeholder,
      value: null,
      path: placeholder,
    }));
  }
}

export default PlaceholderReplacer;

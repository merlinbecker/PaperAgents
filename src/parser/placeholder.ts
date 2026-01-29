/**
 * Placeholder Replacement - replaces {{placeholders}} with values.
 * Supports:
 * - {{param_name}} -> user parameters
 * - {{prev_step.output}} -> output of last step
 * - {{prev_step.output.results[0].path}} -> array access
 * - direct step reference: {{search_files.results[0].path}}
 * - {{date}}, {{time}}, {{random_id}}
 */

import { PlaceholderContext } from "../types";

export class PlaceholderReplacer {
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

  private static parsePath(path: string): string[] {
    const normalized = path.replace(/\[(\d+)\]/g, ".$1");
    return normalized.split(".").filter((p) => p.length > 0);
  }

  private static getValue(context: PlaceholderContext, path: string): any {
    const parts = this.parsePath(path);
    if (parts.length === 0) {
      return null;
    }

    const first = parts[0];
    if (!first) {
      return null;
    }

    // simple specials
    if (first === "date") return context.date;
    if (first === "time") return context.time;
    if (first === "random_id") return context.randomId;

    // param_x or param_name
    if (first === "param_name" || first.startsWith("param_")) {
      const paramName = first === "param_name" ? parts.slice(1).join(".") : path;
      return context.parameters[paramName];
    }

    // prev_step.*
    if (first === "prev_step") {
      let current: any = (context.previousStepOutputs as any).prev_step || (context.previousStepOutputs as any).__last;
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (current === null || current === undefined || !part) return null;
        current = current[part];
      }
      return current;
    }

    // direct step reference by name
    let current: any = (context.previousStepOutputs as any)[first];
    if (current !== undefined) {
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (current === null || current === undefined || !part) return null;
        current = current[part];
      }
      return current;
    }

    // fallback to parameters
    return context.parameters[path];
  }

  private static valueToString(value: any): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  static replacePlaceholdersInString(str: string, context: PlaceholderContext): string {
    const placeholders = this.findPlaceholders(str);
    let result = str;
    for (const placeholder of placeholders) {
      const value = this.getValue(context, placeholder);
      const stringValue = this.valueToString(value);
      result = result.replace(`{{${placeholder}}}`, stringValue);
    }
    return result;
  }

  static replacePlaceholdersInObject(obj: any, context: PlaceholderContext): any {
    if (typeof obj === "string") return this.replacePlaceholdersInString(obj, context);
    if (Array.isArray(obj)) return obj.map((item) => this.replacePlaceholdersInObject(item, context));
    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholdersInObject(value, context);
      }
      return result;
    }
    return obj;
  }

  static createContext(parameters: Record<string, any>, previousStepOutputs: Record<string, any>): PlaceholderContext {
    return {
      parameters,
      previousStepOutputs,
      date: new Date().toISOString().split("T")[0] || "",
      time: (new Date().toISOString().split("T")[1]?.split(".")[0]) || "",
      randomId: Math.random().toString(36).substring(7) || "",
    };
  }

  static findPlaceholderMatches(str: string): Array<{ placeholder: string; value: any; path: string }> {
    const placeholders = this.findPlaceholders(str);
    return placeholders.map((placeholder) => ({ placeholder, value: null, path: placeholder }));
  }
}

export default PlaceholderReplacer;

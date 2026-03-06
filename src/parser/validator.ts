/**
 * Parameter Validator - Validiert User-Input gegen Parameter-Definitionen
 * Unterstützt: string, number, boolean, array, object
 */

import { Parameter, ValidationResult, ValidationError } from "../types";

export class ParameterValidator {
  /**
   * Validiert einen einzelnen Parameter-Wert
   */
  private static validateValue(
    value: unknown,
    param: Parameter
  ): ValidationError | null {
    // Required-Check
    if (param.required && (value === null || value === undefined || value === "")) {
      return {
        field: param.name,
        message: `Required field: "${param.name}"`,
        value,
      };
    }

    // Wenn nicht required und leer/null, skip
    if (!param.required && (value === null || value === undefined || value === "")) {
      return null;
    }

    // Type-spezifische Validierung
    switch (param.type) {
      case "string":
        return this.validateString(value, param);
      case "number":
        return this.validateNumber(value, param);
      case "boolean":
        return this.validateBoolean(value, param);
      case "array":
        return this.validateArray(value, param);
      case "object":
        return this.validateObject(value, param);
      default:
        return null;
    }
  }

  /**
   * Validiert string-Typ
   */
  private static validateString(value: unknown, param: Parameter): ValidationError | null {
    if (typeof value !== "string") {
      return {
        field: param.name,
        message: `Expected string, got ${typeof value}`,
        value,
      };
    }
    return null;
  }

  /**
   * Validiert number-Typ
   */
  private static validateNumber(value: unknown, param: Parameter): ValidationError | null {
    const num = Number.parseFloat(String(value));

    if (Number.isNaN(num)) {
      return {
        field: param.name,
        message: `Expected number, got "${String(value)}"`,
        value,
      };
    }

    return null;
  }

  /**
   * Validiert boolean-Typ
   */
  private static validateBoolean(value: unknown, param: Parameter): ValidationError | null {
    if (typeof value !== "boolean") {
      // Versuche zu konvertieren
      if (value === "true" || value === 1 || value === "1") {
        return null; // Akzeptiert
      }
      if (value === "false" || value === 0 || value === "0") {
        return null; // Akzeptiert
      }

      return {
        field: param.name,
        message: `Expected boolean, got ${typeof value}`,
        value,
      };
    }
    return null;
  }

  /**
   * Validiert array-Typ
   */
  private static validateArray(value: unknown, param: Parameter): ValidationError | null {
    if (!Array.isArray(value)) {
      // Versuche zu parsen, falls String
      if (typeof value === "string") {
        try {
          JSON.parse(value);
          return null; // Valid JSON Array
        } catch {
          return {
            field: param.name,
            message: `Expected array or valid JSON array string`,
            value,
          };
        }
      }

      return {
        field: param.name,
        message: `Expected array, got ${typeof value}`,
        value,
      };
    }
    return null;
  }

  /**
   * Validiert object-Typ
   */
  private static validateObject(value: unknown, param: Parameter): ValidationError | null {
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      return null; // Valid object
    }

    // Versuche zu parsen, falls String
    if (typeof value === "string") {
      try {
        const parsed: unknown = JSON.parse(value) as unknown;
        if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
          return null; // Valid JSON object
        }
      } catch {
        return {
          field: param.name,
          message: `Expected object or valid JSON object string`,
          value,
        };
      }
    }

    return {
      field: param.name,
      message: `Expected object, got ${typeof value}`,
      value,
    };
  }

  /**
   * Validiert alle Parameter gegen Eingaben
   */
  static validateParameters(
    parameters: Parameter[],
    input: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const param of parameters) {
      const value = input[param.name];
      const error = this.validateValue(value, param);

      if (error) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Konvertiert Input-Werte zu korrekten Typen
   * (z.B. JSON-String zu Object)
   */
  static normalizeInput(
    parameters: Parameter[],
    input: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const param of parameters) {
      const raw = input[param.name] ?? param.default;
      result[param.name] = this.normalizeValue(param.type, raw);
    }

    return result;
  }

  private static normalizeValue(type: string, value: unknown): unknown {
    switch (type) {
      case "number": return this.normalizeNumber(value);
      case "boolean": return this.normalizeBoolean(value);
      case "array": return this.normalizeArray(value);
      case "object": return this.normalizeObject(value);
      default: return this.normalizeString(value);
    }
  }

  private static normalizeNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return Number.parseFloat(value);
    if (typeof value === "number" || typeof value === "boolean") return Number.parseFloat(String(value));
    return 0;
  }

  private static normalizeBoolean(value: unknown): boolean {
    if (typeof value === "string") return value === "true" || value === "1";
    return !!value;
  }

  private static normalizeArray(value: unknown): unknown {
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return []; }
    }
    if (Array.isArray(value)) return value;
    return [];
  }

  private static normalizeObject(value: unknown): unknown {
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch { return {}; }
    }
    if (typeof value === "object" && value !== null) return value;
    return {};
  }

  private static normalizeString(value: unknown): string {
    if (value !== null && value !== undefined &&
        (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      return String(value);
    }
    return "";
  }

  /**
   * Prüft, ob ein Parametername optional ist
   */
  static isRequired(parameter: Parameter): boolean {
    return parameter.required === true;
  }

  /**
   * Generiert ein Fehler-Hinweis basierend auf Validierung
   */
  static getHintForField(param: Parameter): string {
    let hint = `Type: ${param.type}`;

    if (param.required) {
      hint += " (required)";
    } else {
      hint += " (optional)";
    }

    if (param.default !== undefined) {
      hint += ` - Default: ${JSON.stringify(param.default)}`;
    }

    if (param.description) {
      hint += ` - ${param.description}`;
    }

    return hint;
  }
}

export default ParameterValidator;

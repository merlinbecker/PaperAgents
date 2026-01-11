/**
 * Parameter Validator - Validiert User-Input gegen Parameter-Definitionen
 * Unterstützt: string, number, boolean, array, object
 */

import { Parameter, ParameterType, ValidationResult, ValidationError } from "../types";

export class ParameterValidator {
  /**
   * Validiert einen einzelnen Parameter-Wert
   */
  private static validateValue(
    value: any,
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
  private static validateString(value: any, param: Parameter): ValidationError | null {
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
  private static validateNumber(value: any, param: Parameter): ValidationError | null {
    const num = parseFloat(value);

    if (isNaN(num)) {
      return {
        field: param.name,
        message: `Expected number, got "${value}"`,
        value,
      };
    }

    return null;
  }

  /**
   * Validiert boolean-Typ
   */
  private static validateBoolean(value: any, param: Parameter): ValidationError | null {
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
  private static validateArray(value: any, param: Parameter): ValidationError | null {
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
  private static validateObject(value: any, param: Parameter): ValidationError | null {
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      return null; // Valid object
    }

    // Versuche zu parsen, falls String
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
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
    input: Record<string, any>
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
    input: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const param of parameters) {
      let value = input[param.name];

      // Default-Wert verwenden, falls nicht vorhanden
      if (value === null || value === undefined) {
        value = param.default;
      }

      // Type-Konversion
      switch (param.type) {
        case "number":
          result[param.name] = value !== null && value !== undefined ? parseFloat(value) : 0;
          break;

        case "boolean":
          if (typeof value === "string") {
            result[param.name] = value === "true" || value === "1";
          } else {
            result[param.name] = !!value;
          }
          break;

        case "array":
          if (typeof value === "string") {
            try {
              result[param.name] = JSON.parse(value);
            } catch {
              result[param.name] = [];
            }
          } else if (Array.isArray(value)) {
            result[param.name] = value;
          } else {
            result[param.name] = [];
          }
          break;

        case "object":
          if (typeof value === "string") {
            try {
              result[param.name] = JSON.parse(value);
            } catch {
              result[param.name] = {};
            }
          } else if (typeof value === "object" && value !== null) {
            result[param.name] = value;
          } else {
            result[param.name] = {};
          }
          break;

        default:
          // string
          result[param.name] = value !== null && value !== undefined ? String(value) : "";
      }
    }

    return result;
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

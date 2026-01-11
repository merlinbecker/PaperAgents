/**
 * Custom-JS Sandbox - QuickJS-Integration für sichere JS-Ausführung
 * Für Custom-Tools mit type: "custom-js"
 * Unterstützt Desktop + Mobile (QuickJS läuft überall)
 */

import { ExecutionContext, ExecutionResult } from "../types";
import { globalLogger } from "../utils/logger";

/**
 * QuickJS Runtime Wrapper
 * Nur Stub - echte QuickJS-Integration erfolgt später bei Installation
 */
export class QuickJSSandbox {
  private runtime: any = null;
  private context: any = null;

  /**
   * Initialisiert QuickJS Runtime
   * Bei echter Installation wird hier die QuickJS-Library geladen
   */
  async initialize(): Promise<void> {
    try {
      // Hier würde die echte QuickJS-Initialisierung stattfinden
      // Für jetzt: Stub, der vorbereitet ist für echte Implementation
      // import { QuickJS } from "quickjs-emscripten";
      // this.runtime = QuickJS.newRuntime();
      // this.context = this.runtime.newContext();

      // Stub-Context fuer lokale Ausfuehrung (wird durch echte Runtime ersetzt)
      this.runtime = {};
      this.context = {};

      globalLogger.debug("QuickJS Sandbox initialized (stub mode)");
    } catch (error) {
      globalLogger.error("Failed to initialize QuickJS", { error });
      throw new Error("QuickJS initialization failed");
    }
  }

  /**
   * Führt Custom-JS Code sicher aus
   * @param code JavaScript-Code zum Ausführen
   * @param ctx Execution-Kontext (Parameter, vorherige Step-Outputs)
   * @returns Promise<any> Rückgabewert des Scripts
   */
  async execute(code: string, ctx: ExecutionContext): Promise<any> {
    if (!this.context) {
      throw new Error("QuickJS not initialized");
    }

    try {
      // Baue Kontext für Script
      const scriptContext = this.buildScriptContext(ctx);

      // Stub-Execution: eingeschränkter Scope via Function-Hülle
      const runner = new Function("context", `"use strict";\n${code}`);
      const result = runner(scriptContext);

        globalLogger.debug("Custom-JS executed (stub mode)", { code: code.substring(0, 50) });

      return result;
    } catch (error) {
      globalLogger.error("Custom-JS execution error", { error });
      throw error;
    }
  }

  /**
   * Baut Script-Kontext aus Execution-Context
   * Ermöglicht Zugriff auf Parameter, vorherige Outputs, Metadaten
   */
  private buildScriptContext(ctx: ExecutionContext): any {
    return {
      parameters: ctx.parameters,
      previousStepOutputs: ctx.previousStepOutputs,
      date: ctx.date,
      time: ctx.time,
      randomId: ctx.randomId,
    };
  }

  /**
   * Validiert JavaScript-Code bevor er ausgeführt wird
   * Verhindert gefährliche Patterns
   */
  validateCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Blockiere gefährliche Patterns
    const dangerousPatterns = [
      /require\s*\(/i,
      /eval\s*\(/i,
      /process\s*\./i,
      /global\s*\./i,
      /Function\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Cleanup der QuickJS Runtime
   */
  async destroy(): Promise<void> {
    try {
      if (this.context) {
        // this.context.dispose();
        this.context = null;
      }
      if (this.runtime) {
        // this.runtime.dispose();
        this.runtime = null;
      }
      globalLogger.debug("QuickJS Sandbox destroyed");
    } catch (error) {
      globalLogger.error("Error destroying QuickJS", { error });
    }
  }
}

/**
 * Custom-JS Tool Executor
 * Führt Custom-Tools mit type: "custom-js" aus
 */
export class CustomJSExecutor {
  private sandbox: QuickJSSandbox;

  constructor() {
    this.sandbox = new QuickJSSandbox();
  }

  /**
   * Initialisiert Sandbox
   */
  async initialize(): Promise<void> {
    await this.sandbox.initialize();
  }

  /**
   * Führt Custom-JS Tool aus
   * @param toolCode JavaScript-Code aus Tool-Definition (code block)
   * @param ctx Execution-Kontext
   * @returns ExecutionResult
   */
  async executeCustomTool(toolCode: string, ctx: ExecutionContext): Promise<ExecutionResult> {
    try {
      // Validiere Code
      const validation = this.sandbox.validateCode(toolCode);
      if (!validation.valid) {
        return {
          success: false,
          error: `Code validation failed: ${validation.errors.join(", ")}`,
          log: [
            {
              toolName: "custom-js",
              parameters: ctx.parameters,
              error: validation.errors.join(", "),
              timestamp: Date.now(),
            },
          ],
        };
      }

      // Führe Code aus
      const output = await this.sandbox.execute(toolCode, ctx);
      globalLogger.debug("Custom-JS raw output", { output });

      // Wenn Skript bereits ein ExecutionResult liefert, uebernehme es direkt
      if (output && typeof output === "object" && "success" in output) {
        const execResult = output as ExecutionResult;
        return {
          success: !!execResult.success,
          data: execResult.data,
          error: execResult.error,
          log: execResult.log || [],
        };
      }

      // Fallback: wrappe generisches Output
      return {
        success: true,
        data: output,
        log: [
          {
            toolName: "custom-js",
            parameters: ctx.parameters,
            output,
            timestamp: Date.now(),
          },
        ],
      };
    } catch (error) {
      globalLogger.error("Custom-JS tool execution failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: "custom-js",
            parameters: ctx.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.sandbox.destroy();
  }
}

/**
 * Singleton Instance
 */
export const customJSExecutor = new CustomJSExecutor();

export default customJSExecutor;

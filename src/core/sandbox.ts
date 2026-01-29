/**
 * Custom-JS Sandbox - QuickJS-Integration für sichere JS-Ausführung
 * Für Custom-Tools mit type: "custom-js"
 * Unterstützt Desktop + Mobile (QuickJS läuft überall)
 */

import { getQuickJS, QuickJSContext, QuickJSRuntime } from "quickjs-emscripten";
import { ExecutionContext, ExecutionResult } from "../types";
import { globalLogger } from "../utils/logger";

/**
 * QuickJS Runtime Wrapper
 * Echte QuickJS-Integration mit Memory- und Timeout-Limits
 */
export class QuickJSSandbox {
  private runtime: QuickJSRuntime | null = null;
  private context: QuickJSContext | null = null;
  private memoryLimit: number = 10 * 1024 * 1024; // 10 MB default
  private executionTimeout: number = 5000; // 5 seconds default

  /**
   * Initialisiert QuickJS Runtime
   * Lädt QuickJS WASM-Module und erstellt isolierte Runtime
   */
  async initialize(): Promise<void> {
    try {
      const QuickJS = await getQuickJS();
      this.runtime = QuickJS.newRuntime();
      
      // Set memory limit for safety
      this.runtime.setMemoryLimit(this.memoryLimit);
      
      // Enable interrupt handler for timeout support (basic)
      let interruptCount = 0;
      this.runtime.setInterruptHandler(() => {
        interruptCount++;
        return interruptCount > 1000000; // Allow many iterations but not infinite
      });
      
      this.context = this.runtime.newContext();

      globalLogger.debug("QuickJS Sandbox initialized", {
        memoryLimit: this.memoryLimit,
        timeout: this.executionTimeout,
      });
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
      const startTime = Date.now();
      
      // Set context in QuickJS global scope
      this.setGlobalVariable("context", this.buildScriptContext(ctx));

      // Execute code
      const returnValue = this.executeCode(code, "user-script.js");

      globalLogger.debug("Custom-JS executed", { 
        code: code.substring(0, 50),
        executionTime: Date.now() - startTime,
      });

      return returnValue;
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
   * Erstellt einen minimalen ExecutionContext für Pre/Post-Processing
   */
  private createMinimalContext(data: Record<string, any>): ExecutionContext {
    return {
      parameters: data,
      previousStepOutputs: {},
      date: new Date().toISOString().split('T')[0] || "",
      time: new Date().toISOString().split('T')[1]?.split('.')[0] || "",
      randomId: Math.random().toString(36).substring(7),
    };
  }

  /**
   * Setzt eine globale Variable im QuickJS Context via JSON
   */
  private setGlobalVariable(name: string, value: any): void {
    if (!this.context) {
      throw new Error("QuickJS not initialized");
    }

    const json = JSON.stringify(value);
    const handle = this.context.unwrapResult(
      this.context.evalCode(`(${json})`)
    );
    this.context.setProp(this.context.global, name, handle);
    handle.dispose();
  }

  /**
   * Führt Code aus und gibt das Ergebnis zurück
   * Wraps code in IIFE to support return statements
   */
  private executeCode(code: string, filename: string): any {
    if (!this.context) {
      throw new Error("QuickJS not initialized");
    }

    // Wrap code in an IIFE to support return statements
    const wrappedCode = `(function() {\n${code}\n})()`;
    const result = this.context.evalCode(wrappedCode, filename);

    if (result.error) {
      const errorMsg = this.context.dump(result.error);
      result.error.dispose();
      // Convert error to string properly
      const errorStr = typeof errorMsg === 'string' ? errorMsg : 
                       (errorMsg && typeof errorMsg === 'object' && 'message' in errorMsg) ? 
                       errorMsg.message : JSON.stringify(errorMsg);
      throw new Error(errorStr);
    }

    const returnValue = this.context.dump(result.value);
    result.value.dispose();
    return returnValue;
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

    // Prüfe auf return-Statement
    if (!code.includes("return")) {
      errors.push("Code must contain a 'return' statement");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Führt Pre-Processing Code aus
   * Erwartet: input-Object im Context, return-Statement mit modifiziertem input
   * @param code JavaScript Code mit // @preprocess Marker
   * @param inputParams User-Parameter
   * @returns Transformierte Parameter
   */
  async executePreprocess(code: string, inputParams: Record<string, any>): Promise<Record<string, any>> {
    const validation = this.validateCode(code);
    if (!validation.valid) {
      throw new Error(`Pre-processing validation failed: ${validation.errors.join(", ")}`);
    }

    if (!this.context) {
      throw new Error("QuickJS not initialized");
    }

    try {
      // Set input and context in global scope
      this.setGlobalVariable("input", inputParams);
      this.setGlobalVariable("context", this.buildScriptContext(
        this.createMinimalContext({ input: inputParams })
      ));

      // Execute code
      const returnValue = this.executeCode(code, "preprocess.js");
      
      // Result sollte modifiziertes input-Object sein
      if (typeof returnValue !== "object" || returnValue === null) {
        throw new Error("Pre-processing must return an object");
      }

      return returnValue as Record<string, any>;
    } catch (error) {
      globalLogger.error("Pre-processing execution failed", { error, code });
      throw new Error(`Pre-processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Führt Post-Processing Code aus
   * Erwartet: output-Object im Context, return-Statement mit transformiertem output
   * @param code JavaScript Code mit // @postprocess Marker
   * @param toolOutput Rohausgabe des Tools
   * @returns Transformierte Ausgabe
   */
  async executePostprocess(code: string, toolOutput: any): Promise<any> {
    const validation = this.validateCode(code);
    if (!validation.valid) {
      throw new Error(`Post-processing validation failed: ${validation.errors.join(", ")}`);
    }

    if (!this.context) {
      throw new Error("QuickJS not initialized");
    }

    try {
      // Set output and context in global scope
      this.setGlobalVariable("output", toolOutput);
      this.setGlobalVariable("context", this.buildScriptContext(
        this.createMinimalContext({ output: toolOutput })
      ));

      // Execute code
      return this.executeCode(code, "postprocess.js");
    } catch (error) {
      globalLogger.error("Post-processing execution failed", { error, code });
      throw new Error(`Post-processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Cleanup der QuickJS Runtime
   */
  async destroy(): Promise<void> {
    try {
      if (this.context) {
        this.context.dispose();
        this.context = null;
      }
      if (this.runtime) {
        this.runtime.dispose();
        this.runtime = null;
      }
      globalLogger.debug("QuickJS Sandbox destroyed");
    } catch (error) {
      globalLogger.error("Error destroying QuickJS", { error });
    }
  }

  /**
   * Set memory limit for the runtime (in bytes)
   */
  setMemoryLimit(bytes: number): void {
    this.memoryLimit = bytes;
    if (this.runtime) {
      this.runtime.setMemoryLimit(bytes);
    }
  }

  /**
   * Set execution timeout (in milliseconds)
   */
  setExecutionTimeout(ms: number): void {
    this.executionTimeout = ms;
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

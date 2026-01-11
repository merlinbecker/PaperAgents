/**
 * Tool Executor - Orchestrierung von Single & Chain Workflows
 * Verwaltet Ausführung, State-Sharing, HITL-Entscheidungen
 */

import { IExecutableTool, ExecutionContext, ExecutionResult, Agent, Step } from "../types";
import { globalLogger } from "../utils/logger";
import { customJSExecutor } from "./sandbox";
import PlaceholderReplacer from "../parser/placeholder";

interface PlaceholderContext {
  parameters: Record<string, any>;
  previousStepOutputs: Record<string, any>;
  date: string;
  time: string;
  randomId: string;
}

/**
 * HITL Decision Interface
 * Wird an UI-Layer für Benutzer-Bestätigung übergeben
 */
export interface HITLDecision {
  approved: boolean;
  tool: string;
  step: string;
  parameters: Record<string, any>;
  reason?: string;
}

/**
 * Tool Executor - Orchestriert Agent-Ausführung
 */
export class ToolExecutor {
  private hitlCallbacks: Map<string, (decision: HITLDecision) => Promise<void>> = new Map();
  private customJsInitialized = false;

  /**
   * Registriert HITL-Callback für externe Bestätigung
   * Wird von UI-Layer aufgerufen (Modal, Sidebar)
   */
  registerHITLCallback(
    stepId: string,
    callback: (decision: HITLDecision) => Promise<void>
  ): void {
    this.hitlCallbacks.set(stepId, callback);
  }

  /**
   * Führt kompletten Agent aus (Single oder Chain)
   * @param agent Agent mit Steps
   * @param toolRegistry Tool-Registry (get()-Methode)
   * @param userParameters Benutzer-Input Parameter
   * @returns ExecutionResult mit allen Logs
   */
  async executeAgent(
    agent: Agent,
    toolRegistry: any, // ToolRegistry
    userParameters: Record<string, any>
  ): Promise<ExecutionResult> {
    const executionId = `${agent.name}-${Date.now()}`;
    const startTime = Date.now();
    const allLogs: any[] = [];
    const stepOutputs: Map<string, any> = new Map();

    try {
      globalLogger.info(`Starting agent execution: ${agent.name}`, { executionId });

      // Validiere Input-Parameter gegen Agent-Definition
      const validationErrors = this.validateInputParameters(agent.parameters, userParameters);
      if (validationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${validationErrors.join(", ")}`);
      }

      // Single-Tool mit Custom-JS direkt ausfuehren
      if (agent.type === "single" && agent.customFunction) {
        const context = this.buildSingleExecutionContext(userParameters);
        const singleResult = await this.executeCustomSingle(agent, context);
        const duration = Date.now() - startTime;
        const normalizedOutput = this.unwrapExecutionData(singleResult.data);

        if (singleResult.success) {
          globalLogger.info(`Agent execution completed: ${agent.name}`, {
            executionId,
            duration,
            steps: 0,
          });

          return {
            success: true,
            data: {
              executionId,
              agent: agent.name,
              steps: 0,
              output: normalizedOutput,
              duration,
            },
            log: singleResult.log || [],
          };
        }

        return {
          success: false,
          error: singleResult.error || "Custom tool execution failed",
          log: singleResult.log || [],
        };
      }

      // Führe jeden Step sequenziell aus
      const steps = agent.steps || [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step) continue;

        globalLogger.debug(`Executing step ${i + 1}/${steps.length}: ${step.name}`, {
          stepIndex: i,
        });

        // Baue Execution-Context mit Placeholder-Replacement
        const context = this.buildExecutionContext(
          agent,
          step,
          userParameters,
          stepOutputs,
          executionId
        );

        // Führe Step aus
        const result = await this.executeStep(step, context, toolRegistry);

        // Sammle Logs
        if (result.log) {
          allLogs.push(...result.log);
        }

        // Speichere Output für nächste Steps
        if (result.success) {
          stepOutputs.set(step.name, result.data);
        } else {
        // Bei Fehler abbrechen (continueOnError noch nicht implementiert)
        if (true) {
            throw new Error(
              `Step ${step?.name} failed: ${result.error || "Unknown error"}`
            );
          }
          globalLogger.warn(`Step ${step?.name} failed, continuing...`, {
            error: result.error,
          });
        }
      }

      const duration = Date.now() - startTime;

      globalLogger.info(`Agent execution completed: ${agent.name}`, {
        executionId,
        duration,
        steps: (agent.steps?.length) || 0,
      });

      return {
        success: true,
        data: {
          executionId,
          agent: agent.name,
          steps: (agent.steps?.length) || 0,
          outputs: Object.fromEntries(stepOutputs),
          duration,
        },
        log: allLogs,
      };
    } catch (error) {
      globalLogger.error(`Agent execution failed: ${agent.name}`, {
        executionId,
        error,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: allLogs,
      };
    }
  }

  /**
   * Führt einzelnen Step aus
   * Behandelt HITL-Entscheidungen
   */
  private async executeStep(
    step: Step,
    context: ExecutionContext,
    toolRegistry: any
  ): Promise<ExecutionResult> {
    try {
      // Hole Tool - Step.parameters hat toolId
      // Für jetzt: verwende step.parameters.tool wenn vorhanden
      const toolId = step.parameters?.tool || step.name;
      const tool = toolRegistry.getTool(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      // Prüfe ob HITL erforderlich
      if (tool.shouldRequireHITL && tool.shouldRequireHITL(context.parameters)) {
        const decision = await this.requestHITLApproval(step.name, tool.name, context.parameters);

        if (!decision.approved) {
          globalLogger.info(`HITL decision: REJECTED`, {
            stepName: step.name,
            reason: decision.reason,
          });

          return {
            success: false,
            error: `User rejected tool execution: ${decision.reason || "No reason provided"}`,
            log: [
              {
                toolName: tool.name,
                parameters: context.parameters,
                error: "HITL rejected",
                timestamp: Date.now(),
              },
            ],
          };
        }

        globalLogger.info(`HITL decision: APPROVED`, { stepName: step.name });
      }

      // Führe Tool aus
      const result = await tool.execute(context);

      return result;
    } catch (error) {
      globalLogger.error(`Step execution error: ${step.name}`, { error });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        log: [
          {
            toolName: step.name,
            parameters: context.parameters,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  /**
   * Baut Execution-Context mit Placeholder-Replacement
   * Ersetzt {{param}}, {{prev_step.output}}, {{date}}, {{time}}, {{random_id}}
   */
  private buildExecutionContext(
    agent: Agent,
    step: Step,
    userParameters: Record<string, any>,
    stepOutputs: Map<string, any>,
    executionId: string
  ): ExecutionContext {
    // Baue PlaceholderContext
    const previousOutputsObj = Object.fromEntries(stepOutputs);
    const entries = Array.from(stepOutputs.entries());
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      // Hinterlege letztes Step-Resultat zur Verwendung via prev_step.output
      (previousOutputsObj as any).prev_step = { output: lastEntry[1] };
      (previousOutputsObj as any).__last = lastEntry[1];
    }

    const placeholderCtx: PlaceholderContext = PlaceholderReplacer.createContext(
      userParameters,
      previousOutputsObj
    );

    // Ersetze Placeholders in Step-Parametern
    const processedParameters = PlaceholderReplacer.replacePlaceholdersInObject(
      step.parameters,
      placeholderCtx
    ) as Record<string, any>;

    return {
      parameters: processedParameters,
      previousStepOutputs: Object.fromEntries(stepOutputs),
      date: new Date().toISOString().split('T')[0] || "",
      time: (new Date().toISOString().split('T')[1]?.split('.')[0]) || "",
      randomId: Math.random().toString(36).substring(7) || "",
    };
  }

  /**
   * Fordert HITL-Bestätigung vom Benutzer an
   * Blockiert bis Entscheidung getroffen wird
   */
  private async requestHITLApproval(
    stepName: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<HITLDecision> {
    return new Promise((resolve) => {
      // Callbacks werden von UI-Layer registriert (Modal, Sidebar)
      const callback = this.hitlCallbacks.get(stepName);

      if (callback) {
        const decision: HITLDecision = {
          approved: false,
          tool: toolName,
          step: stepName,
          parameters,
        };

        callback(decision).then(() => {
          resolve(decision);
        });
      } else {
        // Fallback: Auto-reject wenn kein Callback registriert
        globalLogger.warn("No HITL callback registered, auto-rejecting", {
          stepName,
        });

        resolve({
          approved: false,
          tool: toolName,
          step: stepName,
          parameters,
          reason: "No HITL handler registered (no callback)",
        });
      }
    });
  }

  /**
   * Validiert Input-Parameter gegen Agent-Definition
   */
  private validateInputParameters(
    agentParams: any[],
    userParams: Record<string, any>
  ): string[] {
    const errors: string[] = [];

    for (const param of agentParams) {
      if (param.required && !(param.name in userParams)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    return errors;
  }

  /**
   * Baut Execution-Context fuer Single-Tools (ohne Steps)
   */
  private buildSingleExecutionContext(
    userParameters: Record<string, any>
  ): ExecutionContext {
    const placeholderCtx: PlaceholderContext = PlaceholderReplacer.createContext(
      userParameters,
      {}
    );

    const processedParameters = PlaceholderReplacer.replacePlaceholdersInObject(
      userParameters,
      placeholderCtx
    ) as Record<string, any>;

    return {
      parameters: processedParameters,
      previousStepOutputs: {},
      date: new Date().toISOString().split('T')[0] || "",
      time: (new Date().toISOString().split('T')[1]?.split('.')[0]) || "",
      randomId: Math.random().toString(36).substring(7) || "",
    };
  }

  /**
   * Custom-JS Single-Tool Ausfuehrung ueber Sandbox
   */
  private async executeCustomSingle(agent: Agent, ctx: ExecutionContext): Promise<ExecutionResult> {
    if (!this.customJsInitialized) {
      await customJSExecutor.initialize();
      this.customJsInitialized = true;
    }

    return customJSExecutor.executeCustomTool(agent.customFunction || "", ctx);
  }

  /**
   * Entpackt verschachtelte ExecutionResult-Daten
   */
  private unwrapExecutionData(data: any): any {
    if (data && typeof data === "object" && "data" in (data as any) && "success" in (data as any)) {
      return (data as any).data;
    }
    return data;
  }
}

/**
 * Singleton Executor
 */
export const toolExecutor = new ToolExecutor();

export default toolExecutor;

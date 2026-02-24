/**
 * Tool Executor - Orchestrierung von Single & Chain Workflows
 * Verwaltet Ausführung, State-Sharing, HITL-Entscheidungen
 */

import { IExecutableTool, ExecutionContext, ExecutionResult, Agent, Step } from "../types";
import { globalLogger } from "../utils/logger";
import { QuickJSSandbox } from "./sandbox";
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

      // ===== SINGLE-TOOL: 3-Phasen-Execution =====
      if (agent.type === "single") {
        const result = await this.executeSingleTool(agent, userParameters, toolRegistry);
        const duration = Date.now() - startTime;

        if (result.success) {
          globalLogger.info(`Agent execution completed: ${agent.name}`, {
            executionId,
            duration,
            steps: 1,
          });

          return {
            success: true,
            data: {
              executionId,
              agent: agent.name,
              steps: 1,
              output: result.data,
              duration,
            },
            log: result.log || [],
          };
        }

        return {
          success: false,
          error: result.error || "Single tool execution failed",
          log: result.log || [],
        };
      }

      // ===== CHAIN-TOOL: Sequenzielle Step-Execution =====
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
          throw new Error(
            `Step ${step?.name} failed: ${result.error || "Unknown error"}`
          );
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
   * 3-Phasen-Execution für Single-Tools
   * Phase 1: Pre-Processing (optional)
   * Phase 2: Tool-Execution (optional)
   * Phase 3: Post-Processing (optional)
   */
  private async executeSingleTool(
    agent: Agent,
    userParameters: Record<string, any>,
    toolRegistry: any
  ): Promise<ExecutionResult> {
    const log: any[] = [];
    let currentData: any = userParameters;

    try {
      // ===== PHASE 1: Pre-Processing =====
      if (agent.preprocess) {
        globalLogger.debug("Executing pre-processing", { agent: agent.name });
        try {
          const sandbox = new QuickJSSandbox();
          await sandbox.initialize();
          currentData = await sandbox.executePreprocess(agent.preprocess, currentData);
          log.push({
            phase: "preprocess",
            success: true,
            timestamp: Date.now(),
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Pre-processing failed";
          globalLogger.error("Pre-processing failed", { agent: agent.name, error: errorMsg });
          return {
            success: false,
            error: `Pre-processing failed: ${errorMsg}`,
            log,
          };
        }
      }

      // ===== PHASE 2: Tool-Execution (Optional) =====
      if (agent.toolDefinition) {
        globalLogger.debug("Executing tool", { 
          agent: agent.name, 
          toolId: agent.toolDefinition.toolId 
        });

        try {
          // Hole Tool aus Registry
          const tool = toolRegistry.getTool(agent.toolDefinition.toolId);
          if (!tool) {
            throw new Error(`Tool not found: ${agent.toolDefinition.toolId}`);
          }

          // Baue Execution-Context mit Placeholder-Replacement
          const placeholderCtx = PlaceholderReplacer.createContext(currentData, {});
          const processedParameters = PlaceholderReplacer.replacePlaceholdersInObject(
            agent.toolDefinition.parameters,
            placeholderCtx
          ) as Record<string, any>;

          const context: ExecutionContext = {
            parameters: processedParameters,
            previousStepOutputs: {},
            date: placeholderCtx.date,
            time: placeholderCtx.time,
            randomId: placeholderCtx.randomId,
          };

          // HITL-Check
          if (tool.shouldRequireHITL(context.parameters)) {
            const decision = await this.requestHITLApproval(
              "tool_execution",
              agent.toolDefinition.toolId,
              context.parameters
            );

            if (!decision.approved) {
              return {
                success: false,
                error: decision.reason || "User rejected tool execution",
                log,
              };
            }
          }

          // Führe Tool aus
          const toolResult = await tool.execute(context);
          
          if (!toolResult.success) {
            return {
              success: false,
              error: `Tool execution failed: ${toolResult.error || "Unknown error"}`,
              log: [...log, ...(toolResult.log || [])],
            };
          }

          currentData = toolResult.data;
          log.push({
            phase: "tool_execution",
            toolId: agent.toolDefinition.toolId,
            success: true,
            timestamp: Date.now(),
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Tool execution failed";
          globalLogger.error("Tool execution failed", { agent: agent.name, error: errorMsg });
          return {
            success: false,
            error: `Tool execution failed: ${errorMsg}`,
            log,
          };
        }
      }

      // ===== PHASE 3: Post-Processing =====
      if (agent.postprocess) {
        globalLogger.debug("Executing post-processing", { agent: agent.name });
        try {
          const sandbox = new QuickJSSandbox();
          await sandbox.initialize();
          currentData = await sandbox.executePostprocess(agent.postprocess, currentData);
          log.push({
            phase: "postprocess",
            success: true,
            timestamp: Date.now(),
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Post-processing failed";
          globalLogger.error("Post-processing failed", { agent: agent.name, error: errorMsg });
          return {
            success: false,
            error: `Post-processing failed: ${errorMsg}`,
            log,
          };
        }
      }

      // Success
      return {
        success: true,
        data: currentData,
        log,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      globalLogger.error("Single tool execution failed", { agent: agent.name, error: errorMsg });
      return {
        success: false,
        error: errorMsg,
        log,
      };
    }
  }
}

/**
 * Singleton Executor
 */
export const toolExecutor = new ToolExecutor();

export default toolExecutor;

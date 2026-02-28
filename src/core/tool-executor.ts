/**
 * Tool Executor - Orchestrierung von Single & Chain Workflows
 * Verwaltet Ausführung, State-Sharing, HITL-Entscheidungen
 */

import { ExecutionContext, ExecutionResult, Agent, Step, StepCondition, StepRetry, PlaceholderContext, ToolExecution, Parameter, IToolRegistry } from "../types";
import { globalLogger } from "../utils/logger";
import { globalMetrics } from "../utils/metrics";
import { QuickJSSandbox } from "./sandbox";
import PlaceholderReplacer from "../parser/placeholder";

/**
 * HITL Decision Interface
 * Wird an UI-Layer für Benutzer-Bestätigung übergeben
 */
export interface HITLDecision {
  approved: boolean;
  tool: string;
  step: string;
  parameters: Record<string, unknown>;
  reason?: string;
}

/**
 * Tool Executor - Orchestriert Agent-Ausführung
 */
export class ToolExecutor {
  private hitlCallbacks: Map<string, (decision: HITLDecision) => Promise<void>> = new Map();
  private globalHITLCallback: ((toolName: string, stepName: string, parameters: Record<string, unknown>) => Promise<HITLDecision>) | null = null;

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

  registerGlobalHITLCallback(
    callback: (toolName: string, stepName: string, parameters: Record<string, unknown>) => Promise<HITLDecision>
  ): void {
    this.globalHITLCallback = callback;
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
    toolRegistry: IToolRegistry,
    userParameters: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const traceId = globalMetrics.generateTraceId();
    const executionId = `${agent.name}-${Date.now()}`;
    const startTime = Date.now();
    const allLogs: ToolExecution[] = [];
    const stepOutputs: Map<string, unknown> = new Map();
    const agentSpan = globalMetrics.startTrace(traceId, "agent.execute", undefined, {
      agentName: agent.name,
      agentType: agent.type,
      executionId,
    });

    try {
      globalLogger.info(`Starting agent execution: ${agent.name}`, { executionId, traceId });

      // Validiere Input-Parameter gegen Agent-Definition
      const validationErrors = this.validateInputParameters(agent.parameters, userParameters);
      if (validationErrors.length > 0) {
        throw new Error(`Parameter validation failed: ${validationErrors.join(", ")}`);
      }

      // ===== SINGLE-TOOL: 3-Phasen-Execution =====
      if (agent.type === "single") {
        const singleSpan = globalMetrics.startTrace(traceId, "agent.single", agentSpan.spanId, {
          agentName: agent.name,
        });
        const result = await this.executeSingleTool(agent, userParameters, toolRegistry);
        const duration = Date.now() - startTime;

        if (result.success) {
          globalMetrics.endTrace(singleSpan, "success");
          globalMetrics.endTrace(agentSpan, "success", { duration });
          globalMetrics.recordExecution(agent.name, duration, true);

          globalLogger.info(`Agent execution completed: ${agent.name}`, {
            executionId,
            traceId,
            duration,
            steps: 1,
          });

          return {
            success: true,
            data: {
              executionId,
              traceId,
              agent: agent.name,
              steps: 1,
              output: result.data,
              duration,
            },
            log: result.log || [],
          };
        }

        globalMetrics.endTrace(singleSpan, "error");
        globalMetrics.endTrace(agentSpan, "error", { error: result.error });
        globalMetrics.recordExecution(agent.name, duration, false);

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

        // Conditional: skip step if condition not met
        if (step.condition && !this.evaluateCondition(step.condition, stepOutputs, userParameters)) {
          globalLogger.debug(`Step ${step.name} skipped: condition not met`, { traceId });
          stepOutputs.set(step.name, { __skipped: true });
          continue;
        }

        // Loop: execute step for each item in a list
        if (step.loop) {
          const loopResults = await this.executeLoopStep(
            step, agent, userParameters, stepOutputs, executionId, toolRegistry, allLogs, traceId, agentSpan.spanId
          );
          stepOutputs.set(step.name, loopResults);
          continue;
        }

        globalLogger.debug(`Executing step ${i + 1}/${steps.length}: ${step.name}`, {
          stepIndex: i,
          traceId,
        });

        const stepSpan = globalMetrics.startTrace(traceId, `step.${step.name}`, agentSpan.spanId, {
          stepIndex: i,
          stepName: step.name,
        });

        const context = this.buildExecutionContext(
          agent, step, userParameters, stepOutputs, executionId
        );

        // Retry: attempt step multiple times on failure
        const result = step.retry
          ? await this.executeWithRetry(step, context, toolRegistry, step.retry)
          : await this.executeStep(step, context, toolRegistry);

        if (result.log) {
          allLogs.push(...result.log);
        }

        if (result.success) {
          globalMetrics.endTrace(stepSpan, "success");
          globalMetrics.recordExecution(step.name, stepSpan.duration || 0, true);
          stepOutputs.set(step.name, result.data);
        } else if (step.continueOnError) {
          globalMetrics.endTrace(stepSpan, "error", { error: result.error });
          globalMetrics.recordExecution(step.name, stepSpan.duration || 0, false);
          globalLogger.warn(`Step ${step.name} failed but continueOnError is set, continuing`, {
            error: result.error,
          });
          stepOutputs.set(step.name, { __error: true, error: result.error || "Unknown error" });
        } else {
          globalMetrics.endTrace(stepSpan, "error", { error: result.error });
          globalMetrics.recordExecution(step.name, stepSpan.duration || 0, false);
          throw new Error(
            `Step ${step?.name} failed: ${result.error || "Unknown error"}`
          );
        }
      }

      const duration = Date.now() - startTime;

      globalMetrics.endTrace(agentSpan, "success", { duration, steps: (agent.steps?.length) || 0 });
      globalMetrics.recordExecution(agent.name, duration, true);

      globalLogger.info(`Agent execution completed: ${agent.name}`, {
        executionId,
        traceId,
        duration,
        steps: (agent.steps?.length) || 0,
      });

      return {
        success: true,
        data: {
          executionId,
          traceId,
          agent: agent.name,
          steps: (agent.steps?.length) || 0,
          outputs: Object.fromEntries(stepOutputs),
          duration,
        },
        log: allLogs,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      globalMetrics.endTrace(agentSpan, "error", { error: error instanceof Error ? error.message : "Unknown error" });
      globalMetrics.recordExecution(agent.name, duration, false);

      globalLogger.error(`Agent execution failed: ${agent.name}`, {
        executionId,
        traceId,
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
    toolRegistry: IToolRegistry
  ): Promise<ExecutionResult> {
    try {
      // Hole Tool - Step.parameters hat toolId
      // Für jetzt: verwende step.parameters.tool wenn vorhanden
      const toolId = typeof step.parameters?.tool === "string" ? step.parameters.tool : step.name;
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
    userParameters: Record<string, unknown>,
    stepOutputs: Map<string, unknown>,
    executionId: string
  ): ExecutionContext {
    const previousOutputsObj: Record<string, unknown> = Object.fromEntries(stepOutputs);
    const entries = Array.from(stepOutputs.entries());
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      previousOutputsObj["prev_step"] = { output: lastEntry[1] };
      previousOutputsObj["__last"] = lastEntry[1];
    }

    const placeholderCtx: PlaceholderContext = PlaceholderReplacer.createContext(
      userParameters,
      previousOutputsObj
    );

    // Ersetze Placeholders in Step-Parametern
    const processedParameters = PlaceholderReplacer.replacePlaceholdersInObject(
      step.parameters,
      placeholderCtx
    ) as Record<string, unknown>;

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
    parameters: Record<string, unknown>
  ): Promise<HITLDecision> {
    return new Promise((resolve) => {
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
        }).catch(() => { resolve(decision); });
      } else if (this.globalHITLCallback) {
        this.globalHITLCallback(toolName, stepName, parameters).then((decision) => {
          resolve(decision);
        }).catch(() => { resolve({ approved: false, tool: toolName, step: stepName, parameters }); });
      } else {
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
    agentParams: Parameter[],
    userParams: Record<string, unknown>
  ): string[] {
    const errors: string[] = [];

    for (const param of agentParams) {
      if (param.required && !(param.name in userParams)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    return errors;
  }

  private evaluateCondition(
    condition: StepCondition,
    stepOutputs: Map<string, unknown>,
    userParameters: Record<string, unknown>
  ): boolean {
    const fieldParts = condition.field.split(".");
    let fieldValue: unknown;

    if (fieldParts[0] === "params" || fieldParts[0] === "parameters") {
      fieldValue = this.resolveNestedField(userParameters, fieldParts.slice(1));
    } else {
      const stepName = fieldParts[0] || "";
      const stepOutput = stepOutputs.get(stepName);
      fieldValue = fieldParts.length > 1
        ? this.resolveNestedField(stepOutput, fieldParts.slice(1))
        : stepOutput;
    }

    if (condition.equals !== undefined && !condition.operator) {
      return fieldValue === condition.equals;
    }

    const operator = condition.operator || "eq";
    switch (operator) {
      case "exists": return fieldValue !== undefined && fieldValue !== null;
      case "eq": return fieldValue === condition.value;
      case "neq": return fieldValue !== condition.value;
      case "gt": return typeof fieldValue === "number" && fieldValue > (condition.value as number);
      case "lt": return typeof fieldValue === "number" && fieldValue < (condition.value as number);
      case "gte": return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
      case "lte": return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
      case "contains":
        if (typeof fieldValue === "string") return fieldValue.includes(String(condition.value));
        if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value);
        return false;
      default: return true;
    }
  }

  private resolveNestedField(obj: unknown, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private async executeLoopStep(
    step: Step,
    agent: Agent,
    userParameters: Record<string, unknown>,
    stepOutputs: Map<string, unknown>,
    executionId: string,
    toolRegistry: IToolRegistry,
    allLogs: ToolExecution[],
    traceId: string,
    parentSpanId: string
  ): Promise<unknown[]> {
    const loop = step.loop!;
    const maxIterations = loop.maxIterations || 100;

    const overParts = loop.over.split(".");
    let items: unknown[];

    if (overParts[0] === "params" || overParts[0] === "parameters") {
      items = this.resolveNestedField(userParameters, overParts.slice(1)) as unknown[];
    } else {
      const stepName = overParts[0] || "";
      const stepOutput = stepOutputs.get(stepName);
      items = (overParts.length > 1
        ? this.resolveNestedField(stepOutput, overParts.slice(1))
        : stepOutput) as unknown[];
    }

    if (!Array.isArray(items)) {
      globalLogger.warn(`Loop source is not an array for step ${step.name}`);
      return [];
    }

    const results: unknown[] = [];
    const iterCount = Math.min(items.length, maxIterations);

    for (let i = 0; i < iterCount; i++) {
      const item = items[i];
      const iterParams = { ...userParameters, [loop.as]: item, __loop_index: i };

      const loopSpan = globalMetrics.startTrace(traceId, `loop.${step.name}[${i}]`, parentSpanId, {
        iteration: i,
      });

      const context = this.buildExecutionContext(
        agent, step, iterParams, stepOutputs, executionId
      );

      const result = await this.executeStep(step, context, toolRegistry);

      if (result.log) allLogs.push(...result.log);
      globalMetrics.endTrace(loopSpan, result.success ? "success" : "error");

      results.push(result.success ? result.data : { __error: true, error: result.error });

      if (!result.success && !step.continueOnError) {
        break;
      }
    }

    return results;
  }

  private async executeWithRetry(
    step: Step,
    context: ExecutionContext,
    toolRegistry: IToolRegistry,
    retry: StepRetry
  ): Promise<ExecutionResult> {
    const maxAttempts = retry.maxAttempts;
    const backoffMs = retry.backoffMs || 1000;
    let lastResult: ExecutionResult = { success: false, error: "No attempts made", log: [] };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      lastResult = await this.executeStep(step, context, toolRegistry);

      if (lastResult.success) return lastResult;

      if (retry.retryOn && retry.retryOn.length > 0) {
        const errorMsg = lastResult.error || "";
        const shouldRetry = retry.retryOn.some((pattern) => errorMsg.includes(pattern));
        if (!shouldRetry) return lastResult;
      }

      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(2, attempt - 1);
        globalLogger.debug(`Step ${step.name} failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return lastResult;
  }

  private async executeSingleTool(
    agent: Agent,
    userParameters: Record<string, unknown>,
    toolRegistry: IToolRegistry
  ): Promise<ExecutionResult> {
    const log: ToolExecution[] = [];
    let currentData: unknown = userParameters;

    try {
      // ===== PHASE 1: Pre-Processing =====
      if (agent.preprocess) {
        globalLogger.debug("Executing pre-processing", { agent: agent.name });
        try {
          const sandbox = new QuickJSSandbox();
          await sandbox.initialize();
          currentData = await sandbox.executePreprocess(agent.preprocess, currentData as Record<string, unknown>);
          log.push({
            toolName: "preprocess",
            parameters: {},
            timestamp: Date.now(),
            phase: "preprocess",
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
          const placeholderCtx = PlaceholderReplacer.createContext(currentData as Record<string, unknown>, {});
          const processedParameters = PlaceholderReplacer.replacePlaceholdersInObject(
            agent.toolDefinition.parameters,
            placeholderCtx
          ) as Record<string, unknown>;

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
            toolName: agent.toolDefinition.toolId,
            parameters: processedParameters,
            output: toolResult.data,
            timestamp: Date.now(),
            phase: "tool_execution",
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
            toolName: "postprocess",
            parameters: {},
            timestamp: Date.now(),
            phase: "postprocess",
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

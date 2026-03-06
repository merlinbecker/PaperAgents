import { globalLogger } from "./logger";
import { randomId } from "./constants";

export interface TraceContext {
  traceId: string;
  parentSpanId?: string;
  spanId: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "in_progress" | "success" | "error";
  metadata?: Record<string, unknown>;
}

export interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export interface ExecutionMetricsSummary {
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
}

function generateId(): string {
  return Date.now().toString(36) + randomId(8);
}

export class MetricsCollector {
  private metrics: MetricEntry[] = [];
  private readonly traces: Map<string, TraceContext[]> = new Map();
  private readonly maxMetrics = 5000;
  private readonly maxTraces = 500;

  generateTraceId(): string {
    return generateId();
  }

  startTrace(
    traceId: string,
    operationName: string,
    parentSpanId?: string,
    metadata?: Record<string, unknown>
  ): TraceContext {
    const span: TraceContext = {
      traceId,
      parentSpanId,
      spanId: generateId(),
      operationName,
      startTime: Date.now(),
      status: "in_progress",
      metadata,
    };

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);

    if (this.traces.size > this.maxTraces) {
      const oldest: string | undefined = this.traces.keys().next().value as string | undefined;
      if (oldest) this.traces.delete(oldest);
    }

    globalLogger.debug(`Trace started: ${operationName}`, {
      traceId,
      spanId: span.spanId,
    });

    return span;
  }

  endTrace(
    span: TraceContext,
    status: "success" | "error",
    metadata?: Record<string, unknown>
  ): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    this.recordMetric(`${span.operationName}.duration`, span.duration, {
      traceId: span.traceId,
      status,
    });

    globalLogger.debug(`Trace ended: ${span.operationName}`, {
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration,
      status,
    });
  }

  recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const entry: MetricEntry = {
      name,
      value,
      timestamp: Date.now(),
      labels,
    };

    this.metrics.push(entry);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  recordExecution(
    toolName: string,
    duration: number,
    success: boolean
  ): void {
    this.recordMetric("tool.execution.duration", duration, {
      tool: toolName,
      status: success ? "success" : "error",
    });
    this.recordMetric("tool.execution.count", 1, {
      tool: toolName,
      status: success ? "success" : "error",
    });
  }

  getTrace(traceId: string): TraceContext[] {
    return this.traces.get(traceId) || [];
  }

  getMetrics(name?: string, since?: number): MetricEntry[] {
    let result = [...this.metrics];
    if (name) {
      result = result.filter((m) => m.name === name);
    }
    if (since) {
      result = result.filter((m) => m.timestamp >= since);
    }
    return result;
  }

  getExecutionSummary(
    toolName?: string,
    since?: number
  ): ExecutionMetricsSummary {
    let durations = this.getMetrics("tool.execution.duration", since);
    let counts = this.getMetrics("tool.execution.count", since);

    if (toolName) {
      durations = durations.filter((m) => m.labels.tool === toolName);
      counts = counts.filter((m) => m.labels.tool === toolName);
    }

    const totalExecutions = counts.length;
    const successCount = counts.filter(
      (m) => m.labels.status === "success"
    ).length;
    const errorCount = counts.filter(
      (m) => m.labels.status === "error"
    ).length;

    const durationValues = durations
      .map((m) => m.value)
      .sort((a, b) => a - b);

    const sum = durationValues.reduce((acc, v) => acc + v, 0);
    const averageDuration =
      durationValues.length > 0 ? sum / durationValues.length : 0;
    const minDuration =
      durationValues.length > 0 ? durationValues[0]! : 0;
    const maxDuration =
      durationValues.length > 0
        ? durationValues[durationValues.length - 1]!
        : 0;
    const p95Index = Math.floor(durationValues.length * 0.95);
    const p95Duration =
      durationValues.length > 0
        ? durationValues[Math.min(p95Index, durationValues.length - 1)]!
        : 0;

    return {
      totalExecutions,
      successCount,
      errorCount,
      successRate:
        totalExecutions > 0 ? successCount / totalExecutions : 0,
      averageDuration,
      minDuration,
      maxDuration,
      p95Duration,
    };
  }

  clear(): void {
    this.metrics = [];
    this.traces.clear();
  }
}

export const globalMetrics = new MetricsCollector();

export default globalMetrics;

import { ExecutionResult } from "../types";
import { globalLogger } from "../utils/logger";
import { randomId } from "../utils/constants";

export interface HistoryEntry {
  id: string;
  timestamp: number;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  result: ExecutionResult;
  duration: number;
  traceId?: string;
}

export interface HistoryFilter {
  toolId?: string;
  success?: boolean;
  since?: number;
  until?: number;
  search?: string;
  limit?: number;
}

const MAX_ENTRIES = 200;

export class ExecutionHistory {
  private entries: HistoryEntry[] = [];
  private readonly maxEntries: number;
  private persistCallback: ((data: string) => Promise<void>) | null = null;
  private loadCallback: (() => Promise<string | null>) | null = null;

  constructor(maxEntries = MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  setPersistence(
    save: (data: string) => Promise<void>,
    load: () => Promise<string | null>
  ): void {
    this.persistCallback = save;
    this.loadCallback = load;
  }

  async loadFromStorage(): Promise<void> {
    if (!this.loadCallback) return;

    try {
      const data = await this.loadCallback();
      if (data) {
        const parsed = JSON.parse(data) as HistoryEntry[];
        this.entries = Array.isArray(parsed) ? parsed : [];
        globalLogger.info("Execution history loaded", { count: this.entries.length });
      }
    } catch (error) {
      globalLogger.warn("Failed to load execution history", { error: String(error) });
    }
  }

  async addEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): Promise<HistoryEntry> {
    const fullEntry: HistoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.entries.unshift(fullEntry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    await this.persist();
    return fullEntry;
  }

  getEntries(filter?: HistoryFilter): HistoryEntry[] {
    let result = [...this.entries];

    if (filter) {
      if (filter.toolId) {
        result = result.filter((e) => e.toolId === filter.toolId);
      }
      if (filter.success !== undefined) {
        result = result.filter((e) => e.result.success === filter.success);
      }
      if (filter.since) {
        result = result.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.until) {
        result = result.filter((e) => e.timestamp <= filter.until!);
      }
      if (filter.search) {
        const lower = filter.search.toLowerCase();
        result = result.filter(
          (e) =>
            e.toolName.toLowerCase().includes(lower) ||
            e.toolId.toLowerCase().includes(lower) ||
            JSON.stringify(e.parameters).toLowerCase().includes(lower)
        );
      }
      if (filter.limit) {
        result = result.slice(0, filter.limit);
      }
    }

    return result;
  }

  getEntry(id: string): HistoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  getStats(): {
    totalExecutions: number;
    successCount: number;
    errorCount: number;
    successRate: number;
    toolBreakdown: Record<string, { total: number; success: number }>;
  } {
    const successCount = this.entries.filter((e) => e.result.success).length;
    const errorCount = this.entries.length - successCount;
    const toolBreakdown: Record<string, { total: number; success: number }> = {};

    for (const entry of this.entries) {
      toolBreakdown[entry.toolId] ??= { total: 0, success: 0 };
      const breakdown = toolBreakdown[entry.toolId];
      if (breakdown) {
        breakdown.total++;
        if (entry.result.success) {
          breakdown.success++;
        }
      }
    }

    return {
      totalExecutions: this.entries.length,
      successCount,
      errorCount,
      successRate: this.entries.length > 0 ? successCount / this.entries.length : 0,
      toolBreakdown,
    };
  }

  clearHistory(): void {
    this.entries = [];
    void this.persist();
  }

  exportToJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  private async persist(): Promise<void> {
    if (!this.persistCallback) return;

    try {
      await this.persistCallback(JSON.stringify(this.entries));
    } catch (error) {
      globalLogger.warn("Failed to persist execution history", { error: String(error) });
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + randomId(6);
  }
}

export const executionHistory = new ExecutionHistory();

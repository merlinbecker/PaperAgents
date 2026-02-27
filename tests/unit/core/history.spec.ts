import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExecutionHistory } from "../../../src/core/history";

describe("ExecutionHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeEntry = (toolId: string, success: boolean, toolName?: string) => ({
    toolId,
    toolName: toolName || toolId,
    parameters: { input: "test" },
    result: {
      success,
      data: success ? { output: "ok" } : undefined,
      error: success ? undefined : "failure",
      log: [],
    },
    duration: 100,
  });

  it("adds entries and retrieves them", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("tool-a", true));
    await history.addEntry(makeEntry("tool-b", false));

    const entries = history.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.toolId).toBe("tool-b");
    expect(entries[1]?.toolId).toBe("tool-a");
  });

  it("enforces max entries limit", async () => {
    const history = new ExecutionHistory(3);
    await history.addEntry(makeEntry("t1", true));
    await history.addEntry(makeEntry("t2", true));
    await history.addEntry(makeEntry("t3", true));
    await history.addEntry(makeEntry("t4", true));

    const entries = history.getEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0]?.toolId).toBe("t4");
  });

  it("filters by toolId", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("tool-a", true));
    await history.addEntry(makeEntry("tool-b", true));
    await history.addEntry(makeEntry("tool-a", false));

    const filtered = history.getEntries({ toolId: "tool-a" });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.toolId === "tool-a")).toBe(true);
  });

  it("filters by success status", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("t1", true));
    await history.addEntry(makeEntry("t2", false));
    await history.addEntry(makeEntry("t3", true));

    const successes = history.getEntries({ success: true });
    expect(successes).toHaveLength(2);

    const failures = history.getEntries({ success: false });
    expect(failures).toHaveLength(1);
  });

  it("filters by search string", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("read_file", true, "Read File"));
    await history.addEntry(makeEntry("write_file", true, "Write File"));

    const filtered = history.getEntries({ search: "read" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.toolId).toBe("read_file");
  });

  it("limits results", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("t1", true));
    await history.addEntry(makeEntry("t2", true));
    await history.addEntry(makeEntry("t3", true));

    const limited = history.getEntries({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it("computes stats correctly", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("t1", true));
    await history.addEntry(makeEntry("t1", true));
    await history.addEntry(makeEntry("t2", false));
    await history.addEntry(makeEntry("t2", true));

    const stats = history.getStats();
    expect(stats.totalExecutions).toBe(4);
    expect(stats.successCount).toBe(3);
    expect(stats.errorCount).toBe(1);
    expect(stats.successRate).toBe(0.75);
    expect(stats.toolBreakdown.t1?.total).toBe(2);
    expect(stats.toolBreakdown.t1?.success).toBe(2);
    expect(stats.toolBreakdown.t2?.total).toBe(2);
    expect(stats.toolBreakdown.t2?.success).toBe(1);
  });

  it("clears history", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("t1", true));
    expect(history.getEntries()).toHaveLength(1);

    history.clearHistory();
    expect(history.getEntries()).toHaveLength(0);
  });

  it("exports to JSON", async () => {
    const history = new ExecutionHistory();
    await history.addEntry(makeEntry("t1", true));

    const json = history.exportToJSON();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].toolId).toBe("t1");
  });

  it("getEntry by id returns correct entry", async () => {
    const history = new ExecutionHistory();
    const added = await history.addEntry(makeEntry("t1", true));

    const found = history.getEntry(added.id);
    expect(found).toBeDefined();
    expect(found?.toolId).toBe("t1");
  });

  it("persists and loads via callbacks", async () => {
    let storedData: string | null = null;

    const history = new ExecutionHistory();
    history.setPersistence(
      async (data) => { storedData = data; },
      async () => storedData
    );

    await history.addEntry(makeEntry("t1", true));
    expect(storedData).not.toBeNull();

    const history2 = new ExecutionHistory();
    history2.setPersistence(
      async (data) => { storedData = data; },
      async () => storedData
    );
    await history2.loadFromStorage();

    const entries = history2.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.toolId).toBe("t1");
  });
});

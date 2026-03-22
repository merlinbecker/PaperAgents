import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, LogLevel, RingBuffer, globalLogger } from "../../../src/utils/logger";

// ── RingBuffer ────────────────────────────────────────────────────────────────

describe("RingBuffer", () => {
  it("stores items up to capacity", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
    expect(buf.length).toBe(3);
  });

  it("overwrites oldest item when full", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // overwrite 1
    expect(buf.toArray()).toEqual([2, 3, 4]);
    expect(buf.length).toBe(3);
  });

  it("maintains insertion order after multiple overwrites", () => {
    const buf = new RingBuffer<number>(3);
    for (let i = 1; i <= 6; i++) buf.push(i);
    expect(buf.toArray()).toEqual([4, 5, 6]);
  });

  it("clear resets the buffer", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.toArray()).toEqual([]);
    expect(buf.length).toBe(0);
  });

  it("works with capacity of 1", () => {
    const buf = new RingBuffer<number>(1);
    buf.push(42);
    buf.push(99);
    expect(buf.toArray()).toEqual([99]);
    expect(buf.length).toBe(1);
  });
});

// ── Logger ────────────────────────────────────────────────────────────────────

describe("Logger", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(LogLevel.DEBUG, 10);
  });

  it("stores log entries in the ring buffer", () => {
    logger.info("hello");
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.message).toBe("hello");
    expect(logs[0]?.level).toBe(LogLevel.INFO);
  });

  it("enforces ring buffer capacity", () => {
    const small = new Logger(LogLevel.DEBUG, 3);
    small.info("a");
    small.info("b");
    small.info("c");
    small.info("d"); // overwrites "a"
    const logs = small.getLogs();
    expect(logs).toHaveLength(3);
    expect(logs.map((e) => e.message)).toEqual(["b", "c", "d"]);
  });

  it("clear empties the ring buffer", () => {
    logger.info("x");
    logger.clear();
    expect(logger.getLogs()).toHaveLength(0);
  });

  it("filters by minimum level", () => {
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    const warns = logger.getLogsSince(LogLevel.WARN);
    expect(warns).toHaveLength(2);
    expect(warns.map((e) => e.level)).toEqual([LogLevel.WARN, LogLevel.ERROR]);
  });

  it("respects minLevel setting", () => {
    const l = new Logger(LogLevel.WARN, 10);
    l.debug("ignored");
    l.info("ignored too");
    l.warn("captured");
    expect(l.getLogs()).toHaveLength(1);
    expect(l.getLogs()[0]?.message).toBe("captured");
  });

  it("setLevel changes the minimum level", () => {
    logger.setLevel(LogLevel.ERROR);
    logger.debug("x");
    logger.info("x");
    logger.warn("x");
    logger.error("captured");
    expect(logger.getLogs()).toHaveLength(1);
  });

  it("stores emitter as 'Plugin' for direct calls", () => {
    logger.info("test");
    expect(logger.getLogs()[0]?.emitter).toBe("Plugin");
  });

  it("context is stored in log entry", () => {
    logger.warn("ctx test", { key: "value" });
    expect(logger.getLogs()[0]?.context).toEqual({ key: "value" });
  });

  // ── Event-Bus ───────────────────────────────────────────────────────────────

  it("notifies subscribers when a new entry is added", () => {
    const cb = vi.fn();
    logger.subscribe(cb);
    logger.info("event test");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0]?.[0]).toMatchObject({
      level: LogLevel.INFO,
      message: "event test",
    });
  });

  it("unsubscribe stops notifications", () => {
    const cb = vi.fn();
    const unsub = logger.subscribe(cb);
    unsub();
    logger.info("after unsub");
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    logger.subscribe(cb1);
    logger.subscribe(cb2);
    logger.warn("multi");
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("subscriber error does not break logging", () => {
    logger.subscribe(() => {
      throw new Error("subscriber crash");
    });
    // Should not throw
    expect(() => logger.info("safe")).not.toThrow();
    expect(logger.getLogs()).toHaveLength(1);
  });

  // ── createLogger (ComponentLogger) ─────────────────────────────────────────

  it("createLogger uses the given emitter", () => {
    const comp = logger.createLogger("MyComponent");
    comp.info("component log");
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.emitter).toBe("MyComponent");
    expect(logs[0]?.message).toBe("component log");
  });

  it("createLogger supports all log levels", () => {
    const comp = logger.createLogger("Comp");
    comp.debug("d");
    comp.info("i");
    comp.warn("w");
    comp.error("e");
    const logs = logger.getLogs();
    expect(logs).toHaveLength(4);
    expect(logs.map((l) => l.level)).toEqual([
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ]);
  });

  it("createLogger emits events to subscribers", () => {
    const cb = vi.fn();
    logger.subscribe(cb);
    const comp = logger.createLogger("Emitter");
    comp.warn("event from component");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb.mock.calls[0]?.[0]).toMatchObject({
      emitter: "Emitter",
      level: LogLevel.WARN,
    });
  });

  // ── formatEntry / export ────────────────────────────────────────────────────

  it("formatEntry produces a readable string including emitter", () => {
    const comp = logger.createLogger("TestComp");
    comp.error("bad thing", { code: 42 });
    const formatted = logger.formatEntry(logger.getLogs()[0]!);
    expect(formatted).toContain("TestComp");
    expect(formatted).toContain("ERROR");
    expect(formatted).toContain("bad thing");
    expect(formatted).toContain("42");
  });

  it("export returns all entries as newline-separated strings", () => {
    logger.info("first");
    logger.warn("second");
    const exported = logger.export();
    expect(exported).toContain("first");
    expect(exported).toContain("second");
  });
});

// ── globalLogger ──────────────────────────────────────────────────────────────

describe("globalLogger", () => {
  it("is exported and is a Logger instance", () => {
    expect(globalLogger).toBeInstanceOf(Logger);
  });
});

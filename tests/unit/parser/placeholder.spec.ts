import { describe, it, expect, vi } from "vitest";
import PlaceholderReplacer from "../../../src/parser/placeholder";

describe("PlaceholderReplacer", () => {
  it("replaces date, time, random_id and parameter values", () => {
    // Fix system time
    const fixedDate = new Date("2025-12-31T15:16:17.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    // Stable random
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const context = PlaceholderReplacer.createContext({ foo: "bar" }, { output: { field: 123 } });
    const input = "Today {{date}} at {{time}} id {{random_id}}; p={{foo}}; prev={{prev_step.output.field}}";

    const out = PlaceholderReplacer.replacePlaceholdersInString(input, context);
    expect(out).toContain("2025-12-31");
    expect(out).toContain("15:16:17");
    expect(out).toContain("p=bar");
    expect(out).toContain("prev=123");
    expect(out).toMatch(/id [0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);

    vi.useRealTimers();
  });

  it("validates unresolved placeholders", () => {
    const context = PlaceholderReplacer.createContext({ known: "x" }, {});
    const input = "{{known}} and {{missing}}";
    const res = PlaceholderReplacer.validatePlaceholders(input, context);
    expect(res.valid).toBe(false);
    expect(res.unresolved).toEqual(["missing"]);
  });
});

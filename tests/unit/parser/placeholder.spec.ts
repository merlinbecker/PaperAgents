import { describe, it, expect, vi } from "vitest";
import PlaceholderReplacer from "../../../src/parser/placeholder";

describe("PlaceholderReplacer", () => {
  it("replaces date, time, random_id and parameter values", () => {
    // Fix system time
    const fixedDate = new Date("2025-12-31T15:16:17.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    
    // Mock random for stable randomId
    const mockRandom = vi.spyOn(Math, "random");
    mockRandom.mockReturnValue(0.123456789);

    const context = PlaceholderReplacer.createContext({ foo: "bar" }, { prev_step: { output: { field: 123 } } });
    const input = "Today {{date}} at {{time}} id {{random_id}}; p={{foo}}; prev={{prev_step.output.field}}";

    const out = PlaceholderReplacer.replacePlaceholdersInString(input, context);
    expect(out).toContain("2025-12-31");
    expect(out).toContain("15:16:17");
    expect(out).toContain("p=bar");
    expect(out).toContain("prev=123");
    // randomId wird aus Math.random().toString(36).substring(7) generiert
    expect(out).toMatch(/id [a-z0-9]+;/);

    vi.useRealTimers();
    mockRandom.mockRestore();
  });

  it("validates unresolved placeholders", () => {
    const context = PlaceholderReplacer.createContext({ known: "x" }, {});
    const input = "{{known}} and {{missing}}";
    const out = PlaceholderReplacer.replacePlaceholdersInString(input, context);
    // Missing placeholder wird als leerer String ersetzt
    expect(out).toBe("x and ");
  });
});

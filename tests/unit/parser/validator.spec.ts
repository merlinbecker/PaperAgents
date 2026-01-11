import { describe, it, expect } from "vitest";
import ParameterValidator from "../../../src/parser/validator";

const params = [
  { name: "a", type: "string", required: true },
  { name: "b", type: "number", required: false, default: 5 },
  { name: "c", type: "boolean", required: false },
  { name: "d", type: "array", required: false },
  { name: "e", type: "object", required: false },
];

describe("ParameterValidator", () => {
  it("validateParameters finds missing required", () => {
    const input = { a: "", b: "7" };
    const res = ParameterValidator.validateParameters(params as any, input);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(res.errors[0].field).toBe("a");
  });

  it("normalizeInput converts types correctly", () => {
    const input = { a: 123, b: "7.5", c: "true", d: "[1,2]", e: "{\"x\":1}" };
    const norm = ParameterValidator.normalizeInput(params as any, input);
    expect(typeof norm.a).toBe("string");
    expect(norm.a).toBe("123");
    expect(norm.b).toBeCloseTo(7.5);
    expect(norm.c).toBe(true);
    expect(Array.isArray(norm.d)).toBe(true);
    expect(norm.d).toEqual([1,2]);
    expect(typeof norm.e).toBe("object");
    expect(norm.e).toEqual({ x: 1 });
  });

  it("getHintForField includes type, required and default", () => {
    const hint = ParameterValidator.getHintForField(params[1] as any);
    expect(hint).toMatch(/Type: number/);
    expect(hint).toMatch(/optional/);
    expect(hint).toMatch(/Default/);
  });
});

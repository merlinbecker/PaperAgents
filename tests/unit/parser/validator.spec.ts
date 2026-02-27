import { describe, it, expect } from "vitest";
import ParameterValidator from "../../../src/parser/validator";
import { Parameter } from "../../../src/types";

const params: Parameter[] = [
  { name: "a", type: "string", required: true },
  { name: "b", type: "number", required: false, default: 5 },
  { name: "c", type: "boolean", required: false },
  { name: "d", type: "array", required: false },
  { name: "e", type: "object", required: false },
];

describe("ParameterValidator", () => {
  // === validateParameters ===

  describe("validateParameters", () => {
    it("finds missing required field (empty string)", () => {
      const res = ParameterValidator.validateParameters(params, { a: "" });
      expect(res.valid).toBe(false);
      expect(res.errors[0].field).toBe("a");
      expect(res.errors[0].message).toContain("Required");
    });

    it("finds missing required field (null)", () => {
      const res = ParameterValidator.validateParameters(params, { a: null });
      expect(res.valid).toBe(false);
    });

    it("finds missing required field (undefined)", () => {
      const res = ParameterValidator.validateParameters(params, {});
      expect(res.valid).toBe(false);
    });

    it("passes when all required present", () => {
      const res = ParameterValidator.validateParameters(params, { a: "hello" });
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("skips optional empty fields", () => {
      const res = ParameterValidator.validateParameters(params, { a: "ok", b: null, c: undefined, d: "", e: null });
      expect(res.valid).toBe(true);
    });
  });

  // === String validation ===

  describe("string validation", () => {
    it("rejects non-string values for string type", () => {
      const p: Parameter[] = [{ name: "s", type: "string", required: true }];
      const res = ParameterValidator.validateParameters(p, { s: 42 });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected string");
    });

    it("accepts valid strings", () => {
      const p: Parameter[] = [{ name: "s", type: "string", required: true }];
      const res = ParameterValidator.validateParameters(p, { s: "hello" });
      expect(res.valid).toBe(true);
    });
  });

  // === Number validation ===

  describe("number validation", () => {
    it("accepts numeric strings", () => {
      const p: Parameter[] = [{ name: "n", type: "number", required: true }];
      const res = ParameterValidator.validateParameters(p, { n: "3.14" });
      expect(res.valid).toBe(true);
    });

    it("accepts actual numbers", () => {
      const p: Parameter[] = [{ name: "n", type: "number", required: true }];
      const res = ParameterValidator.validateParameters(p, { n: 42 });
      expect(res.valid).toBe(true);
    });

    it("rejects non-numeric strings", () => {
      const p: Parameter[] = [{ name: "n", type: "number", required: true }];
      const res = ParameterValidator.validateParameters(p, { n: "abc" });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected number");
    });
  });

  // === Boolean validation ===

  describe("boolean validation", () => {
    it("accepts true/false booleans", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: true }];
      expect(ParameterValidator.validateParameters(p, { b: true }).valid).toBe(true);
      expect(ParameterValidator.validateParameters(p, { b: false }).valid).toBe(true);
    });

    it("accepts truthy string/number representations", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: true }];
      expect(ParameterValidator.validateParameters(p, { b: "true" }).valid).toBe(true);
      expect(ParameterValidator.validateParameters(p, { b: 1 }).valid).toBe(true);
      expect(ParameterValidator.validateParameters(p, { b: "1" }).valid).toBe(true);
    });

    it("accepts falsy string/number representations", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: true }];
      expect(ParameterValidator.validateParameters(p, { b: "false" }).valid).toBe(true);
      expect(ParameterValidator.validateParameters(p, { b: 0 }).valid).toBe(true);
      expect(ParameterValidator.validateParameters(p, { b: "0" }).valid).toBe(true);
    });

    it("rejects non-boolean incompatible values", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: true }];
      const res = ParameterValidator.validateParameters(p, { b: "maybe" });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected boolean");
    });
  });

  // === Array validation ===

  describe("array validation", () => {
    it("accepts actual arrays", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: true }];
      expect(ParameterValidator.validateParameters(p, { arr: [1, 2, 3] }).valid).toBe(true);
    });

    it("accepts valid JSON array strings", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: true }];
      expect(ParameterValidator.validateParameters(p, { arr: "[1,2]" }).valid).toBe(true);
    });

    it("rejects invalid JSON array strings", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: true }];
      const res = ParameterValidator.validateParameters(p, { arr: "not-json" });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected array");
    });

    it("rejects non-array non-string values", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: true }];
      const res = ParameterValidator.validateParameters(p, { arr: 42 });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected array");
    });
  });

  // === Object validation ===

  describe("object validation", () => {
    it("accepts actual objects", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      expect(ParameterValidator.validateParameters(p, { obj: { x: 1 } }).valid).toBe(true);
    });

    it("accepts valid JSON object strings", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      expect(ParameterValidator.validateParameters(p, { obj: '{"x":1}' }).valid).toBe(true);
    });

    it("rejects JSON that parses to non-object (e.g. array)", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      // Parses successfully but result is array, not object
      const res = ParameterValidator.validateParameters(p, { obj: "[1,2]" });
      expect(res.valid).toBe(false);
    });

    it("rejects invalid JSON strings", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      const res = ParameterValidator.validateParameters(p, { obj: "not-json" });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected object");
    });

    it("rejects arrays as objects", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      const res = ParameterValidator.validateParameters(p, { obj: [1, 2] });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected object");
    });

    it("rejects null as object", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      // null is required + missing → required error
      const res = ParameterValidator.validateParameters(p, { obj: null });
      expect(res.valid).toBe(false);
    });

    it("rejects non-object non-string values", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: true }];
      const res = ParameterValidator.validateParameters(p, { obj: 42 });
      expect(res.valid).toBe(false);
      expect(res.errors[0].message).toContain("Expected object");
    });
  });

  // === Unknown type ===

  describe("unknown type", () => {
    it("passes validation for unrecognized types", () => {
      const p: Parameter[] = [{ name: "x", type: "custom" as any, required: true }];
      const res = ParameterValidator.validateParameters(p, { x: "anything" });
      expect(res.valid).toBe(true);
    });
  });

  // === normalizeInput ===

  describe("normalizeInput", () => {
    it("converts types correctly", () => {
      const input = { a: 123, b: "7.5", c: "true", d: "[1,2]", e: '{"x":1}' };
      const norm = ParameterValidator.normalizeInput(params, input);
      expect(norm.a).toBe("123");
      expect(norm.b).toBeCloseTo(7.5);
      expect(norm.c).toBe(true);
      expect(norm.d).toEqual([1, 2]);
      expect(norm.e).toEqual({ x: 1 });
    });

    it("uses default values for missing inputs", () => {
      const norm = ParameterValidator.normalizeInput(params, {});
      expect(norm.b).toBeCloseTo(5); // default
    });

    it("normalizes null/undefined number to 0", () => {
      const p: Parameter[] = [{ name: "n", type: "number", required: false }];
      const norm = ParameterValidator.normalizeInput(p, {});
      expect(norm.n).toBe(0);
    });

    it("normalizes boolean from string '0' to false", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { b: "0" });
      expect(norm.b).toBe(false);
    });

    it("normalizes boolean from string 'false' to false", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { b: "false" });
      expect(norm.b).toBe(false);
    });

    it("normalizes boolean from non-string truthy to true", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { b: 1 });
      expect(norm.b).toBe(true);
    });

    it("normalizes boolean from null to false", () => {
      const p: Parameter[] = [{ name: "b", type: "boolean", required: false }];
      const norm = ParameterValidator.normalizeInput(p, {});
      expect(norm.b).toBe(false);
    });

    it("normalizes array from unparseable string to empty array", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { arr: "not-json" });
      expect(norm.arr).toEqual([]);
    });

    it("normalizes array from actual array", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { arr: [1, 2] });
      expect(norm.arr).toEqual([1, 2]);
    });

    it("normalizes non-array non-string to empty array", () => {
      const p: Parameter[] = [{ name: "arr", type: "array", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { arr: 42 });
      expect(norm.arr).toEqual([]);
    });

    it("normalizes object from unparseable string to empty object", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { obj: "not-json" });
      expect(norm.obj).toEqual({});
    });

    it("normalizes object from actual object", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { obj: { x: 1 } });
      expect(norm.obj).toEqual({ x: 1 });
    });

    it("normalizes non-object non-string to empty object", () => {
      const p: Parameter[] = [{ name: "obj", type: "object", required: false }];
      const norm = ParameterValidator.normalizeInput(p, { obj: 42 });
      expect(norm.obj).toEqual({});
    });

    it("normalizes string from null/undefined to empty string", () => {
      const p: Parameter[] = [{ name: "s", type: "string", required: false }];
      const norm = ParameterValidator.normalizeInput(p, {});
      expect(norm.s).toBe("");
    });
  });

  // === isRequired ===

  describe("isRequired", () => {
    it("returns true for required parameters", () => {
      expect(ParameterValidator.isRequired(params[0])).toBe(true);
    });

    it("returns false for optional parameters", () => {
      expect(ParameterValidator.isRequired(params[1])).toBe(false);
    });
  });

  // === getHintForField ===

  describe("getHintForField", () => {
    it("includes type and required status", () => {
      const hint = ParameterValidator.getHintForField(params[0]);
      expect(hint).toContain("Type: string");
      expect(hint).toContain("required");
    });

    it("includes optional and default", () => {
      const hint = ParameterValidator.getHintForField(params[1]);
      expect(hint).toMatch(/optional/);
      expect(hint).toContain("Default: 5");
    });

    it("includes description when present", () => {
      const p: Parameter = { name: "x", type: "string", required: false, description: "A test field" };
      const hint = ParameterValidator.getHintForField(p);
      expect(hint).toContain("A test field");
    });

    it("omits default when not set", () => {
      const p: Parameter = { name: "x", type: "string", required: false };
      const hint = ParameterValidator.getHintForField(p);
      expect(hint).not.toContain("Default");
    });
  });
});

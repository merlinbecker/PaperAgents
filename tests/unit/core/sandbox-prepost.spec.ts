import { describe, it, expect, beforeEach } from "vitest";
import { QuickJSSandbox } from "../../../src/core/sandbox";

/**
 * Unit tests for Pre/Post-Processing execution via QuickJSSandbox
 * Tests actual code execution, not just parsing
 */
describe("QuickJSSandbox - Pre/Post-Processing Execution", () => {
  let sandbox: QuickJSSandbox;

  beforeEach(async () => {
    sandbox = new QuickJSSandbox();
    await sandbox.initialize();
  });

  describe("Pre-Processing", () => {
    it("transforms input parameters correctly", async () => {
      const code = `
        input.text = input.text.trim().toUpperCase();
        input.count = (input.count || 0) + 1;
        return input;
      `;

      const inputParams = {
        text: "  hello world  ",
        count: 5,
      };

      const result = await sandbox.executePreprocess(code, inputParams);

      expect(result.text).toBe("HELLO WORLD");
      expect(result.count).toBe(6);
    });

    it("adds new fields to input", async () => {
      const code = `
        input.filePath = input.name + ".md";
        input.timestamp = "2026-01-12";
        return input;
      `;

      const inputParams = {
        name: "test-file",
      };

      const result = await sandbox.executePreprocess(code, inputParams);

      expect(result.filePath).toBe("test-file.md");
      expect(result.timestamp).toBe("2026-01-12");
      expect(result.name).toBe("test-file");
    });

    it("works with complex nested objects", async () => {
      const code = `
        input.config = {
          enabled: true,
          settings: {
            timeout: 5000,
            retry: 3
          }
        };
        return input;
      `;

      const inputParams = {
        id: "task-1",
      };

      const result = await sandbox.executePreprocess(code, inputParams);

      expect(result.config.enabled).toBe(true);
      expect(result.config.settings.timeout).toBe(5000);
      expect(result.config.settings.retry).toBe(3);
    });

    it("fails validation when code has no return statement", async () => {
      const code = `
        input.text = input.text.trim();
      `;

      const inputParams = { text: "hello" };

      await expect(
        sandbox.executePreprocess(code, inputParams)
      ).rejects.toThrow(/must contain a 'return' statement/);
    });

    it("fails validation when code uses dangerous patterns", async () => {
      const code = `
        require('fs');
        return input;
      `;

      const inputParams = { text: "hello" };

      await expect(
        sandbox.executePreprocess(code, inputParams)
      ).rejects.toThrow(/Dangerous pattern detected/);
    });

    it("fails when return value is not an object", async () => {
      const code = `
        return "not an object";
      `;

      const inputParams = { text: "hello" };

      await expect(
        sandbox.executePreprocess(code, inputParams)
      ).rejects.toThrow(/must return an object/);
    });

    it("handles array transformations", async () => {
      const code = `
        input.items = (input.items || []).map(x => x.toUpperCase());
        return input;
      `;

      const inputParams = {
        items: ["apple", "banana", "cherry"],
      };

      const result = await sandbox.executePreprocess(code, inputParams);

      expect(result.items).toEqual(["APPLE", "BANANA", "CHERRY"]);
    });

    it("can delete fields from input", async () => {
      const code = `
        delete input.temp;
        input.processed = true;
        return input;
      `;

      const inputParams = {
        temp: "remove-me",
        keep: "this-stays",
      };

      const result = await sandbox.executePreprocess(code, inputParams);

      expect(result.temp).toBeUndefined();
      expect(result.keep).toBe("this-stays");
      expect(result.processed).toBe(true);
    });

    it("handles errors in code execution gracefully", async () => {
      const code = `
        input.value = input.missing.property; // Will throw
        return input;
      `;

      const inputParams = { text: "hello" };

      await expect(
        sandbox.executePreprocess(code, inputParams)
      ).rejects.toThrow(/Pre-processing failed/);
    });
  });

  describe("Post-Processing", () => {
    it("transforms tool output correctly", async () => {
      const code = `
        return {
          echoed: typeof output === 'string' ? output.toUpperCase() : JSON.stringify(output),
          log: []
        };
      `;

      const toolOutput = "hello world";

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result.echoed).toBe("HELLO WORLD");
      expect(result.log).toEqual([]);
    });

    it("extracts specific fields from complex output", async () => {
      const code = `
        return {
          files_found: output.results?.length || 0,
          first_file: output.results?.[0]?.path || null,
          success: output.count > 0
        };
      `;

      const toolOutput = {
        results: [
          { path: "/notes/one.md", size: 100 },
          { path: "/notes/two.md", size: 200 },
        ],
        count: 2,
      };

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result.files_found).toBe(2);
      expect(result.first_file).toBe("/notes/one.md");
      expect(result.success).toBe(true);
    });

    it("can return primitive values", async () => {
      const code = `
        return output.content.length;
      `;

      const toolOutput = {
        content: "Hello World",
      };

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result).toBe(11);
    });

    it("handles null/undefined output gracefully", async () => {
      const code = `
        return {
          hasOutput: output != null,
          value: output || "default"
        };
      `;

      const toolOutput = null;

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result.hasOutput).toBe(false);
      expect(result.value).toBe("default");
    });

    it("fails validation when code has no return statement", async () => {
      const code = `
        const x = output.value;
      `;

      const toolOutput = { value: 42 };

      await expect(
        sandbox.executePostprocess(code, toolOutput)
      ).rejects.toThrow(/must contain a 'return' statement/);
    });

    it("fails validation when code uses eval", async () => {
      const code = `
        eval("const x = 1;");
        return output;
      `;

      const toolOutput = { value: 42 };

      await expect(
        sandbox.executePostprocess(code, toolOutput)
      ).rejects.toThrow(/Dangerous pattern detected/);
    });

    it("can aggregate array outputs", async () => {
      const code = `
        return {
          total: output.reduce((sum, item) => sum + item.value, 0),
          count: output.length,
          average: output.reduce((sum, item) => sum + item.value, 0) / output.length
        };
      `;

      const toolOutput = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
      ];

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result.total).toBe(60);
      expect(result.count).toBe(3);
      expect(result.average).toBe(20);
    });

    it("handles errors in code execution gracefully", async () => {
      const code = `
        return output.missing.deeply.nested.property;
      `;

      const toolOutput = { value: 42 };

      await expect(
        sandbox.executePostprocess(code, toolOutput)
      ).rejects.toThrow(/Post-processing failed/);
    });

    it("can format output as markdown", async () => {
      const code = `
        return "# Results\\n\\n" + output.items.map(i => "- " + i).join("\\n");
      `;

      const toolOutput = {
        items: ["First item", "Second item", "Third item"],
      };

      const result = await sandbox.executePostprocess(code, toolOutput);

      expect(result).toContain("# Results");
      expect(result).toContain("- First item");
      expect(result).toContain("- Second item");
      expect(result).toContain("- Third item");
    });
  });

  describe("Code Validation", () => {
    it("blocks require statements", () => {
      const code = `const fs = require('fs'); return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("require"))).toBe(true);
    });

    it("blocks eval statements", () => {
      const code = `eval("malicious code"); return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("eval"))).toBe(true);
    });

    it("blocks process access", () => {
      const code = `console.log(process.env); return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("process"))).toBe(true);
    });

    it("blocks global access", () => {
      const code = `global.x = 1; return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("global"))).toBe(true);
    });

    it("blocks Function constructor", () => {
      const code = `new Function("return 1")(); return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("Function"))).toBe(true);
    });

    it("requires return statement", () => {
      const code = `input.x = 1;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("return"))).toBe(true);
    });

    it("accepts valid code", () => {
      const code = `input.x = 1; return input;`;
      const validation = sandbox.validateCode(code);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });
});

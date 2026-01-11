import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import YAMLParser, { YAMLParseError } from "../../../src/parser/yaml-parser";

// This scenario documents missing error-localization; currently expecting a generic error.

describe("E2E Scenario 3 - Parser error feedback", () => {
  it("fails parsing invalid markdown and should expose location (currently missing)", async () => {
    const bad = await fs.readFile(path.join(__dirname, "../../fixtures/markdown/tool-invalid.md"), "utf8");
    let err: any;
    try {
      YAMLParser.parseToolFile(bad);
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err).toBeInstanceOf(YAMLParseError);
    expect(err.message || "").toMatch(/line\s*2/i);
    expect(err.message || "").toMatch(/column\s*1/i);
    expect(err.message || "").toMatch(/frontmatter|YAML/i);
    expect(err.line).toBe(2);
    expect(err.column).toBe(1);
  });
});

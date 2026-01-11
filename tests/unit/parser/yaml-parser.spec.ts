import { describe, it, expect } from "vitest";
import YAMLParser from "../../../src/parser/yaml-parser";

const mdSingle = `---
id: tool1
name: "My Tool"
type: single
description: "Desc"
parameters: [
- name: filePath, type: string, required: true
- name: overwrite, type: boolean, required: false, default: false
]
---

\`\`\`javascript
function run(input){ return input; }
\`\`\`
`;

const mdChain = `---
id: chain1
name: Chain Tool
type: chain
parameters: [
- name: q, type: string, required: true
]
---

\`\`\`yaml
steps:
  - name: "search_files"
    parameters:
      query: "{{q}}"
  - name: "read_file"
    parameters:
      filePath: "{{prev_step.output.path}}"
\`\`\`
`;

describe("YAMLParser", () => {
  it("parseFrontmatter throws if missing", () => {
    const bad = "# no frontmatter";
    expect(() => YAMLParser.parseFrontmatter(bad)).toThrow(/No YAML frontmatter/);
  });

  it("extracts javascript and yaml code blocks", () => {
    const blocks = YAMLParser.extractCodeBlocks(mdChain);
    expect(blocks.javascript).toBeUndefined();
    expect(blocks.yaml).toMatch(/steps:/);

    const blocksSingle = YAMLParser.extractCodeBlocks(mdSingle);
    expect(blocksSingle.javascript).toMatch(/function run/);
    expect(blocksSingle.yaml).toBeUndefined();
  });

  it("parseToolFile returns structured frontmatter and blocks", () => {
    const parsed = YAMLParser.parseToolFile(mdSingle);
    expect(parsed.frontmatter.id).toBe("tool1");
    expect(parsed.frontmatter.parameters).toBeDefined();
    expect(Array.isArray(parsed.frontmatter.parameters)).toBe(true);
    expect(parsed.customFunction).toMatch(/run/);
    expect(parsed.steps).toBeUndefined();
  });

  it("toAgent builds single tool with customFunction", () => {
    const parsed = YAMLParser.parseToolFile(mdSingle);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.id).toBe("tool1");
    expect(agent.type).toBe("single");
    expect(agent.parameters?.length).toBeGreaterThan(0);
    expect(agent.customFunction).toMatch(/run/);
  });

  it("toAgent builds chain tool with steps", () => {
    const parsed = YAMLParser.parseToolFile(mdChain);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.type).toBe("chain");
    expect(agent.steps?.length).toBe(2);
    expect(agent.steps?.[0].name).toBe("search_files");
    expect(agent.steps?.[1].parameters?.filePath).toMatch(/prev_step/);
  });

  it("toAgent throws on missing required fields", () => {
    const mdMissing = `---\nname: N\n---\n`;
    const parsed = YAMLParser.parseToolFile(mdMissing);
    expect(() => YAMLParser.toAgent(parsed)).toThrow(/Missing required fields/);
  });
});

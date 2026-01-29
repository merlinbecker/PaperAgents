import { describe, it, expect } from "vitest";
import YAMLParser from "../../../src/parser/yaml-parser";

const mdSingle = `---
id: tool1
name: "My Tool"
type: single
description: "Desc"
parameters:
  - name: filePath
    type: string
    required: true
  - name: overwrite
    type: boolean
    required: false
    default: false
---

\`\`\`javascript
// @preprocess
const filePath = input.filePath;
return { filePath };
\`\`\`

\`\`\`yaml
tool: "read_file"
parameters:
  path: "{{filePath}}"
\`\`\`

\`\`\`javascript
// @postprocess
return output;
\`\`\`
`;

const mdChain = `---
id: chain1
name: Chain Tool
type: chain
parameters:
  - name: q
    type: string
    required: true
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

  it("extracts yaml code blocks", () => {
    const blocks = YAMLParser.extractCodeBlocks(mdChain);
    expect(blocks.yaml).toMatch(/steps:/);
  });

  it("parseToolFile returns structured frontmatter and blocks", () => {
    const parsed = YAMLParser.parseToolFile(mdSingle);
    expect(parsed.frontmatter.id).toBe("tool1");
    expect(parsed.frontmatter.parameters).toBeDefined();
    expect(Array.isArray(parsed.frontmatter.parameters)).toBe(true);
    expect(parsed.steps).toBeUndefined();
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

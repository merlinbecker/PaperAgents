import { describe, it, expect } from "vitest";
import YAMLParser from "../../../src/parser/yaml-parser";

/**
 * Tests für Pre- und Post-Processing mit neuer Notation
 * Die Notation nutzt // @preprocess und // @postprocess Marker
 */

const mdSingleWithProcessing = `---
id: single_echo
name: "Single Echo"
type: single
parameters:
  - name: input
    type: string
    required: true
description: "Echo tool with trim and uppercase"
---

#### **Pre-Processing**
\`\`\`javascript
// @preprocess
input.input = input.input.trim();
return input;
\`\`\`

#### **Tool-Ausführung**
\`\`\`yaml
tool: "echo"
parameters:
  text: "input.input"
\`\`\`

#### **Post-Processing**
\`\`\`javascript
// @postprocess
return {
  echoed: output.text.toUpperCase(),
  log: []
};
\`\`\`
`;

const mdChainWithProcessing = `---
id: chain_reader
name: "Chain Reader"
type: chain
parameters:
  - name: query
    type: string
    required: true
description: "Chain tool: search files and read first result"
---

#### **Pre-Processing**
\`\`\`javascript
// @preprocess
input.query = input.query.trim();
return input;
\`\`\`

#### **Steps**
\`\`\`yaml
steps:
  - name: "search_files"
    tool: "file_search"
    parameters:
      query: "input.query"
      path: "/notes"
    
  - name: "read_file"
    tool: "read_file"
    parameters:
      filePath: "prev_step.output.results[0].path"
\`\`\`

#### **Post-Processing**
\`\`\`javascript
// @postprocess
return {
  files_found: output.files_found || 0,
  content: output.content || "",
  log: []
};
\`\`\`
`;

describe("YAMLParser - Pre/Post-Processing", () => {
  it("extracts @preprocess block from javascript code", () => {
    const parsed = YAMLParser.parseToolFile(mdSingleWithProcessing);
    expect(parsed.preprocess).toBeDefined();
    expect(parsed.preprocess).toContain("input.input.trim()");
    expect(parsed.preprocess).toContain("return input");
  });

  it("extracts @postprocess block from javascript code", () => {
    const parsed = YAMLParser.parseToolFile(mdSingleWithProcessing);
    expect(parsed.postprocess).toBeDefined();
    expect(parsed.postprocess).toContain("output.text.toUpperCase()");
    expect(parsed.postprocess).toContain("return");
  });

  it("extracts yaml tool block", () => {
    const parsed = YAMLParser.parseToolFile(mdSingleWithProcessing);
    expect(parsed.toolBlock).toBeDefined();
    expect(parsed.toolBlock).toContain("tool:");
    expect(parsed.toolBlock).toContain("echo");
  });

  it("returns undefined for preprocess if not present", () => {
    const mdWithoutPreprocess = mdSingleWithProcessing.replace(
      /#### \*\*Pre-Processing\*\*[\s\S]*?```\n\n/,
      ""
    );
    const parsed = YAMLParser.parseToolFile(mdWithoutPreprocess);
    expect(parsed.preprocess).toBeUndefined();
  });

  it("returns undefined for postprocess if not present", () => {
    const mdWithoutPostprocess = mdSingleWithProcessing.replace(
      /#### \*\*Post-Processing\*\*[\s\S]*?```\n$/,
      ""
    );
    const parsed = YAMLParser.parseToolFile(mdWithoutPostprocess);
    expect(parsed.postprocess).toBeUndefined();
  });

  it("toAgent includes preprocess in single tool", () => {
    const parsed = YAMLParser.parseToolFile(mdSingleWithProcessing);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.preprocess).toBeDefined();
    expect(agent.preprocess).toContain("trim");
  });

  it("toAgent includes postprocess in single tool", () => {
    const parsed = YAMLParser.parseToolFile(mdSingleWithProcessing);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.postprocess).toBeDefined();
    expect(agent.postprocess).toContain("toUpperCase");
  });

  it("toAgent includes preprocess in chain tool", () => {
    const parsed = YAMLParser.parseToolFile(mdChainWithProcessing);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.preprocess).toBeDefined();
    expect(agent.preprocess).toContain("query.trim()");
  });

  it("toAgent includes postprocess in chain tool", () => {
    const parsed = YAMLParser.parseToolFile(mdChainWithProcessing);
    const agent = YAMLParser.toAgent(parsed);
    expect(agent.postprocess).toBeDefined();
    expect(agent.postprocess).toContain("files_found");
  });
});

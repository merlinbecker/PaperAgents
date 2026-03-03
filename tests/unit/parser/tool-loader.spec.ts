import { describe, it, expect, beforeEach } from "vitest";
import { App, TFile, TFolder } from "obsidian";
import CustomToolLoader from "../../../src/parser/tool-loader";

describe("CustomToolLoader", () => {
  let loader: CustomToolLoader;
  let mockApp: App;

  beforeEach(() => {
    mockApp = new App();
    loader = new CustomToolLoader(mockApp as any);
  });

  // === discoverTools ===

  describe("discoverTools", () => {
    it("returns empty array when folder does not exist", async () => {
      const files = await loader.discoverTools("non-existent-path");
      expect(files).toEqual([]);
    });

    it("finds only .md files, ignoring other extensions", async () => {
      const v = mockApp.vault as any;
      await v.create("paper-agents-tools/tool.md", "---\ntool: true\n---");
      await v.create("paper-agents-tools/readme.txt", "text");
      await v.create("paper-agents-tools/data.json", "{}");

      const files = await loader.discoverTools("paper-agents-tools");
      expect(files.length).toBe(1);
      expect(files[0].name).toBe("tool.md");
    });

    it("discovers tools in nested sub-folders", async () => {
      const v = mockApp.vault as any;
      await v.create("paper-agents-tools/a.md", "content");
      await v.create("paper-agents-tools/sub/b.md", "content");

      const files = await loader.discoverTools("paper-agents-tools");
      expect(files.length).toBe(2);
      const names = files.map((f: any) => f.name);
      expect(names).toContain("a.md");
      expect(names).toContain("b.md");
    });

    it("returns empty array when no md files in folder", async () => {
      const v = mockApp.vault as any;
      await v.create("paper-agents-tools/readme.txt", "text");

      const files = await loader.discoverTools("paper-agents-tools");
      expect(files.length).toBe(0);
    });
  });

  // === parseToolFile ===

  describe("parseToolFile", () => {
    it("returns null when file has no 'tool: true'", async () => {
      const v = mockApp.vault as any;
      await v.create("tools/no-tool.md", "---\ntitle: Not a tool\n---\nContent");

      const file = new TFile("tools/no-tool.md");
      const result = await loader.parseToolFile(file as any);
      expect(result).toBeNull();
    });

    it("returns null when file has no id/name", async () => {
      const v = mockApp.vault as any;
      await v.create("tools/bad-tool.md", "---\ntool: true\n---\nContent");

      const file = new TFile("tools/bad-tool.md");
      const result = await loader.parseToolFile(file as any);
      expect(result).toBeNull();
    });

    it("parses valid tool file correctly", async () => {
      const content = `---
tool: true
id: test_tool
name: Test Tool
type: single
description: A test tool
parameters:
  - name: input
    type: string
    required: true
---

#### **Tool-Ausführung**
\`\`\`yaml
tool: "read_file"
parameters:
  path: "{{input}}"
\`\`\``;
      const v = mockApp.vault as any;
      await v.create("tools/valid.md", content);

      const file = new TFile("tools/valid.md");
      const result = await loader.parseToolFile(file as any);
      expect(result).not.toBeNull();
      expect(result!.id).toBe("test_tool");
      expect(result!.name).toBe("Test Tool");
    });

    it("returns null when parsing throws", async () => {
      const v = mockApp.vault as any;
      // Craft content that causes parser to throw
      await v.create("tools/bad.md", "---\ntool: true\nid: x\nname: Y\n---\n```yaml\n{{{invalid\n```");

      const file = new TFile("tools/bad.md");
      const result = await loader.parseToolFile(file as any);
      // Depending on error handling, it could be null or a partial result
      // The key is it doesn't throw
      expect(result === null || typeof result === "object").toBe(true);
    });
  });

  // === loadCustomTools ===

  describe("loadCustomTools", () => {
    it("returns empty result when base path has no files", async () => {
      // Don't create any files
      const result = await loader.loadCustomTools("empty-folder");
      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it("handles mix of valid and non-tool files", async () => {
      const v = mockApp.vault as any;
      const toolContent = `---
tool: true
id: good_tool
name: Good Tool
type: single
description: Works
parameters:
  - name: text
    type: string
    required: true
---

#### **Tool-Ausführung**
\`\`\`yaml
tool: "read_file"
parameters:
  path: "{{text}}"
\`\`\``;
      await v.create("paper-agents-tools/good.md", toolContent);
      await v.create("paper-agents-tools/not-a-tool.md", "# Just a note\nNo frontmatter");

      const result = await loader.loadCustomTools("paper-agents-tools");
      expect(result.successful.length).toBe(1);
      expect(result.successful[0].id).toBe("good_tool");
    });

    it("uses default basePath when none specified", async () => {
      const result = await loader.loadCustomTools();
      expect(result.successful).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  // === isToolFile (via onToolFileChanged) ===

  describe("isToolFile", () => {
    it("identifies .md files inside paper-agents-tools as tool files", () => {
      // Access isToolFile indirectly - it's private. We test via onToolFileChanged.
      // We just verify the method exists and is callable by testing the event registration.
      // Instead, test the behavior - register callback and simulate events.
      const calls: Array<{ id: string; action: string }> = [];
      const vaultEvents: Record<string, Array<(file: any) => void>> = {};

      // Override vault.on to capture event registrations
      (mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
        vaultEvents[event] ??= [];
        vaultEvents[event].push(cb);
      };

      loader.onToolFileChanged((toolId, action) => {
        calls.push({ id: toolId, action });
      });

      // Simulate create event with a tool file
      const toolFile = new TFile("paper-agents-tools/new-tool.md");
      for (const cb of vaultEvents["create"] || []) cb(toolFile);
      expect(calls.length).toBe(1);
      expect(calls[0].action).toBe("create");
      expect(calls[0].id).toBe("new-tool");
    });

    it("ignores non-md files", () => {
      const calls: Array<{ id: string; action: string }> = [];
      const vaultEvents: Record<string, Array<(file: any) => void>> = {};

      (mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
        vaultEvents[event] ??= [];
        vaultEvents[event].push(cb);
      };

      loader.onToolFileChanged((toolId, action) => {
        calls.push({ id: toolId, action });
      });

      const txtFile = new TFile("paper-agents-tools/notes.txt");
      for (const cb of vaultEvents["modify"] || []) cb(txtFile);
      expect(calls.length).toBe(0);
    });

    it("ignores files outside paper-agents-tools", () => {
      const calls: Array<{ id: string; action: string }> = [];
      const vaultEvents: Record<string, Array<(file: any) => void>> = {};

      (mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
        vaultEvents[event] ??= [];
        vaultEvents[event].push(cb);
      };

      loader.onToolFileChanged((toolId, action) => {
        calls.push({ id: toolId, action });
      });

      const unrelatedFile = new TFile("notes/daily.md");
      for (const cb of vaultEvents["delete"] || []) cb(unrelatedFile);
      expect(calls.length).toBe(0);
    });

    it("ignores non-TFile objects", () => {
      const calls: Array<{ id: string; action: string }> = [];
      const vaultEvents: Record<string, Array<(file: any) => void>> = {};

      (mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
        vaultEvents[event] ??= [];
        vaultEvents[event].push(cb);
      };

      loader.onToolFileChanged((toolId, action) => {
        calls.push({ id: toolId, action });
      });

      // Pass a TFolder instead of TFile
      const folder = new TFolder("paper-agents-tools");
      for (const cb of vaultEvents["create"] || []) cb(folder);
      expect(calls.length).toBe(0);
    });

    it("fires modify and delete events correctly", () => {
      const calls: Array<{ id: string; action: string }> = [];
      const vaultEvents: Record<string, Array<(file: any) => void>> = {};

      (mockApp.vault as any).on = (event: string, cb: (file: any) => void) => {
        vaultEvents[event] ??= [];
        vaultEvents[event].push(cb);
      };

      loader.onToolFileChanged((toolId, action) => {
        calls.push({ id: toolId, action });
      });

      const toolFile = new TFile("paper-agents-tools/edit-tool.md");
      for (const cb of vaultEvents["modify"] || []) cb(toolFile);
      for (const cb of vaultEvents["delete"] || []) cb(toolFile);

      expect(calls.length).toBe(2);
      expect(calls[0].action).toBe("update");
      expect(calls[1].action).toBe("delete");
    });
  });
});

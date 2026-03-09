import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("obsidian", () => ({
  App: vi.fn(),
  TFile: vi.fn(),
}));

import { CanvasAgent, CANVAS_MARKER, CANVAS_FRONTMATTER_KEY } from "../../../src/core/canvas-agent";
import type { AgentDefinition } from "../../../src/types";

// Minimal stub for App that satisfies CanvasAgent
function makeApp(overrides: Partial<{
  activeFile: unknown;
  readContent: string;
  frontmatter: Record<string, unknown> | null;
  selection: string | null;
}> = {}): unknown {
  const content = overrides.readContent ?? "";
  const frontmatter = overrides.frontmatter === undefined ? null : overrides.frontmatter;
  const selection = overrides.selection === undefined ? null : overrides.selection;

  return {
    workspace: {
      getActiveFile: vi.fn(() => overrides.activeFile ?? null),
      activeEditor: selection === null
        ? null
        : { editor: { getSelection: vi.fn(() => selection) } },
    },
    vault: {
      read: vi.fn(async () => content),
      modify: vi.fn(async () => undefined),
    },
    metadataCache: {
      getFileCache: vi.fn(() => (frontmatter ? { frontmatter } : null)),
    },
  };
}

function makeAgent(id: string, name: string): AgentDefinition {
  return {
    id,
    name,
    systemPrompt: "You are helpful.",
    tools: [],
    memory: { type: "conversation", maxMessages: 50 },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CanvasAgent", () => {
  describe("extractAgentId", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("returns null when no frontmatter present", () => {
      expect(canvasAgent.extractAgentId("# Hello\nsome content")).toBeNull();
    });

    it("returns null when frontmatter does not contain paper-agent", () => {
      const content = "---\ntitle: My Doc\n---\n# Hello";
      expect(canvasAgent.extractAgentId(content)).toBeNull();
    });

    it("extracts the agent id from frontmatter", () => {
      const content = `---\ntitle: My Doc\n${CANVAS_FRONTMATTER_KEY}: research_agent\n---\n# Hello`;
      expect(canvasAgent.extractAgentId(content)).toBe("research_agent");
    });

    it("returns null for empty paper-agent value", () => {
      const content = `---\n${CANVAS_FRONTMATTER_KEY}: \n---\n# Hello`;
      expect(canvasAgent.extractAgentId(content)).toBeNull();
    });
  });

  describe("buildDocumentContext", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("returns document content unchanged when no canvas markers present", () => {
      const doc = "# Title\n\nSome content here.\n\nAnother paragraph.";
      expect(canvasAgent.buildDocumentContext(doc)).toBe(doc.trim());
    });

    it("strips canvas callout blocks", () => {
      const doc = [
        "# Title",
        "",
        "Some content.",
        "",
        CANVAS_MARKER,
        "> [!note] 🤖 Agent: Test *(2026-01-01)*",
        ">",
        "> Agent response here.",
        "",
        "More content.",
      ].join("\n");

      const result = canvasAgent.buildDocumentContext(doc);
      expect(result).toContain("# Title");
      expect(result).toContain("Some content.");
      expect(result).toContain("More content.");
      expect(result).not.toContain(CANVAS_MARKER);
      expect(result).not.toContain("Agent response here.");
    });

    it("strips multiple consecutive canvas callout blocks", () => {
      const doc = [
        "# Doc",
        CANVAS_MARKER,
        "> [!note] 🤖 Agent: Test",
        "> First agent block",
        "",
        CANVAS_MARKER,
        "> [!question] 👤 User",
        "> User reply",
        "",
        "Footer.",
      ].join("\n");

      const result = canvasAgent.buildDocumentContext(doc);
      expect(result).not.toContain("First agent block");
      expect(result).not.toContain("User reply");
      expect(result).toContain("Footer.");
    });
  });

  describe("buildInitialPrompt", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("wraps document content with framing prompt", () => {
      const doc = "# My Document\n\nHello world.";
      const prompt = canvasAgent.buildInitialPrompt(doc);

      expect(prompt).toContain("=== DOCUMENT ===");
      expect(prompt).toContain("=== END ===");
      expect(prompt).toContain(doc);
    });

    it("contains instruction about annotations", () => {
      const prompt = canvasAgent.buildInitialPrompt("some text");
      expect(prompt.toLowerCase()).toMatch(/annot|feedback|review/i);
    });
  });

  describe("buildInitialPromptWithSystem", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("uses the provided system prompt instead of the built-in default", () => {
      const doc = "# My Doc\n\nSome content.";
      const systemPrompt = "You are a strict grammar checker.";
      const prompt = canvasAgent.buildInitialPromptWithSystem(doc, systemPrompt);

      expect(prompt).toContain(systemPrompt);
      expect(prompt).toContain("=== DOCUMENT ===");
      expect(prompt).toContain("=== END ===");
      expect(prompt).toContain(doc);
      // Built-in default instructions should NOT appear
      expect(prompt).not.toContain("You are reviewing the following document");
    });

    it("places the system prompt before the document block", () => {
      const doc = "Hello world.";
      const systemPrompt = "Custom instructions.";
      const prompt = canvasAgent.buildInitialPromptWithSystem(doc, systemPrompt);

      const systemIdx = prompt.indexOf(systemPrompt);
      const docIdx = prompt.indexOf("=== DOCUMENT ===");
      expect(systemIdx).toBeLessThan(docIdx);
    });
  });

  describe("formatAgentCallout", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("starts with the canvas marker", () => {
      const callout = canvasAgent.formatAgentCallout("My Agent", "Good point!");
      expect(callout).toContain(CANVAS_MARKER);
    });

    it("includes agent name in title", () => {
      const callout = canvasAgent.formatAgentCallout("Research Bot", "Some text");
      expect(callout).toContain("Research Bot");
    });

    it("prefixes each body line with >", () => {
      const callout = canvasAgent.formatAgentCallout("Bot", "line one\nline two");
      expect(callout).toContain("> line one");
      expect(callout).toContain("> line two");
    });

    it("uses [!note] callout type", () => {
      const callout = canvasAgent.formatAgentCallout("Bot", "text");
      expect(callout).toContain("[!note]");
    });
  });

  describe("formatUserCallout", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("starts with the canvas marker", () => {
      const callout = canvasAgent.formatUserCallout("Hello!");
      expect(callout).toContain(CANVAS_MARKER);
    });

    it("uses [!question] callout type", () => {
      const callout = canvasAgent.formatUserCallout("Hello!");
      expect(callout).toContain("[!question]");
    });

    it("includes user emoji in title", () => {
      const callout = canvasAgent.formatUserCallout("Hello!");
      expect(callout).toContain("👤 User");
    });

    it("prefixes body lines with >", () => {
      const callout = canvasAgent.formatUserCallout("First line\nSecond line");
      expect(callout).toContain("> First line");
      expect(callout).toContain("> Second line");
    });
  });

  describe("resolveAgent", () => {
    let canvasAgent: CanvasAgent;
    const agents = [
      makeAgent("agent_1", "Agent One"),
      makeAgent("agent_2", "Agent Two"),
    ];

    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("returns matching agent by id", () => {
      expect(canvasAgent.resolveAgent("agent_1", agents)?.id).toBe("agent_1");
      expect(canvasAgent.resolveAgent("agent_2", agents)?.name).toBe("Agent Two");
    });

    it("returns null for unknown id", () => {
      expect(canvasAgent.resolveAgent("unknown", agents)).toBeNull();
    });

    it("returns null when agents list is empty", () => {
      expect(canvasAgent.resolveAgent("agent_1", [])).toBeNull();
    });
  });

  describe("appendAgentCallout", () => {
    it("appends callout text to the file content", async () => {
      const originalContent = "# Doc\n\nSome content.";
      const app = makeApp({ readContent: originalContent }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      await canvasAgent.appendAgentCallout(fakeFile, "My Agent", "Good feedback!");

      const vault = (app as { vault: { modify: ReturnType<typeof vi.fn> } }).vault;
      expect(vault.modify).toHaveBeenCalledOnce();
      const [, writtenContent] = vault.modify.mock.calls[0] as [unknown, string];
      expect(writtenContent).toContain(originalContent);
      expect(writtenContent).toContain(CANVAS_MARKER);
      expect(writtenContent).toContain("Good feedback!");
      expect(writtenContent).toContain("My Agent");
    });

    it("returns the appended callout text", async () => {
      const app = makeApp({ readContent: "# Doc" }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      const calloutText = await canvasAgent.appendAgentCallout(fakeFile, "My Agent", "Good feedback!");

      expect(calloutText).toContain(CANVAS_MARKER);
      expect(calloutText).toContain("My Agent");
      expect(calloutText).toContain("Good feedback!");
    });
  });

  describe("appendUserCallout", () => {
    it("appends user callout text to the file content", async () => {
      const originalContent = "# Doc";
      const app = makeApp({ readContent: originalContent }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      await canvasAgent.appendUserCallout(fakeFile, "Follow-up question?");

      const vault = (app as { vault: { modify: ReturnType<typeof vi.fn> } }).vault;
      expect(vault.modify).toHaveBeenCalledOnce();
      const [, writtenContent] = vault.modify.mock.calls[0] as [unknown, string];
      expect(writtenContent).toContain("Follow-up question?");
      expect(writtenContent).toContain("[!question]");
    });

    it("returns the appended callout text", async () => {
      const app = makeApp({ readContent: "# Doc" }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      const calloutText = await canvasAgent.appendUserCallout(fakeFile, "Follow-up question?");

      expect(calloutText).toContain(CANVAS_MARKER);
      expect(calloutText).toContain("[!question]");
      expect(calloutText).toContain("Follow-up question?");
    });
  });

  describe("removeCallout", () => {
    it("removes an existing callout and returns true", async () => {
      const callout = "\n<!-- paper-agents-canvas -->\n> [!note] 🤖 Agent: Bot *(2026-01-01T10:00:00Z)*\n>\n> Some response.\n";
      const originalContent = "# Doc\n\nSome content." + callout + "Footer.";
      const app = makeApp({ readContent: originalContent }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      const result = await canvasAgent.removeCallout(fakeFile, callout);

      expect(result).toBe(true);
      const vault = (app as { vault: { modify: ReturnType<typeof vi.fn> } }).vault;
      expect(vault.modify).toHaveBeenCalledOnce();
      const [, writtenContent] = vault.modify.mock.calls[0] as [unknown, string];
      expect(writtenContent).toContain("# Doc");
      expect(writtenContent).toContain("Footer.");
      expect(writtenContent).not.toContain("Some response.");
      expect(writtenContent).not.toContain(CANVAS_MARKER);
    });

    it("returns false and does not modify file when callout is not found", async () => {
      const originalContent = "# Doc\n\nNo callouts here.";
      const app = makeApp({ readContent: originalContent }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      const result = await canvasAgent.removeCallout(fakeFile, "nonexistent callout text");

      expect(result).toBe(false);
      const vault = (app as { vault: { modify: ReturnType<typeof vi.fn> } }).vault;
      expect(vault.modify).not.toHaveBeenCalled();
    });

    it("can remove a callout returned by appendAgentCallout", async () => {
      const originalContent = "# Doc\n\nContent.";
      // Set up app so that read always returns the most recently modified content
      let currentContent = originalContent;
      const modifyMock = vi.fn(async (_file: unknown, content: string) => {
        currentContent = content;
      });
      const readMock = vi.fn(async () => currentContent);
      const app = {
        workspace: { getActiveFile: vi.fn(() => null) },
        vault: { read: readMock, modify: modifyMock },
        metadataCache: { getFileCache: vi.fn(() => null) },
      } as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      const calloutText = await canvasAgent.appendAgentCallout(fakeFile, "Agent", "My response");
      expect(currentContent).toContain("My response");

      const removed = await canvasAgent.removeCallout(fakeFile, calloutText);
      expect(removed).toBe(true);
      expect(currentContent).not.toContain("My response");
      expect(currentContent).toContain("# Doc");
    });
  });

  describe("CANVAS_MARKER constant", () => {
    it("matches the expected comment string", () => {
      expect(CANVAS_MARKER).toBe("<!-- paper-agents-canvas -->");
    });
  });

  describe("CANVAS_FRONTMATTER_KEY constant", () => {
    it("matches the expected key name", () => {
      expect(CANVAS_FRONTMATTER_KEY).toBe("paper-agent");
    });
  });

  describe("getActiveEditorSelection", () => {
    it("returns the trimmed selection when text is selected", () => {
      const app = makeApp({ selection: "  selected text  " }) as never;
      const canvasAgent = new CanvasAgent(app);
      expect(canvasAgent.getActiveEditorSelection()).toBe("selected text");
    });

    it("returns null when selection is an empty string", () => {
      const app = makeApp({ selection: "" }) as never;
      const canvasAgent = new CanvasAgent(app);
      expect(canvasAgent.getActiveEditorSelection()).toBeNull();
    });

    it("returns null when selection is only whitespace", () => {
      const app = makeApp({ selection: "   " }) as never;
      const canvasAgent = new CanvasAgent(app);
      expect(canvasAgent.getActiveEditorSelection()).toBeNull();
    });

    it("returns null when no editor is active", () => {
      const app = makeApp() as never; // no activeEditor
      const canvasAgent = new CanvasAgent(app);
      expect(canvasAgent.getActiveEditorSelection()).toBeNull();
    });
  });

  describe("buildSelectionPrompt", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("wraps selection with framing prompt", () => {
      const selection = "Important paragraph to review.";
      const prompt = canvasAgent.buildSelectionPrompt(selection);
      expect(prompt).toContain("=== SELECTED TEXT ===");
      expect(prompt).toContain("=== END ===");
      expect(prompt).toContain(selection);
    });

    it("contains instruction about annotations", () => {
      const prompt = canvasAgent.buildSelectionPrompt("some text");
      expect(prompt.toLowerCase()).toMatch(/annot|feedback|review/i);
    });
  });

  // ── Phase 4 – Inline placement ─────────────────────────────────────────────

  describe("parseInlinePlacement", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("returns null paragraphIndex and unchanged text when no hint is present", () => {
      const result = canvasAgent.parseInlinePlacement("Just some response.");
      expect(result.paragraphIndex).toBeNull();
      expect(result.cleanedText).toBe("Just some response.");
    });

    it("parses @after-paragraph-3: from the start of the response", () => {
      const result = canvasAgent.parseInlinePlacement("@after-paragraph-3: The annotation text.");
      expect(result.paragraphIndex).toBe(3);
      expect(result.cleanedText).toBe("The annotation text.");
    });

    it("parses hint with newline separator", () => {
      const result = canvasAgent.parseInlinePlacement("@after-paragraph-1:\nFirst paragraph annotation.");
      expect(result.paragraphIndex).toBe(1);
      expect(result.cleanedText).toBe("First paragraph annotation.");
    });

    it("returns null for paragraph index 0 (must be >= 1)", () => {
      const result = canvasAgent.parseInlinePlacement("@after-paragraph-0: bad hint");
      expect(result.paragraphIndex).toBeNull();
    });

    it("returns null paragraphIndex when hint appears mid-text (not at start)", () => {
      const result = canvasAgent.parseInlinePlacement("Some text @after-paragraph-2: more text");
      expect(result.paragraphIndex).toBeNull();
      expect(result.cleanedText).toBe("Some text @after-paragraph-2: more text");
    });

    it("is case-insensitive", () => {
      const result = canvasAgent.parseInlinePlacement("@After-Paragraph-5: My note.");
      expect(result.paragraphIndex).toBe(5);
      expect(result.cleanedText).toBe("My note.");
    });
  });

  describe("insertCalloutAfterParagraph", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("inserts callout after paragraph 1", () => {
      const doc = "Para 1.\n\nPara 2.\n\nPara 3.";
      const callout = "\n<!-- callout -->\n> text\n";
      const result = canvasAgent.insertCalloutAfterParagraph(doc, callout, 1);
      expect(result.indexOf("Para 1.")).toBeLessThan(result.indexOf("<!-- callout -->"));
      expect(result.indexOf("<!-- callout -->")).toBeLessThan(result.indexOf("Para 2."));
    });

    it("inserts callout after paragraph 2", () => {
      const doc = "Para 1.\n\nPara 2.\n\nPara 3.";
      const callout = "\n<!-- callout -->\n> text\n";
      const result = canvasAgent.insertCalloutAfterParagraph(doc, callout, 2);
      expect(result.indexOf("Para 2.")).toBeLessThan(result.indexOf("<!-- callout -->"));
      expect(result.indexOf("<!-- callout -->")).toBeLessThan(result.indexOf("Para 3."));
    });

    it("appends at end when paragraphIndex exceeds paragraph count", () => {
      const doc = "Only one paragraph.";
      const callout = "\n<!-- callout -->\n> text\n";
      const result = canvasAgent.insertCalloutAfterParagraph(doc, callout, 99);
      expect(result).toBe(doc + callout);
    });

    it("preserves all original content", () => {
      const doc = "A.\n\nB.\n\nC.";
      const callout = "\n<!-- callout -->\n> note\n";
      const result = canvasAgent.insertCalloutAfterParagraph(doc, callout, 2);
      expect(result).toContain("A.");
      expect(result).toContain("B.");
      expect(result).toContain("C.");
      expect(result).toContain("<!-- callout -->");
    });
  });

  describe("appendAgentCallout with inline placement hint", () => {
    it("appends at end when no placement hint is present", async () => {
      const originalContent = "# Doc\n\nSome content.";
      const app = makeApp({ readContent: originalContent }) as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = { extension: "md" } as never;
      await canvasAgent.appendAgentCallout(fakeFile, "Bot", "Normal response.");

      const vault = (app as { vault: { modify: ReturnType<typeof vi.fn> } }).vault;
      const writtenContent = vault.modify.mock.calls[0]?.[1] as string;
      expect(writtenContent.endsWith("Normal response.\n")).toBe(true);
    });

    it("inserts callout inline when @after-paragraph-1: hint is present", async () => {
      const originalContent = "Paragraph 1.\n\nParagraph 2.";
      let storedContent = originalContent;
      const modifyMock = vi.fn(async (_f: unknown, c: string) => { storedContent = c; });
      const readMock = vi.fn(async () => storedContent);
      const app = {
        workspace: { getActiveFile: vi.fn(() => null), activeEditor: null },
        vault: { read: readMock, modify: modifyMock },
        metadataCache: { getFileCache: vi.fn(() => null) },
      } as never;
      const canvasAgent = new CanvasAgent(app);

      const fakeFile = {} as never;
      await canvasAgent.appendAgentCallout(fakeFile, "Bot", "@after-paragraph-1: Note on first para.");

      expect(storedContent.indexOf("Paragraph 1.")).toBeLessThan(storedContent.indexOf("Note on first para."));
      expect(storedContent.indexOf("Note on first para.")).toBeLessThan(storedContent.indexOf("Paragraph 2."));
    });

    it("returns callout text without the placement hint", async () => {
      const app = makeApp({ readContent: "Para 1.\n\nPara 2." }) as never;
      const canvasAgent = new CanvasAgent(app);
      const fakeFile = {} as never;
      const calloutText = await canvasAgent.appendAgentCallout(fakeFile, "Bot", "@after-paragraph-1: Note.");
      expect(calloutText).not.toContain("@after-paragraph-1:");
      expect(calloutText).toContain("Note.");
    });
  });

  // ── Phase 4 – Diff view ────────────────────────────────────────────────────

  describe("extractCanvasCallouts", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("returns empty array when no canvas callouts are present", () => {
      const doc = "# Title\n\nNormal content.";
      expect(canvasAgent.extractCanvasCallouts(doc)).toHaveLength(0);
    });

    it("extracts a single agent callout", () => {
      const doc = [
        "# Doc",
        "",
        CANVAS_MARKER,
        "> [!note] 🤖 Agent: Bot *(2026-01-01T10:00:00Z)*",
        ">",
        "> Some feedback.",
        "",
        "Footer.",
      ].join("\n");

      const callouts = canvasAgent.extractCanvasCallouts(doc);
      expect(callouts).toHaveLength(1);
      expect(callouts[0]?.type).toBe("agent");
      expect(callouts[0]?.body).toContain("Some feedback.");
    });

    it("extracts both agent and user callouts", () => {
      const doc = [
        "Doc text.",
        CANVAS_MARKER,
        "> [!note] 🤖 Agent: Bot *(2026-01-01T10:00:00Z)*",
        ">",
        "> Agent response.",
        "",
        CANVAS_MARKER,
        "> [!question] 👤 User *(2026-01-01T10:01:00Z)*",
        ">",
        "> User reply.",
      ].join("\n");

      const callouts = canvasAgent.extractCanvasCallouts(doc);
      expect(callouts).toHaveLength(2);
      expect(callouts[0]?.type).toBe("agent");
      expect(callouts[1]?.type).toBe("user");
    });

    it("extracts title text without '> ' prefix", () => {
      const doc = [
        CANVAS_MARKER,
        "> [!note] 🤖 Agent: Research Bot *(2026-01-01T00:00:00Z)*",
        ">",
        "> Content.",
      ].join("\n");

      const callouts = canvasAgent.extractCanvasCallouts(doc);
      expect(callouts[0]?.title).toBe("[!note] 🤖 Agent: Research Bot *(2026-01-01T00:00:00Z)*");
    });
  });

  // ── Phase 4 – buildInitialPrompt includes placement hint instructions ──────

  describe("buildInitialPrompt (Phase 4 update)", () => {
    let canvasAgent: CanvasAgent;
    beforeEach(() => {
      canvasAgent = new CanvasAgent(makeApp() as never);
    });

    it("mentions @after-paragraph-N: placement hint syntax", () => {
      const prompt = canvasAgent.buildInitialPrompt("# Doc\n\nContent.");
      expect(prompt).toContain("@after-paragraph-N:");
    });
  });
});

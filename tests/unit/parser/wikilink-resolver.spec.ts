/**
 * Tests für WikilinkResolver
 */

import { describe, it, expect, beforeEach } from "vitest";
import { App, TFile } from "../../mocks/obsidian";
import WikilinkResolver from "../../../src/parser/wikilink-resolver";

/** Creates a vault file and returns the TFile. */
async function createFile(app: App, path: string, content: string): Promise<TFile> {
  return (app.vault as any).create(path, content) as Promise<TFile>;
}

describe("WikilinkResolver", () => {
  let app: App;
  let resolver: WikilinkResolver;

  beforeEach(() => {
    app = new App();
    resolver = new WikilinkResolver(app as any);
  });

  /** Creates files in the vault and resolves wikilinks in the provided content. */
  async function resolveWith(
    files: Array<[string, string]>,
    content: string,
    sourcePath = "",
    customResolver?: WikilinkResolver
  ): Promise<string> {
    for (const [path, fileContent] of files) {
      await createFile(app, path, fileContent);
    }
    return (customResolver ?? resolver).resolve(content, sourcePath);
  }

  describe("basic resolution", () => {
    it("returns content unchanged when no wikilinks present", async () => {
      const content = "Kein Wikilink in diesem Text.";
      expect(await resolver.resolve(content, "")).toBe(content);
    });

    it("embeds content of a linked file via vault path fallback", async () => {
      const result = await resolveWith(
        [["notes/info.md", "Inhalt der Info-Datei."]],
        "Einleitung\n[[notes/info]]\nAbschluss",
        "agents/agent.md"
      );
      expect(result).toContain("Inhalt der Info-Datei.");
    });

    it("leaves wikilink unchanged when target file not found", async () => {
      const content = "Text mit [[nicht-vorhanden]].";
      expect(await resolver.resolve(content, "")).toBe(content);
    });

    it("resolves wikilink via metadataCache when registered", async () => {
      const file = await createFile(app, "context/background.md", "Hintergrundinformation.");
      (app.metadataCache as any).registerLink("background", file);
      const result = await resolver.resolve("Kontext: [[background]]", "agents/agent.md");
      expect(result).toContain("Hintergrundinformation.");
    });

    it("uses .md extension fallback when exact match not found", async () => {
      const result = await resolveWith(
        [["context/background.md", "Hintergrund-Inhalt."]],
        "[[context/background]]"
      );
      expect(result).toContain("Hintergrund-Inhalt.");
    });
  });

  describe("wikilink syntax variants", () => {
    it("handles alias syntax [[Dateiname|Alias]]", async () => {
      const result = await resolveWith(
        [["notes/hello.md", "Hello World"]],
        "Siehe [[notes/hello|Begrüßung]]"
      );
      expect(result).toContain("Hello World");
      expect(result).not.toContain("notes/hello|Begrüßung");
    });

    it("handles section reference syntax [[Dateiname#Abschnitt]]", async () => {
      const result = await resolveWith(
        [["notes/chapter.md", "Kapitel-Inhalt"]],
        "Verweis: [[notes/chapter#Einleitung]]"
      );
      expect(result).toContain("Kapitel-Inhalt");
    });

    it("handles alias with section [[Dateiname#Abschnitt|Alias]]", async () => {
      const result = await resolveWith(
        [["notes/doc.md", "Dokumenten-Inhalt"]],
        "[[notes/doc#Abschnitt|Anzeigename]]"
      );
      expect(result).toContain("Dokumenten-Inhalt");
    });

    it("handles multiple different wikilinks in one text", async () => {
      const result = await resolveWith(
        [["a.md", "Inhalt A"], ["b.md", "Inhalt B"]],
        "Start [[a]] Mitte [[b]] Ende"
      );
      expect(result).toContain("Inhalt A");
      expect(result).toContain("Inhalt B");
    });

    it("handles duplicate wikilinks (same link appears twice)", async () => {
      const result = await resolveWith(
        [["shared.md", "Gemeinsamer Inhalt"]],
        "[[shared]] und nochmal [[shared]]"
      );
      expect(result).not.toContain("[[shared]]");
      const occurrences = (result.match(/Gemeinsamer Inhalt/g) || []).length;
      expect(occurrences).toBe(2);
    });
  });

  describe("content wrapping", () => {
    it("wraps embedded content with comment markers by default", async () => {
      const result = await resolveWith([["note.md", "Notizinhalt"]], "[[note]]");
      expect(result).toContain("<!-- wikilink:note.md -->");
      expect(result).toContain("<!-- /wikilink:note.md -->");
    });

    it("does not wrap content when wrapContent is false", async () => {
      const noWrapResolver = new WikilinkResolver(app as any, { wrapContent: false });
      const result = await resolveWith([["note.md", "Notizinhalt"]], "[[note]]", "", noWrapResolver);
      expect(result).not.toContain("<!-- wikilink:");
      expect(result).toContain("Notizinhalt");
    });
  });

  describe("recursion", () => {
    it("resolves wikilinks in embedded files (depth 1)", async () => {
      const result = await resolveWith(
        [["leaf.md", "Blatt-Inhalt"], ["branch.md", "Zweig mit [[leaf]]"]],
        "Baum: [[branch]]"
      );
      expect(result).toContain("Zweig mit");
      expect(result).toContain("Blatt-Inhalt");
    });

    it("stops at maxDepth and leaves deeper wikilinks unresolved", async () => {
      // maxDepth = 2: resolve at depth 0 (d0) and depth 1 (d1),
      // but at depth 2 resolution stops immediately → [[d2]] stays unresolved
      const shallowResolver = new WikilinkResolver(app as any, { maxDepth: 2, wrapContent: false });
      const result = await resolveWith(
        [
          ["d0.md", "Ebene 0 → [[d1]]"],
          ["d1.md", "Ebene 1 → [[d2]]"],
          ["d2.md", "Ebene 2 → [[d3]]"],
          ["d3.md", "Ebene 3"],
        ],
        "[[d0]]",
        "",
        shallowResolver
      );
      expect(result).toContain("Ebene 0");
      expect(result).toContain("Ebene 1");
      expect(result).toContain("[[d2]]");
      expect(result).not.toContain("Ebene 2");
    });
  });

  describe("cycle detection", () => {
    it("does not recurse infinitely when files reference each other", async () => {
      const result = await resolveWith(
        [["ping.md", "Ping → [[pong]]"], ["pong.md", "Pong → [[ping]]"]],
        "[[ping]]"
      );
      expect(result).toContain("Ping");
      expect(result).toContain("Pong");
    });

    it("does not embed a file that is already in the call stack (direct self-reference)", async () => {
      const result = await resolveWith([["self.md", "Selbst → [[self]]"]], "[[self]]");
      // "self" gets embedded once, but the inner [[self]] stays as-is
      expect(result).toContain("Selbst");
      const embedded = /Selbst → \[\[self\]\]/.exec(result);
      expect(embedded).not.toBeNull();
    });
  });

  describe("non-markdown files", () => {
    it("leaves wikilinks to non-.md files unchanged", async () => {
      await createFile(app, "image.png", "binary data");
      const content = "Bild: [[image.png]]";
      // PNG is not a .md file, so it stays unresolved
      expect(await resolver.resolve(content, "")).toBe(content);
    });
  });

  describe("agent context integration", () => {
    it("resolves wikilinks in agent system prompt content", async () => {
      const agentContent = `---
agent: true
id: test_agent
name: Test Agent
---

## System Prompt
Du bist ein Assistent.

[[knowledge/rules]]
`;
      const result = await resolveWith(
        [["knowledge/rules.md", "Regel 1: Immer höflich sein."]],
        agentContent,
        "agents/agent.md"
      );
      expect(result).toContain("Regel 1: Immer höflich sein.");
    });

    it("resolves wikilinks in context section", async () => {
      const agentContent = `---
agent: true
id: med_agent
name: Medical Agent
---

## System Prompt
Du bist ein Medizin-Experte.

## Kontext
[[context/domain]]
`;
      const result = await resolveWith(
        [["context/domain.md", "Fachgebiet: Medizin"]],
        agentContent,
        "agents/medical.md"
      );
      expect(result).toContain("Fachgebiet: Medizin");
    });
  });
});

/**
 * Tests für WikilinkResolver
 */

import { describe, it, expect, beforeEach } from "vitest";
import { App, TFile } from "../../mocks/obsidian";
import WikilinkResolver from "../../../src/parser/wikilink-resolver";

/**
 * Hilfsfunktion: Erstellt eine Vault-Datei und gibt den TFile zurück.
 */
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

  // ===========================
  // Grundlegende Auflösung
  // ===========================

  describe("basic resolution", () => {
    it("returns content unchanged when no wikilinks present", async () => {
      const content = "Kein Wikilink in diesem Text.";
      const result = await resolver.resolve(content, "");
      expect(result).toBe(content);
    });

    it("embeds content of a linked file via vault path fallback", async () => {
      await createFile(app, "notes/info.md", "Inhalt der Info-Datei.");
      const content = "Einleitung\n[[notes/info]]\nAbschluss";
      const result = await resolver.resolve(content, "agents/agent.md");
      expect(result).toContain("Inhalt der Info-Datei.");
    });

    it("leaves wikilink unchanged when target file not found", async () => {
      const content = "Text mit [[nicht-vorhanden]].";
      const result = await resolver.resolve(content, "");
      expect(result).toBe(content);
    });

    it("resolves wikilink via metadataCache when registered", async () => {
      const file = await createFile(app, "context/background.md", "Hintergrundinformation.");
      (app.metadataCache as any).registerLink("background", file);

      const content = "Kontext: [[background]]";
      const result = await resolver.resolve(content, "agents/agent.md");
      expect(result).toContain("Hintergrundinformation.");
    });

    it("uses .md extension fallback when exact match not found", async () => {
      await createFile(app, "context/background.md", "Hintergrund-Inhalt.");
      const content = "[[context/background]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Hintergrund-Inhalt.");
    });
  });

  // ===========================
  // Wikilink-Syntax-Varianten
  // ===========================

  describe("wikilink syntax variants", () => {
    it("handles alias syntax [[Dateiname|Alias]]", async () => {
      await createFile(app, "notes/hello.md", "Hello World");
      const content = "Siehe [[notes/hello|Begrüßung]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Hello World");
      expect(result).not.toContain("notes/hello|Begrüßung");
    });

    it("handles section reference syntax [[Dateiname#Abschnitt]]", async () => {
      await createFile(app, "notes/chapter.md", "Kapitel-Inhalt");
      const content = "Verweis: [[notes/chapter#Einleitung]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Kapitel-Inhalt");
    });

    it("handles alias with section [[Dateiname#Abschnitt|Alias]]", async () => {
      await createFile(app, "notes/doc.md", "Dokumenten-Inhalt");
      const content = "[[notes/doc#Abschnitt|Anzeigename]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Dokumenten-Inhalt");
    });

    it("handles multiple different wikilinks in one text", async () => {
      await createFile(app, "a.md", "Inhalt A");
      await createFile(app, "b.md", "Inhalt B");
      const content = "Start [[a]] Mitte [[b]] Ende";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Inhalt A");
      expect(result).toContain("Inhalt B");
    });

    it("handles duplicate wikilinks (same link appears twice)", async () => {
      await createFile(app, "shared.md", "Gemeinsamer Inhalt");
      const content = "[[shared]] und nochmal [[shared]]";
      const result = await resolver.resolve(content, "");
      // Both occurrences should be replaced
      expect(result).not.toContain("[[shared]]");
      const occurrences = (result.match(/Gemeinsamer Inhalt/g) || []).length;
      expect(occurrences).toBe(2);
    });
  });

  // ===========================
  // Wrapper-Format
  // ===========================

  describe("content wrapping", () => {
    it("wraps embedded content with comment markers by default", async () => {
      await createFile(app, "note.md", "Notizinhalt");
      const content = "[[note]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("<!-- wikilink:note.md -->");
      expect(result).toContain("<!-- /wikilink:note.md -->");
    });

    it("does not wrap content when wrapContent is false", async () => {
      await createFile(app, "note.md", "Notizinhalt");
      const noWrapResolver = new WikilinkResolver(app as any, { wrapContent: false });
      const content = "[[note]]";
      const result = await noWrapResolver.resolve(content, "");
      expect(result).not.toContain("<!-- wikilink:");
      expect(result).toContain("Notizinhalt");
    });
  });

  // ===========================
  // Rekursion
  // ===========================

  describe("recursion", () => {
    it("resolves wikilinks in embedded files (depth 1)", async () => {
      await createFile(app, "leaf.md", "Blatt-Inhalt");
      await createFile(app, "branch.md", "Zweig mit [[leaf]]");
      const content = "Baum: [[branch]]";
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Zweig mit");
      expect(result).toContain("Blatt-Inhalt");
    });

    it("stops at maxDepth and leaves deeper wikilinks unresolved", async () => {
      await createFile(app, "d0.md", "Ebene 0 → [[d1]]");
      await createFile(app, "d1.md", "Ebene 1 → [[d2]]");
      await createFile(app, "d2.md", "Ebene 2 → [[d3]]");
      await createFile(app, "d3.md", "Ebene 3");

      // maxDepth = 2: resolve at depth 0 (d0) and depth 1 (d1),
      // but at depth 2 resolution stops immediately → [[d2]] stays unresolved
      const shallowResolver = new WikilinkResolver(app as any, { maxDepth: 2, wrapContent: false });
      const content = "[[d0]]";
      const result = await shallowResolver.resolve(content, "");

      expect(result).toContain("Ebene 0");
      expect(result).toContain("Ebene 1");
      // [[d2]] must remain unresolved because depth 2 >= maxDepth
      expect(result).toContain("[[d2]]");
      expect(result).not.toContain("Ebene 2");
    });
  });

  // ===========================
  // Zyklenerkennung
  // ===========================

  describe("cycle detection", () => {
    it("does not recurse infinitely when files reference each other", async () => {
      await createFile(app, "ping.md", "Ping → [[pong]]");
      await createFile(app, "pong.md", "Pong → [[ping]]");
      const content = "[[ping]]";
      // Should resolve without throwing and terminate
      const result = await resolver.resolve(content, "");
      expect(result).toContain("Ping");
      expect(result).toContain("Pong");
    });

    it("does not embed a file that is already in the call stack (direct self-reference)", async () => {
      await createFile(app, "self.md", "Selbst → [[self]]");
      const content = "[[self]]";
      const result = await resolver.resolve(content, "");
      // "self" gets embedded once, but the inner [[self]] stays as-is
      expect(result).toContain("Selbst");
      // After embedding self.md, the inner [[self]] must not be resolved again
      const embedded = result.match(/Selbst → \[\[self\]\]/);
      expect(embedded).not.toBeNull();
    });
  });

  // ===========================
  // Nicht-Markdown-Dateien
  // ===========================

  describe("non-markdown files", () => {
    it("leaves wikilinks to non-.md files unchanged", async () => {
      await createFile(app, "image.png", "binary data");
      const content = "Bild: [[image.png]]";
      const result = await resolver.resolve(content, "");
      // PNG is not a .md file, so it stays unresolved
      expect(result).toBe(content);
    });
  });

  // ===========================
  // Integration: Agenten-Kontext
  // ===========================

  describe("agent context integration", () => {
    it("resolves wikilinks in agent system prompt content", async () => {
      await createFile(app, "knowledge/rules.md", "Regel 1: Immer höflich sein.");
      const agentContent = `---
agent: true
id: test_agent
name: Test Agent
---

## System Prompt
Du bist ein Assistent.

[[knowledge/rules]]
`;
      const result = await resolver.resolve(agentContent, "agents/agent.md");
      expect(result).toContain("Regel 1: Immer höflich sein.");
    });

    it("resolves wikilinks in context section", async () => {
      await createFile(app, "context/domain.md", "Fachgebiet: Medizin");
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
      const result = await resolver.resolve(agentContent, "agents/medical.md");
      expect(result).toContain("Fachgebiet: Medizin");
    });
  });
});

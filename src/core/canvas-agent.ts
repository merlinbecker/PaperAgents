/**
 * CanvasAgent - Core service for the Agent Canvas feature.
 *
 * Responsibilities:
 * - Build document context for the agent (stripping previous canvas callouts)
 * - Append agent and user callouts to the active Markdown file
 * - Read `paper-agent` frontmatter to resolve a pre-configured agent
 */

import { App, TFile } from "obsidian";
import type { AgentDefinition } from "../types";

/**
 * Marker comment that identifies canvas-injected callout blocks.
 * Lines with this comment are stripped when building document context
 * so previous agent callouts are not re-fed to the LLM.
 */
export const CANVAS_MARKER = "<!-- paper-agents-canvas -->";

/**
 * Frontmatter key used to pre-configure an agent for a document.
 * Example frontmatter:
 *   ---
 *   paper-agent: research_assistant
 *   ---
 */
export const CANVAS_FRONTMATTER_KEY = "paper-agent";

export class CanvasAgent {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  // ============================================================================
  // Document reading
  // ============================================================================

  /**
   * Returns the active Markdown file, or null if none is open.
   */
  getActiveFile(): TFile | null {
    const file = this.app.workspace.getActiveFile();
    if (file?.extension !== "md") return null;
    return file;
  }

  /**
   * Reads the full content of a file from the vault.
   */
  async readFile(file: TFile): Promise<string> {
    return this.app.vault.read(file);
  }

  /**
   * Extracts the `paper-agent` value from the YAML frontmatter of a file
   * content string.  Returns null if the key is absent.
   */
  extractAgentId(content: string): string | null {
    const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!frontmatterMatch?.[1]) return null;

    for (const line of frontmatterMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (key === CANVAS_FRONTMATTER_KEY && value) {
        return value;
      }
    }
    return null;
  }

  /**
   * Returns the document content suitable for the agent context.
   * Canvas callout blocks (marked with CANVAS_MARKER) are stripped so the
   * agent only receives the original document text plus user follow-ups.
   */
  buildDocumentContext(content: string): string {
    const lines = content.split("\n");
    const result: string[] = [];
    let skip = false;

    for (const line of lines) {
      if (line.trim() === CANVAS_MARKER) {
        skip = true;
        continue;
      }
      // A canvas block ends when a non-blockquote, non-empty line appears
      // after we started skipping, unless the next line is also part of a callout.
      if (skip) {
        if (line.startsWith(">") || line.trim() === "") {
          continue;
        }
        skip = false;
      }
      result.push(line);
    }

    return result.join("\n").trim();
  }

  /**
   * Builds the initial prompt sent to the agent when starting a canvas session.
   */
  buildInitialPrompt(documentContent: string): string {
    const defaultSystemPrompt =
      "You are reviewing the following document. Provide annotations, feedback, or analysis. " +
      "When referencing a specific part of the document, quote it briefly. " +
      "To place your annotation after a specific paragraph, start your response with " +
      "`@after-paragraph-N:` (e.g., `@after-paragraph-3:`) on the first line. " +
      "Otherwise your annotation will be appended at the end of the document.";
    return this.buildInitialPromptWithSystem(documentContent, defaultSystemPrompt);
  }

  /**
   * Builds the initial prompt with a custom system prompt string.
   * The system prompt replaces the built-in default instructions.
   */
  buildInitialPromptWithSystem(documentContent: string, systemPrompt: string): string {
    return (
      systemPrompt +
      "\n\n" +
      "=== DOCUMENT ===\n" +
      documentContent +
      "\n=== END ==="
    );
  }

  // ============================================================================
  // Callout injection
  // ============================================================================

  /**
   * Appends an agent-response callout block to the given file.
   * If the responseText starts with an `@after-paragraph-N:` hint, the callout
   * is inserted after paragraph N instead of being appended at the end.
   * Returns the exact callout text that was appended (can be used to remove it later).
   */
  async appendAgentCallout(file: TFile, agentName: string, responseText: string): Promise<string> {
    const { paragraphIndex, cleanedText } = this.parseInlinePlacement(responseText);
    const callout = this.formatAgentCallout(agentName, cleanedText);

    if (paragraphIndex === null) {
      await this.appendToFile(file, callout);
    } else {
      const current = await this.app.vault.read(file);
      const updated = this.insertCalloutAfterParagraph(current, callout, paragraphIndex);
      await this.app.vault.modify(file, updated);
    }

    return callout;
  }

  /**
   * Appends a user-message callout block to the given file.
   * Returns the exact callout text that was appended (can be used to remove it later).
   */
  async appendUserCallout(file: TFile, userMessage: string): Promise<string> {
    const callout = this.formatUserCallout(userMessage);
    await this.appendToFile(file, callout);
    return callout;
  }

  /**
   * Removes a specific canvas callout block from the file.
   * The calloutText parameter must be the exact string returned by
   * appendAgentCallout or appendUserCallout.
   *
   * Returns true if the callout was found and removed, false otherwise.
   */
  async removeCallout(file: TFile, calloutText: string): Promise<boolean> {
    const current = await this.app.vault.read(file);
    const updated = current.replace(calloutText, "");
    if (updated === current) return false;
    await this.app.vault.modify(file, updated);
    return true;
  }

  // ============================================================================
  // Formatting helpers
  // ============================================================================

  /**
   * Formats an agent response as an Obsidian callout string.
   *
   * Example output:
   * ```
   * <!-- paper-agents-canvas -->
   * > [!note] 🤖 Agent: Research Assistant *(2026-01-01T10:05:00Z)*
   * >
   * > Agent response text here...
   * ```
   */
  formatAgentCallout(agentName: string, text: string): string {
    const timestamp = new Date().toISOString().split(".")[0] + "Z";
    const titleLine = `> [!note] 🤖 Agent: ${agentName} *(${timestamp})*`;
    const body = this.formatCalloutBody(text);
    return `\n${CANVAS_MARKER}\n${titleLine}\n>\n${body}\n`;
  }

  /**
   * Formats a user follow-up as an Obsidian callout string.
   *
   * Example output:
   * ```
   * <!-- paper-agents-canvas -->
   * > [!question] 👤 User *(2026-01-01T10:07:00Z)*
   * >
   * > User message here...
   * ```
   */
  formatUserCallout(text: string): string {
    const timestamp = new Date().toISOString().split(".")[0] + "Z";
    const titleLine = `> [!question] 👤 User *(${timestamp})*`;
    const body = this.formatCalloutBody(text);
    return `\n${CANVAS_MARKER}\n${titleLine}\n>\n${body}\n`;
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private formatCalloutBody(text: string): string {
    return text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  private async appendToFile(file: TFile, text: string): Promise<void> {
    const current = await this.app.vault.read(file);
    await this.app.vault.modify(file, current + text);
  }

  // ============================================================================
  // Selection context
  // ============================================================================

  /**
   * Returns the currently selected text in the active editor, or null if
   * nothing is selected or no Markdown editor is active.
   *
   * Uses duck-typing against the workspace to avoid a hard dependency on
   * MarkdownView (which would require importing it and updating the test mock).
   */
  getActiveEditorSelection(): string | null {
    const workspace = this.app.workspace as unknown as {
      activeEditor?: { editor?: { getSelection(): string } | null } | null;
    };
    const selection = workspace.activeEditor?.editor?.getSelection();
    return selection?.trim() || null;
  }

  /**
   * Builds the initial prompt sent to the agent when a text selection is the
   * context (rather than the full document).
   */
  buildSelectionPrompt(selectionContent: string): string {
    return (
      "You are reviewing the following selected text from a document. " +
      "Provide annotations, feedback, or analysis. " +
      "When referencing a specific part of the text, quote it briefly.\n\n" +
      "=== SELECTED TEXT ===\n" +
      selectionContent +
      "\n=== END ==="
    );
  }

  // ============================================================================
  // Agent resolution helper
  // ============================================================================

  /**
   * Resolves the agent to use for a canvas session.
   * Returns the agent if found by ID, or null if not found.
   */
  resolveAgent(agentId: string, agents: AgentDefinition[]): AgentDefinition | null {
    return agents.find((a) => a.id === agentId) ?? null;
  }

  // ============================================================================
  // Inline placement (Phase 4)
  // ============================================================================

  /**
   * Parses an inline placement hint from an agent response.
   *
   * Hints take the form `@after-paragraph-N:` at the very start of the
   * response (optionally followed by a newline). N must be a positive integer.
   *
   * Returns `{ paragraphIndex: N, cleanedText }` when a valid hint is found,
   * or `{ paragraphIndex: null, cleanedText: responseText }` when there is no
   * hint or the hint is malformed.
   */
  parseInlinePlacement(responseText: string): { paragraphIndex: number | null; cleanedText: string } {
    const match = /^@after-paragraph-(\d+):\s*/i.exec(responseText);
    if (!match?.[1]) {
      return { paragraphIndex: null, cleanedText: responseText };
    }
    const paragraphIndex = Number.parseInt(match[1], 10);
    if (!Number.isFinite(paragraphIndex) || paragraphIndex < 1) {
      return { paragraphIndex: null, cleanedText: responseText };
    }
    return { paragraphIndex, cleanedText: responseText.slice(match[0].length) };
  }

  /**
   * Inserts a callout block after the N-th paragraph in the document content.
   *
   * Paragraphs are counted as consecutive non-blank lines separated by blank
   * lines (similar to how Markdown renders). If `paragraphIndex` is larger
   * than the number of paragraphs, the callout is appended to the end.
   *
   * The `calloutText` is expected to start with `\n` (as produced by
   * `formatAgentCallout`), so the insertion is seamless.
   */
  insertCalloutAfterParagraph(content: string, calloutText: string, paragraphIndex: number): string {
    const lines = content.split("\n");
    let currentParagraph = 0;
    let inParagraph = false;
    let targetLastLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const isBlank = line.trim() === "";

      if (!isBlank && !inParagraph) {
        inParagraph = true;
        currentParagraph++;
      }

      if (inParagraph && !isBlank && currentParagraph === paragraphIndex) {
        targetLastLine = i; // updated on each non-blank line of the target paragraph
      }

      if (isBlank && inParagraph) {
        inParagraph = false;
        if (currentParagraph === paragraphIndex) {
          break; // end of the target paragraph found
        }
      }
    }

    // If paragraphIndex exceeds the number of paragraphs, fall back to append
    if (currentParagraph < paragraphIndex || targetLastLine === -1) {
      return content + calloutText;
    }

    const before = lines.slice(0, targetLastLine + 1).join("\n");
    const after = lines.slice(targetLastLine + 1).join("\n");
    // calloutText starts with \n; after starts with the separator lines
    return before + calloutText + after;
  }

  // ============================================================================
  // Diff view helpers (Phase 4)
  // ============================================================================

  /**
   * Extracts all canvas callout blocks from document content.
   *
   * Returns an array of objects describing each callout:
   *  - `type`: `"agent"` for `[!note]` callouts, `"user"` for `[!question]` callouts
   *  - `raw`: the full callout string including marker
   *  - `title`: the callout title line (without `> `)
   *  - `body`: the body text of the callout (lines with `> ` prefix stripped)
   */
  extractCanvasCallouts(content: string): Array<{ type: "agent" | "user"; raw: string; title: string; body: string }> {
    const result: Array<{ type: "agent" | "user"; raw: string; title: string; body: string }> = [];
    const lines = content.split("\n");
    let blockLines: string[] = [];
    let inBlock = false;

    const flushBlock = () => {
      if (!inBlock || blockLines.length === 0) return;
      const raw = blockLines.join("\n");
      const titleLine = blockLines.find((l) => l.startsWith("> [!")) ?? "";
      const title = titleLine.replace(/^> /, "");
      const bodyLines = blockLines
        .filter((l) => l.startsWith("> ") && !l.startsWith("> [!") && l !== ">")
        .map((l) => l.replace(/^> /, ""));
      const body = bodyLines.join("\n");
      const type: "agent" | "user" = title.includes("[!question]") ? "user" : "agent";
      result.push({ type, raw, title, body });
      blockLines = [];
      inBlock = false;
    };

    for (const line of lines) {
      if (line.trim() === CANVAS_MARKER) {
        flushBlock();
        inBlock = true;
        blockLines = [line];
        continue;
      }
      if (inBlock) {
        if (line.startsWith(">") || line.trim() === "") {
          blockLines.push(line);
        } else {
          flushBlock();
        }
      }
    }
    flushBlock();

    return result;
  }
}


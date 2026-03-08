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
    if (!file || file.extension !== "md") return null;
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
    return (
      "You are reviewing the following document. Provide annotations, feedback, or analysis. " +
      "When referencing a specific part of the document, quote it briefly.\n\n" +
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
   * Returns the exact callout text that was appended (can be used to remove it later).
   */
  async appendAgentCallout(file: TFile, agentName: string, responseText: string): Promise<string> {
    const callout = this.formatAgentCallout(agentName, responseText);
    await this.appendToFile(file, callout);
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
  // Agent resolution helper
  // ============================================================================

  /**
   * Resolves the agent to use for a canvas session.
   * Returns the agent if found by ID, or null if not found.
   */
  resolveAgent(agentId: string, agents: AgentDefinition[]): AgentDefinition | null {
    return agents.find((a) => a.id === agentId) ?? null;
  }
}

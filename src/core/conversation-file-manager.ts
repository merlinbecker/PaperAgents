/**
 * ConversationFileManager - Persists conversations as Markdown files in the vault
 *
 * A conversation file uses YAML frontmatter for metadata and the ### Role (timestamp)
 * notation for messages, so users can read and edit conversations directly in Obsidian.
 *
 * Format:
 * ---
 * conversation: true
 * id: conv_1234_abcde
 * agentId: research_assistant
 * createdAt: 2026-01-01T10:00:00.000Z
 * updatedAt: 2026-01-01T10:05:00.000Z
 * ---
 *
 * ### User (2026-01-01T10:00:00.000Z)
 * Hello!
 *
 * ### Assistant (2026-01-01T10:01:00.000Z)
 * Hi there!
 */

import { App, TFile, TFolder } from "obsidian";
import type { Conversation } from "../types";
import { ConversationManager } from "./conversation";
import { globalLogger } from "../utils/logger";

export class ConversationFileManager {
  private app: App;
  private conversationManager: ConversationManager;

  constructor(app: App, conversationManager: ConversationManager) {
    this.app = app;
    this.conversationManager = conversationManager;
  }

  /**
   * Save a conversation to a Markdown file in the vault.
   * Creates the file if it does not exist; overwrites if it does.
   */
  async saveConversation(filePath: string, conversationId: string): Promise<void> {
    const content = this.conversationManager.toConversationFile(conversationId);
    if (content === null) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(filePath, content);
    }

    globalLogger.debug(`Conversation saved to ${filePath}`);
  }

  /**
   * Load a conversation from a Markdown file in the vault.
   * Returns the loaded Conversation or null if the file is not a conversation file.
   */
  async loadConversation(filePath: string): Promise<Conversation | null> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.app.vault.read(file);
    const conversation = this.conversationManager.loadFromConversationFile(content);

    if (!conversation) {
      globalLogger.debug(`File is not a conversation file: ${filePath}`);
      return null;
    }

    globalLogger.debug(`Conversation loaded from ${filePath}: ${conversation.id}`);
    return conversation;
  }

  /**
   * Create a new conversation file for an existing conversation.
   * Returns the file path of the created file.
   */
  async createConversationFile(conversationId: string, conversationsPath: string, title?: string): Promise<string> {
    await this.ensureFolder(conversationsPath);

    const conversation = this.conversationManager.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const date = new Date().toISOString().slice(0, 10);
    const safeName = (title || conversation.agentId).replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "-");
    const fileName = `${date}-${safeName}.md`;
    const filePath = `${conversationsPath}/${fileName}`;

    await this.saveConversation(filePath, conversationId);

    globalLogger.info(`Created conversation file: ${filePath}`);
    return filePath;
  }

  /**
   * Check if a file is a conversation file (has conversation: true frontmatter).
   */
  async isConversationFile(filePath: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return false;

    try {
      const content = await this.app.vault.read(file);
      return content.startsWith("---") && content.includes("conversation: true");
    } catch {
      return false;
    }
  }

  /**
   * List all Markdown files in a folder as conversation file descriptors.
   * Returns an array of { path, title } sorted alphabetically by title.
   */
  listConversationFiles(folderPath: string): { path: string; title: string }[] {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder || !(folder instanceof TFolder)) return [];

    const results: { path: string; title: string }[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        results.push({ path: child.path, title: child.basename });
      }
    }
    return results.sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Ensure a folder exists in the vault, creating it if needed.
   */
  private async ensureFolder(folderPath: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(folderPath);
    if (!existing) {
      await this.app.vault.createFolder(folderPath);
    }
  }
}

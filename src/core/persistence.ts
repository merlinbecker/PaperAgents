/**
 * Persistence - Data persistence helpers for vault storage
 * Handles saving/loading JSON data to the plugin's data folder
 */

import { TFile, Vault } from "obsidian";
import { executionHistory } from "./history";
import { ConversationManager } from "./conversation";
import { globalLogger } from "../utils/logger";

const PLUGIN_DATA_FOLDER = ".obsidian/plugins/paper-agents";
const HISTORY_PATH = `${PLUGIN_DATA_FOLDER}/history.json`;
const CONVERSATIONS_PATH = `${PLUGIN_DATA_FOLDER}/conversations.json`;

/**
 * Creates a save function for a given path in the vault
 */
function createVaultSaver(vault: Vault, path: string): (data: string) => Promise<void> {
  return async (data: string) => {
    if (!vault.getAbstractFileByPath(PLUGIN_DATA_FOLDER)) {
      await vault.createFolder(PLUGIN_DATA_FOLDER).catch(() => {});
    }
    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await vault.modify(existing, data);
    } else {
      await vault.create(path, data);
    }
  };
}

/**
 * Creates a load function for a given path in the vault
 */
function createVaultLoader(vault: Vault, path: string): () => Promise<string | null> {
  return async () => {
    const file = vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return await vault.read(file);
    }
    return null;
  };
}

/**
 * Initialize execution history persistence
 */
export async function initializeHistoryPersistence(vault: Vault): Promise<void> {
  executionHistory.setPersistence(
    createVaultSaver(vault, HISTORY_PATH),
    createVaultLoader(vault, HISTORY_PATH)
  );

  await executionHistory.loadFromStorage();
  globalLogger.debug("History persistence initialized");
}

/**
 * Initialize conversation persistence
 */
export async function initializeConversationPersistence(
  vault: Vault,
  conversationManager: ConversationManager
): Promise<void> {
  conversationManager.setPersistence(
    createVaultSaver(vault, CONVERSATIONS_PATH),
    createVaultLoader(vault, CONVERSATIONS_PATH)
  );

  await conversationManager.loadFromStorage();
  globalLogger.debug("Conversation persistence initialized");
}

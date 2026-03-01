/**
 * Persistence - Data persistence helpers for vault storage
 * Handles saving/loading JSON data to the plugin's data folder
 */

import { TFile, Vault } from "obsidian";
import { executionHistory } from "./history";
import { globalLogger } from "../utils/logger";

const PLUGIN_FOLDER_NAME = "plugins/paper-agents";
const HISTORY_FILE = "history.json";

function getPluginDataFolder(vault: Vault): string {
  return `${vault.configDir}/${PLUGIN_FOLDER_NAME}`;
}

/**
 * Creates a save function for a given path in the vault
 */
function createVaultSaver(vault: Vault, path: string, folderPath: string): (data: string) => Promise<void> {
  return async (data: string) => {
    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath).catch(() => {});
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
  const folder = getPluginDataFolder(vault);
  const historyPath = `${folder}/${HISTORY_FILE}`;
  executionHistory.setPersistence(
    createVaultSaver(vault, historyPath, folder),
    createVaultLoader(vault, historyPath)
  );

  await executionHistory.loadFromStorage();
  globalLogger.debug("History persistence initialized");
}

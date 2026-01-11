/**
 * Tool Loader - Lädt Custom-Tools aus Vault
 * Sucht nach .md-Dateien mit `tool: true` im Frontmatter
 * Konvertiert diese zu Agent-Objekten
 */

import { App, TFile, TAbstractFile, Vault } from "obsidian";
import { Agent, LoadToolsResult, ToolFile } from "../types";
import YAMLParser from "./yaml-parser";
import ParameterValidator from "./validator";

export class CustomToolLoader {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Sucht alle Tool-Dateien im angegebenen Pfad
   * Durchsucht rekursiv alle .md-Dateien
   */
  async discoverTools(basePath: string): Promise<ToolFile[]> {
    const toolFiles: ToolFile[] = [];

    try {
      const root = this.app.vault.getRoot();
      const folder = this.app.vault.getAbstractFileByPath(basePath);

      if (!folder || !("children" in folder)) {
        console.warn(`Tool folder not found: ${basePath}`);
        return [];
      }

      // Rekursive Suche
      this.collectMarkdownFiles(folder, toolFiles);
    } catch (error) {
      console.error(`Error discovering tools in ${basePath}:`, error);
    }

    return toolFiles;
  }

  /**
   * Rekursiv durchsuche Ordner nach .md-Dateien
   */
  private collectMarkdownFiles(folder: any, results: ToolFile[]): void {
    if (!folder.children) {
      return;
    }

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        results.push({
          path: child.path,
          name: child.name,
          content: "", // Wird später geladen
        });
      } else if ("children" in child) {
        this.collectMarkdownFiles(child, results);
      }
    }
  }

  /**
   * Lädt und parst eine einzelne Tool-Datei
   */
  async parseToolFile(file: TFile): Promise<Agent | null> {
    try {
      const content = await this.app.vault.read(file);

      // Prüfe, ob Datei `tool: true` hat
      if (!content.includes("tool: true")) {
        return null;
      }

      // Parse YAML + Code-Blöcke
      const parsed = YAMLParser.parseToolFile(content);

      // Validiere erforderliche Felder
      if (!parsed.frontmatter.id || !parsed.frontmatter.name) {
        console.warn(`Tool file missing id/name: ${file.path}`);
        return null;
      }

      // Konvertiere zu Agent
      const agent = YAMLParser.toAgent(parsed);

      // Validiere Parameter
      const validation = ParameterValidator.validateParameters(agent.parameters, {});
      if (!validation.valid) {
        console.warn(`Invalid parameters in ${file.path}:`, validation.errors);
        // Fahre trotzdem fort, aber log Fehler
      }

      return agent;
    } catch (error) {
      console.error(`Error parsing tool file ${file.path}:`, error);
      return null;
    }
  }

  /**
   * Lädt alle Custom-Tools aus basePath
   */
  async loadCustomTools(basePath: string = "paper-agents-tools"): Promise<LoadToolsResult> {
    const result: LoadToolsResult = {
      successful: [],
      failed: [],
    };

    try {
      // Suche Tool-Dateien
      const toolFiles = await this.discoverTools(basePath);

      if (toolFiles.length === 0) {
        console.log(`No tool files found in ${basePath}`);
        return result;
      }

      // Parse jede Datei
      for (const toolFile of toolFiles) {
        const tFile = this.app.vault.getAbstractFileByPath(toolFile.path);

        if (!(tFile instanceof TFile)) {
          result.failed.push({
            file: toolFile.path,
            error: "File not found or invalid",
          });
          continue;
        }

        try {
          const agent = await this.parseToolFile(tFile);

          if (agent) {
            result.successful.push(agent);
          } else {
            // Stille ignorieren (kein `tool: true`)
          }
        } catch (error) {
          result.failed.push({
            file: toolFile.path,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      console.log(
        `Loaded ${result.successful.length} tools, ${result.failed.length} failed`
      );
    } catch (error) {
      console.error("Error loading custom tools:", error);
    }

    return result;
  }

  /**
   * Überwacht Änderungen an Tool-Dateien
   * (Wird später für Hot-Reload verwendet)
   */
  onToolFileChanged(callback: (toolId: string, action: "create" | "update" | "delete") => void): void {
    // Registriere Vault-Events
    this.app.vault.on("create", (file) => {
      if (this.isToolFile(file)) {
        callback((file as TFile).basename, "create");
      }
    });

    this.app.vault.on("modify", (file) => {
      if (this.isToolFile(file)) {
        callback((file as TFile).basename, "update");
      }
    });

    this.app.vault.on("delete", (file) => {
      if (this.isToolFile(file)) {
        callback((file as TFile).basename, "delete");
      }
    });
  }

  /**
   * Prüft, ob eine Datei eine Tool-Datei ist
   */
  private isToolFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) {
      return false;
    }
    return file.extension === "md" && file.path.includes("paper-agents-tools");
  }
}

export default CustomToolLoader;

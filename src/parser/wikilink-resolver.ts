/**
 * WikilinkResolver – Löst Obsidian-Wikilinks ([[Dateiname]]) in Markdown-Texten auf.
 *
 * Unterstützte Formate:
 *   [[Dateiname]]          – einfache Referenz
 *   [[Dateiname|Alias]]    – mit Alias (Alias wird ignoriert)
 *   [[Dateiname#Abschnitt]] – Abschnittsreferenz (Abschnitt wird ignoriert)
 *   [[Pfad/zur/Datei]]     – Pfad-Referenz
 *
 * Nur .md-Dateien werden eingebettet. Nicht gefundene Links bleiben unverändert.
 * Zyklen werden durch eine "visited"-Menge verhindert.
 */

import { App, TFile } from "obsidian";

export interface WikilinkResolverOptions {
  /** Maximale Rekursionstiefe für verschachtelte Wikilinks. Standard: 3 */
  maxDepth?: number;
  /** Eingebetteten Inhalt mit Kommentar-Markierungen umhüllen. Standard: true */
  wrapContent?: boolean;
}

/** Regex, die alle [[...]] Wikilinks im Text findet. */
const WIKILINK_REGEX = /\[\[([^\]\[]{1,1000})\]\]/g;

const DEFAULT_MAX_DEPTH = 3;

export class WikilinkResolver {
  private readonly app: App;
  private readonly maxDepth: number;
  private readonly wrapContent: boolean;

  constructor(app: App, options: WikilinkResolverOptions = {}) {
    this.app = app;
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.wrapContent = options.wrapContent ?? true;
  }

  /**
   * Löst alle Wikilinks im gegebenen `content` auf und ersetzt sie durch den
   * Inhalt der referenzierten Dateien.
   *
   * @param content   Der zu verarbeitende Markdown-Text.
   * @param sourcePath Pfad der Quelldatei (für relative Pfadauflösung).
   * @param visited   Menge bereits besuchter Dateipfade (Zyklenschutz).
   * @param depth     Aktuelle Rekursionstiefe.
   */
  async resolve(
    content: string,
    sourcePath = "",
    visited: Set<string> = new Set(),
    depth = 0
  ): Promise<string> {
    if (depth >= this.maxDepth) {
      return content;
    }

    // Sammle alle einzigartigen Wikilinks im Text
    const matches = this.findWikilinks(content);
    if (matches.length === 0) {
      return content;
    }

    let result = content;

    for (const { fullMatch, linkPath } of matches) {
      const file = this.resolveFile(linkPath, sourcePath);

      // Datei nicht gefunden oder nicht Markdown → Wikilink unverändert lassen
      if (file?.extension !== "md") {
        continue;
      }

      // Zyklenerkennung: bereits besuchte Dateien überspringen
      if (visited.has(file.path)) {
        continue;
      }

      const newVisited = new Set(visited);
      newVisited.add(file.path);

      const fileContent = await this.app.vault.read(file);

      // Rekursiv Wikilinks im eingebetteten Inhalt auflösen
      const resolvedFileContent = await this.resolve(
        fileContent,
        file.path,
        newVisited,
        depth + 1
      );

      const embedded = this.wrapContent
        ? `\n\n<!-- wikilink:${file.path} -->\n${resolvedFileContent}\n<!-- /wikilink:${file.path} -->\n\n`
        : resolvedFileContent;

      // Alle Vorkommen dieses Wikilinks ersetzen
      result = result.split(fullMatch).join(embedded);
    }

    return result;
  }

  /**
   * Findet alle eindeutigen Wikilinks im Text und gibt ihre Rohform sowie
   * den aufgelösten Linkpfad zurück.
   */
  private findWikilinks(content: string): Array<{ fullMatch: string; linkPath: string }> {
    const seenMatches = new Set<string>();
    const results: Array<{ fullMatch: string; linkPath: string }> = [];

    const regex = new RegExp(WIKILINK_REGEX.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0] ?? "";
      if (!fullMatch || seenMatches.has(fullMatch)) continue;
      seenMatches.add(fullMatch);

      const inner = (match[1] ?? "").trim();

      // Alias entfernen: [[Name|Alias]] → "Name"
      const withoutAlias = inner.split("|")[0] ?? inner;

      // Abschnittsreferenz entfernen: [[Name#Abschnitt]] → "Name"
      const linkPath = (withoutAlias.split("#")[0] ?? withoutAlias).trim();

      if (linkPath) {
        results.push({ fullMatch, linkPath });
      }
    }

    return results;
  }

  /**
   * Löst einen Linkpfad zu einer TFile auf.
   * Verwendet Obsidians MetadataCache als primäre Methode, mit Fallbacks.
   */
  private resolveFile(linkPath: string, sourcePath: string): TFile | null {
    // Primär: Obsidians eigener Resolver (unterstützt Fuzzy-Matching und Kurzpfade)
    const metaCache = (this.app as App & { metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => TFile | null } }).metadataCache;
    if (metaCache?.getFirstLinkpathDest) {
      const file = metaCache.getFirstLinkpathDest(linkPath, sourcePath);
      if (file instanceof TFile) return file;
    }

    // Fallback 1: exakter Pfad mit .md-Extension
    const pathWithMd = linkPath.endsWith(".md") ? linkPath : `${linkPath}.md`;
    const fileWithMd = this.app.vault.getAbstractFileByPath(pathWithMd);
    if (fileWithMd instanceof TFile) return fileWithMd;

    // Fallback 2: exakter Pfad ohne Extension-Änderung
    const plainFile = this.app.vault.getAbstractFileByPath(linkPath);
    if (plainFile instanceof TFile) return plainFile;

    return null;
  }
}

export default WikilinkResolver;

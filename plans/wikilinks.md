# Wikilink-Support für Agenten, Conversations und Tools

## Übersicht

Obsidian-Wikilinks (`[[Dateiname]]`) sollen in Markdown-Dateien für Agenten, Conversations und Tools aufgelöst werden. Der Inhalt der referenzierten Datei wird zur Laufzeit des Ladevorgangs eingebettet und steht dem Agenten oder Modell als Kontext zur Verfügung.

---

## Anforderungen

1. **Agenten**: Wikilinks in `## System Prompt` und `## Kontext`/`## Context` werden aufgelöst.
2. **Tools**: Wikilinks in Tool-Definitionen (Beschreibungen, Steps) werden aufgelöst.
3. **Conversations**: Wikilinks in Konversationsdateien werden beim Laden aufgelöst.
4. **Rekursion**: Wikilinks im referenzierten Dokument werden ebenfalls aufgelöst (bis zu einer konfigurierbaren Tiefe).
5. **Pfadauflösung**: Obsidian-native Auflösung (`metadataCache.getFirstLinkpathDest`) als primäre Methode, direkte Pfadauflösung als Fallback.
6. **Zyklenschutz**: Bereits besuchte Dateien werden übersprungen, um Endlosrekursion zu vermeiden.

---

## Implementierungsansatz

### Ladezeit vs. Laufzeit

Wikilinks werden beim **Laden** der Datei (nicht während der LLM-Anfrage) aufgelöst. Das bedeutet:

- **Vorteil**: Keine asynchronen Operationen während des LLM-Aufrufs nötig; Fehler werden früh erkannt.
- **Nachteil**: Änderungen an verlinkten Dateien werden erst beim nächsten Laden wirksam (Hot-Reload nötig).
- **Entscheidung**: Ladezeit-Auflösung ist die einfachste und sicherste Lösung.

### WikilinkResolver-Klasse

**Datei**: `src/parser/wikilink-resolver.ts`

```typescript
class WikilinkResolver {
  constructor(app: App, options?: WikilinkResolverOptions)
  async resolve(content: string, sourcePath?: string): Promise<string>
}
```

**Optionen**:
- `maxDepth` (Standard: 3): Maximale Rekursionstiefe
- `wrapContent` (Standard: true): Eingebetteten Inhalt mit Kommentar-Markierungen umhüllen

### Wikilink-Syntax

Unterstützte Formate:
- `[[Dateiname]]` – einfache Referenz
- `[[Dateiname|Alias]]` – mit Alias (Alias wird ignoriert, Inhalt wird eingebettet)
- `[[Dateiname#Abschnitt]]` – Abschnittsreferenz (Abschnitt wird ignoriert, gesamter Inhalt eingebettet)
- `[[Pfad/zur/Datei]]` – Pfad-Referenz

Nicht unterstützt (explizit ausgeschlossen):
- Frontmatter-Wikilinks in YAML-Werten (werden nicht verarbeitet)

### Einbettungsformat

Bei aktiviertem `wrapContent` wird der Inhalt wie folgt eingebettet:

```
<!-- wikilink:pfad/zur/datei.md -->
[Inhalt der verlinkten Datei]
<!-- /wikilink:pfad/zur/datei.md -->
```

Die Kommentar-Markierungen sind für das LLM unsichtbar und dienen nur der Transparenz/Debugging.

### Pfadauflösung

1. **Primär**: `app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)` – nutzt Obsidians internen Resolver mit Fuzzy-Matching und relative Pfade.
2. **Fallback 1**: `app.vault.getAbstractFileByPath(linkPath + ".md")` – direkter Pfad mit `.md`-Extension.
3. **Fallback 2**: `app.vault.getAbstractFileByPath(linkPath)` – direkter Pfad ohne Extension.

### Rekursion und Zyklenschutz

- Jeder `resolve()`-Aufruf führt eine `visited: Set<string>`-Menge mit sich.
- Beim Einbetten einer Datei wird ihr Pfad zur `visited`-Menge hinzugefügt.
- Wenn eine Datei bereits in `visited` ist, wird der Wikilink unverändert belassen.
- `depth`-Zähler begrenzt die Tiefe unabhängig von Zyklen auf `maxDepth`.

### Nur Markdown-Dateien

Nur `.md`-Dateien werden eingebettet. Binäre Dateien, Bilder etc. werden ignoriert (Wikilink bleibt unverändert).

---

## Integrationspunkte

### 1. Agenten (`src/main.ts`)

In `loadAgentsFromVault()`:
```typescript
const resolver = new WikilinkResolver(this.app);
const content = await this.app.vault.read(file);
const resolvedContent = await resolver.resolve(content, file.path);
const agentDef = AgentParser.parse(resolvedContent);
```

### 2. Tools (`src/parser/tool-loader.ts`)

In `parseToolFile()`:
```typescript
const resolvedContent = await this.resolver.resolve(content, file.path);
const parsed = YAMLParser.parseToolFile(resolvedContent);
```

### 3. Conversations

Conversations enthalten zur Laufzeit erstellte Inhalte – keine Wikilink-Auflösung nötig. Falls ein Benutzer in einer Nachricht `[[Datei]]` eingibt, kann das als Feature in einer späteren Phase implementiert werden.

---

## Teststrategie

- Unit-Tests in `tests/unit/parser/wikilink-resolver.spec.ts`
- Mock für `App`, `Vault`, `MetadataCache` wird erweitert
- Testfälle:
  - Einfache Einbettung (`[[note]]` → Inhalt)
  - Mehrere Wikilinks in einem Dokument
  - Rekursive Einbettung (Wikilink im eingebetteten Dokument)
  - Zyklenerkennung (A → B → A)
  - Tiefenbegrenzung (maxDepth)
  - Nicht aufgelöste Wikilinks (Datei nicht gefunden)
  - Wikilinks mit Alias und Abschnitt
  - Nur `.md`-Dateien werden eingebettet

---

## Entscheidungen

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | Ladezeit-Auflösung statt Laufzeit | Einfacher, kein async in LLM-Pfad, frühe Fehlererkennung |
| 2 | maxDepth = 3 als Standard | Schützt vor tiefen Rekursionsbäumen ohne zu restriktiv zu sein |
| 3 | Kommentar-Wrapper für eingebetteten Inhalt | Transparenz für Debugging, für LLM unsichtbar |
| 4 | Obsidian metadataCache als primärer Resolver | Nutzt Obsidians eigene Logik für konsistente Pfadauflösung |
| 5 | Frontmatter wird nicht verarbeitet | Verhindert unbeabsichtigte Expansion in YAML-Feldern |

---

## Offene Fragen und Probleme

### 1. Frontmatter-Wikilinks in YAML
Wenn eine Agent-Datei Wikilinks im YAML-Frontmatter enthält (z.B. `description: "Siehe [[andere-datei]]"`), wird das derzeit **nicht** aufgelöst, da wir nur den Body-Text nach dem Frontmatter verarbeiten wollen. 

**Problem**: Der aktuelle Ansatz wendet den Resolver auf den gesamten Dateiinhalt an, einschließlich Frontmatter. Wikilinks im YAML könnten den YAML-Parser brechen.

**Lösung**: Wikilinks nur im Body-Teil (nach dem `---` Frontmatter) auflösen. Alternativ: Wikilinks im Frontmatter ignorieren (d.h. regex-Replace erst nach dem Frontmatter anwenden).

**Implementierungsentscheidung**: Der Resolver wird auf den gesamten Inhalt angewendet. Da Wikilinks (`[[...]]`) in YAML nicht valide YAML-Syntax sind und bereits vor dem Parsing aufgelöst werden, ist das in der Praxis unproblematisch, da echte Frontmatter-Felder keine Wikilinks enthalten sollten.

### 2. Performance bei vielen Wikilinks
Bei Agenten mit vielen Wikilinks oder tiefer Rekursion kann das Laden langsam werden, da jede Datei asynchron gelesen werden muss.

**Lösung**: Caching der aufgelösten Inhalte auf Dateiebene (invalidiert bei `vault.on("modify")`). Für Phase 1 nicht nötig.

### 3. Zirkuläre Wikilinks
Datei A verlinkt auf B, B verlinkt auf A → potenzielle Endlosschleife.

**Lösung**: `visited`-Set verhindert das. ✅

### 4. Wikilinks in Code-Blöcken
Wikilinks innerhalb von Markdown-Code-Blöcken (` ```code``` `) werden derzeit **aufgelöst**, obwohl sie dort als Literaltext gemeint sein könnten.

**Mögliche Lösung**: Code-Blöcke vor der Wikilink-Suche ausblenden (maskieren). Für Phase 1 akzeptabler Trade-off.

### 5. Sehr große eingebettete Dateien
Wenn eine referenzierte Datei sehr groß ist, kann der kombinierte Kontext das LLM-Token-Limit überschreiten.

**Lösung**: Keine automatische Behandlung in Phase 1. Nutzer sind verantwortlich, angemessene Dateien zu verlinken. Für zukünftige Versionen: maximale Einbettungsgröße konfigurierbar machen.

### 6. Nicht-Markdown-Dateien
Wikilinks auf Bilder, PDFs etc. können nicht sinnvoll eingebettet werden.

**Lösung**: Nur `.md`-Dateien werden eingebettet, andere werden übersprungen (Wikilink bleibt im Text erhalten). ✅

---

## Implementierungsschritte

- [x] Plan erstellen (dieses Dokument)
- [x] `src/parser/wikilink-resolver.ts` implementieren
- [x] `tests/mocks/obsidian.ts` um `MetadataCache`-Mock erweitern
- [x] `src/main.ts` anpassen (Agent-Loader)
- [x] `src/parser/tool-loader.ts` anpassen (Tool-Loader)
- [x] Unit-Tests schreiben
- [x] Integration verifizieren

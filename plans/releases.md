# Plan: Cleanup Old Releases and Tags

## Ziel

Einen GitHub Actions Workflow implementieren, der alte Releases und Tags automatisch löscht, um das Repository übersichtlich zu halten.

## Regeln

- **Aktuelle Minor-Version** (höchste `MAJOR.MINOR`-Kombination): Die letzten **7** Releases dieser Serie werden behalten.
- **Ältere Minor-Versionen**: Es wird nur der **neueste** (höchste Patch-Stand) Release jeder älteren Minor-Serie behalten.
- Alle anderen Releases und ihre zugehörigen Tags werden gelöscht.

### Beispiel

> Aktuelle Release-Version: `0.2.123`

| Serie   | Behalten                                               | Gelöscht                                      |
|---------|--------------------------------------------------------|-----------------------------------------------|
| `0.2.x` | Die letzten 7: `0.2.123`, `0.2.122`, …, `0.2.117`    | Alle älteren `0.2.x`-Releases                 |
| `0.1.x` | Nur der letzte: z.B. `0.1.45`                         | Alle anderen `0.1.x`-Releases                 |

## Implementierungsplan

### Workflow-Trigger

- **Manuell** (`workflow_dispatch`) – für Ad-hoc-Ausführung
- **Zeitgesteuert** (`schedule`) – wöchentlich (Sonntag 02:00 UTC)
- **Nach jedem Release** (`release: [published]`) – automatische Bereinigung direkt nach einem neuen Release

### Ablauf des Workflows

1. Alle Releases per GitHub CLI abrufen (`gh release list --limit 500 --json tagName`)
2. Nur Releases mit semantischem Versionsmuster (`MAJOR.MINOR.PATCH`) berücksichtigen
3. Releases nach `MAJOR.MINOR` gruppieren
4. Höchste Minor-Version ermitteln (aktuelle Serie)
5. Für die aktuelle Minor-Serie: Releases absteigend nach Patch-Version sortieren, die ersten 7 behalten
6. Für alle älteren Minor-Serien: Jeweils nur das Release mit dem höchsten Patch-Stand behalten
7. Alle übrigen Releases löschen (`gh release delete --yes`) und die zugehörigen Tags entfernen (`git push --delete origin <tag>`)

### Berechtigungen

Der Workflow benötigt `contents: write` um Releases und Tags löschen zu können.

## Implementierungsstand

- [x] Plan dokumentiert (`plans/releases.md`)
- [x] Workflow erstellt (`.github/workflows/cleanup-releases.yml`)
  - [x] Trigger: `workflow_dispatch`, `schedule` (wöchentlich), `release: [published]`
  - [x] Releases werden per GitHub CLI abgerufen und nach SemVer gefiltert
  - [x] Gruppierung nach Major.Minor-Version
  - [x] Aktuelle Minor-Serie: 7 Releases behalten
  - [x] Ältere Minor-Serien: jeweils 1 Release behalten
  - [x] Release und zugehöriger Tag werden gelöscht

## Offene Punkte / Known Issues

- Der Workflow löscht nur Releases und Tags, die einem reinen `MAJOR.MINOR.PATCH`-Muster folgen. Tags mit Suffixen wie `-beta` oder `-rc` werden vom Cleanup **nicht** berücksichtigt – diese werden weiterhin durch den bestehenden Cleanup-Schritt in `release.yml` verwaltet.
- Bei einem sehr großen Anzahl von Releases (> 500) müsste das Limit in `gh release list --limit 500` erhöht oder eine Paginierung eingebaut werden.
- Die Löschreihenfolge entspricht der Sortierung per `sort -V` (Version Sort); bei gleichzeitig existierenden Pre-release-Tags könnte die Sortierung abweichen.

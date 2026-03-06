# Agentic Loop – Ausstehende Tasks

Die abgeschlossenen Implementierungsarbeiten sind in die arc42-Dokumentation überführt worden:
- [Bausteinsicht (05)](../arc42/chapters/05-bausteinsicht.md) – Orchestrator, Tools
- [Laufzeitsicht (06)](../arc42/chapters/06-laufzeitsicht.md) – Agentic Loop Ablauf
- [Querschnittliche Konzepte (08)](../arc42/chapters/08-querschnittliche-konzepte.md) – Konfiguration, HITL, transforms
- [Architekturentscheidungen (09)](../arc42/chapters/09-architekturentscheidungen.md) – ADR-7, ADR-8

## Phase 3 – Offene Tasks

- [ ] **Parallele Tool-Calls**: Mehrere Tool-Calls innerhalb einer Iteration parallel ausführen (z.B. mehrere `websearch`-Calls gleichzeitig für Deep Research)
- [ ] **Summary-Memory**: `memory.type: summary` für Agentic Loops – Zwischenzusammenfassungen erstellen statt vollständiger History für Token-Ersparnis bei sehr langen Loops
- [ ] **Kosten-Tracking**: Token-Kosten pro Loop-Iteration tracken und in der UI anzeigen

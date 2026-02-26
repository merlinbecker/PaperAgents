# 7. Verteilungssicht

## 7.1 Deployment-Architektur

```mermaid
C4Deployment
    title Paper Agents - Deployment
    
    Deployment_Node(desktop, "Obsidian Desktop", "Electron/Native") {
        Container(plugin, "main.js", "Plugin Bundle")
        Container(manifest, "manifest.json", "Metadata")
        Container(styles, "styles.css", "UI Styles")
    }
    
    Deployment_Node(mobile, "Obsidian Mobile", "iOS/Android") {
        Container(plugin_m, "main.js", "Plugin Bundle (WASM)")
        Container(manifest_m, "manifest.json", "Metadata")
    }
    
    Deployment_Node(vault, "Obsidian Vault", "Local Storage") {
        Deployment_Node(plugins, ".obsidian/plugins/paperAgents/") {
            Container(pa_main, "main.js", "Plugin-Code")
            Container(pa_manifest, "manifest.json", "Config")
        }
        Deployment_Node(tools, "paper-agents-tools/") {
            Container(custom_tools, "*.md", "Custom Tools")
        }
        Deployment_Node(agents, "examples/agents/") {
            Container(agent_examples, "*.md", "Agent Examples")
        }
    }
    
    System_Ext(rest, "External REST APIs")
    System_Ext(router, "OpenRouter API")
    
    Rel(plugin, vault, "Read/Write")
    Rel(plugin, rest, "HTTP Calls")
    Rel(plugin, router, "LLM Requests")
```

### Deployment-Artefakte

| Artefakt | Beschreibung | Generiert durch |
|----------|--------------|-----------------|
| `main.js` | Gebundelter Plugin-Code (~92 KB) | `npm run build` (esbuild) |
| `manifest.json` | Plugin-ID, Version, minAppVersion | Manuell gepflegt |
| `styles.css` | UI-Styles | Manuell gepflegt |

### Installationswege

| Methode | Beschreibung |
|---------|--------------|
| **BRAT** | Beta-Tester fügen `merlinbecker/PaperAgents` in BRAT hinzu |
| **Manuell** | `main.js`, `manifest.json`, `styles.css` nach `<Vault>/.obsidian/plugins/paperAgents/` kopieren |
| **Community Plugins** | Noch nicht verfügbar (geplant nach v1.0) |

### Release-Prozess

1. Version in `manifest.json` aktualisieren
2. `npm run build` → `main.js` generieren
3. `npm run release` → Git-Tag erstellen + pushen
4. GitHub Actions erstellt automatisch Release mit Artefakten
5. BRAT-Nutzer erhalten automatisch Updates
6. Beta-Releases via `npm run release:beta` (alte Betas werden automatisch aufgeräumt, letzte 10 behalten)

---

**Zurück:** [Laufzeitsicht ←](06-laufzeitsicht.md) | **Weiter:** [Querschnittliche Konzepte →](08-querschnittliche-konzepte.md)

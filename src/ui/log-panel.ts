/**
 * LogPanel - Echtzeit-Log-Ansicht für die Paper Agents Sidebar.
 * Abonniert den globalLogger via Event-Bus und zeigt neue Einträge sofort an.
 * Verwendet den Ring-Buffer des Loggers für die initiale Anzeige.
 */

import { Logger, LogEntry, LogLevel } from "../utils/logger";

/** Maximale Anzahl von Einträgen im DOM (verhindert DOM-Überlastung) */
const MAX_DOM_ENTRIES = 200;

/** Menschenlesbare Label und CSS-Klassen pro Level */
const LEVEL_META: Record<
  LogLevel,
  { label: string; cls: string; icon: string }
> = {
  [LogLevel.DEBUG]: { label: "DEBUG", cls: "pa-log-level-debug", icon: "🔍" },
  [LogLevel.INFO]:  { label: "INFO",  cls: "pa-log-level-info",  icon: "ℹ️" },
  [LogLevel.WARN]:  { label: "WARN",  cls: "pa-log-level-warn",  icon: "⚠️" },
  [LogLevel.ERROR]: { label: "ERROR", cls: "pa-log-level-error", icon: "❌" },
};

export class LogPanel {
  private readonly container: HTMLElement;
  private readonly logger: Logger;
  private unsubscribe: (() => void) | null = null;

  /** Aktuell ausgewählter Mindest-Level-Filter */
  private filterLevel: LogLevel = LogLevel.DEBUG;

  private listEl: HTMLElement | null = null;
  private autoScroll = true;

  constructor(container: HTMLElement, logger: Logger) {
    this.container = container;
    this.logger = logger;
  }

  /** Baut die Ansicht auf und abonniert den Logger */
  mount(): void {
    this.container.empty();
    this.container.addClass("pa-log-panel");

    this.renderToolbar();
    this.listEl = this.container.createDiv({ cls: "pa-log-list" });

    // Bestehende Einträge anzeigen
    this.renderAll();

    // Event-Bus abonnieren
    this.unsubscribe = this.logger.subscribe((entry) => {
      this.appendEntry(entry);
    });
  }

  /** Abonnement beenden und DOM freigeben */
  unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.container.empty();
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  private renderToolbar(): void {
    const toolbar = this.container.createDiv({ cls: "pa-log-toolbar" });

    // Level-Filter
    const filterGroup = toolbar.createDiv({ cls: "pa-log-filter-group" });
    filterGroup.createSpan({ cls: "pa-log-filter-label", text: "Level:" });

    const select = filterGroup.createEl("select", { cls: "pa-log-level-select" });
    const levels: Array<{ value: LogLevel; label: string }> = [
      { value: LogLevel.DEBUG, label: "Debug +" },
      { value: LogLevel.INFO,  label: "Info +"  },
      { value: LogLevel.WARN,  label: "Warn +"  },
      { value: LogLevel.ERROR, label: "Error"   },
    ];
    for (const { value, label } of levels) {
      const opt = select.createEl("option", { text: label });
      opt.value = String(value);
      if (value === this.filterLevel) opt.selected = true;
    }
    select.addEventListener("change", () => {
      this.filterLevel = Number(select.value) as LogLevel;
      this.renderAll();
    });

    // Auto-Scroll Toggle
    const scrollBtn = toolbar.createEl("button", {
      cls: "pa-log-scroll-btn",
      text: "⬇ auto-scroll",
      attr: { title: "Toggle auto-scroll to latest entry" },
    });
    scrollBtn.toggleClass("pa-log-scroll-active", this.autoScroll);
    scrollBtn.addEventListener("click", () => {
      this.autoScroll = !this.autoScroll;
      scrollBtn.toggleClass("pa-log-scroll-active", this.autoScroll);
      if (this.autoScroll) this.scrollToBottom();
    });

    // Clear-Button
    const clearBtn = toolbar.createEl("button", {
      cls: "pa-log-clear-btn",
      text: "🗑 clear logs",
      attr: { title: "Clear all log entries" },
    });
    clearBtn.addEventListener("click", () => {
      this.logger.clear();
      this.listEl?.empty();
    });
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  /** Rendert alle gespeicherten Einträge (nach Filter) */
  private renderAll(): void {
    if (!this.listEl) return;
    this.listEl.empty();

    const entries = this.logger.getLogs().filter(
      (e) => e.level >= this.filterLevel,
    );

    // Nur die letzten MAX_DOM_ENTRIES anzeigen
    const visible = entries.slice(-MAX_DOM_ENTRIES);
    for (const entry of visible) {
      this.appendEntryToList(entry);
    }

    this.scrollToBottom();
  }

  /** Hängt einen neuen Eintrag ans Ende der Liste */
  private appendEntry(entry: LogEntry): void {
    if (entry.level < this.filterLevel) return;
    if (!this.listEl) return;

    // DOM-Limit einhalten: ältesten Eintrag entfernen
    while (this.listEl.children.length >= MAX_DOM_ENTRIES) {
      this.listEl.firstChild?.remove();
    }

    this.appendEntryToList(entry);

    if (this.autoScroll) this.scrollToBottom();
  }

  private appendEntryToList(entry: LogEntry): void {
    if (!this.listEl) return;
    const meta = LEVEL_META[entry.level];

    const row = this.listEl.createDiv({ cls: `pa-log-entry ${meta.cls}` });

    // Timestamp
    const ts = new Date(entry.timestamp);
    const timeStr = ts.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    row.createSpan({ cls: "pa-log-ts", text: timeStr });

    // Level badge
    row.createSpan({
      cls: `pa-log-badge ${meta.cls}-badge`,
      text: `${meta.icon} ${meta.label}`,
    });

    // Emitter badge
    row.createSpan({ cls: "pa-log-emitter", text: entry.emitter });

    // Message
    row.createSpan({ cls: "pa-log-msg", text: entry.message });

    // Context (expandierbar)
    if (entry.context && Object.keys(entry.context).length > 0) {
      const toggle = row.createSpan({
        cls: "pa-log-ctx-toggle",
        text: "{ … }",
        attr: { title: "Toggle context details" },
      });
      const ctxEl = row.createDiv({
        cls: "pa-log-ctx pa-hidden",
        text: JSON.stringify(entry.context, null, 2),
      });
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        ctxEl.toggleClass("pa-hidden", !ctxEl.hasClass("pa-hidden"));
      });
    }
  }

  private scrollToBottom(): void {
    if (!this.listEl) return;
    this.listEl.scrollTop = this.listEl.scrollHeight;
  }
}

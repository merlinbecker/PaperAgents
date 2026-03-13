/**
 * LogPanel - Echtzeit-Log-Ansicht für die Paper Agents Sidebar.
 * Abonniert den globalLogger via Event-Bus und zeigt neue Einträge sofort an.
 * Verwendet den Ring-Buffer des Loggers für die initiale Anzeige.
 */

import { Logger, LogEntry, LogLevel } from "../utils/logger";

/** Maximale Anzahl von Einträgen im DOM (verhindert DOM-Überlastung) */
const MAX_DOM_ENTRIES = 200;

/** Sentinel "all emitters" value */
const EMITTER_ALL = "__all__";

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

export interface LogPanelOptions {
  /** Initial log level filter (default: DEBUG) */
  initialFilterLevel?: LogLevel;
  /** Called when the user changes the level filter, so the caller can persist the choice */
  onFilterLevelChange?: (level: LogLevel) => Promise<void> | void;
}

export class LogPanel {
  private readonly container: HTMLElement;
  private readonly logger: Logger;
  private readonly options: LogPanelOptions;
  private unsubscribe: (() => void) | null = null;

  /** Aktuell ausgewählter Mindest-Level-Filter */
  private filterLevel: LogLevel;

  /** Aktuell ausgewählter Emitter-Filter */
  private filterEmitter: string = EMITTER_ALL;

  private listEl: HTMLElement | null = null;
  private emitterSelect: HTMLSelectElement | null = null;
  private autoScroll = true;

  constructor(container: HTMLElement, logger: Logger, options: LogPanelOptions = {}) {
    this.container = container;
    this.logger = logger;
    this.options = options;
    this.filterLevel = options.initialFilterLevel ?? LogLevel.DEBUG;
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
      // Emitter-Dropdown nach neuen Emittern aktualisieren
      this.refreshEmitterOptions();
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

    const levelSelect = filterGroup.createEl("select", { cls: "pa-log-level-select" });
    const levels: Array<{ value: LogLevel; label: string }> = [
      { value: LogLevel.DEBUG, label: "Debug +" },
      { value: LogLevel.INFO,  label: "Info +"  },
      { value: LogLevel.WARN,  label: "Warn +"  },
      { value: LogLevel.ERROR, label: "Error"   },
    ];
    for (const { value, label } of levels) {
      const opt = levelSelect.createEl("option", { text: label });
      opt.value = String(value);
      if (value === this.filterLevel) opt.selected = true;
    }
    levelSelect.addEventListener("change", () => {
      this.filterLevel = Number(levelSelect.value) as LogLevel;
      void this.options.onFilterLevelChange?.(this.filterLevel);
      this.renderAll();
    });

    // Emitter-Filter
    const emitterGroup = toolbar.createDiv({ cls: "pa-log-filter-group" });
    emitterGroup.createSpan({ cls: "pa-log-filter-label", text: "Emitter:" });

    this.emitterSelect = emitterGroup.createEl("select", { cls: "pa-log-level-select" });
    const allOpt = this.emitterSelect.createEl("option", { text: "All" });
    allOpt.value = EMITTER_ALL;
    this.refreshEmitterOptions();
    this.emitterSelect.addEventListener("change", () => {
      this.filterEmitter = this.emitterSelect?.value ?? EMITTER_ALL;
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

    // Export/Copy-Button
    const copyBtn = toolbar.createEl("button", {
      cls: "pa-log-copy-btn",
      text: "📋 copy logs",
      attr: { title: "Copy visible log entries to clipboard" },
    });
    copyBtn.addEventListener("click", () => {
      void this.copyLogsToClipboard(copyBtn);
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
      this.refreshEmitterOptions();
    });
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  private async copyLogsToClipboard(btn: HTMLButtonElement): Promise<void> {
    const entries = this.getFilteredEntries();
    const text = entries
      .map((e) => this.logger.formatEntry(e))
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent ?? "";
      btn.textContent = "✅ copied!";
      setTimeout(() => { btn.textContent = original; }, 2000);
    } catch {
      btn.textContent = "❌ failed";
      setTimeout(() => { btn.textContent = "📋 copy logs"; }, 2000);
    }
  }

  // ── Emitter-Dropdown ─────────────────────────────────────────────────────

  /** Aktualisiert die Emitter-Optionen basierend auf dem aktuellen Ring-Buffer-Inhalt */
  private refreshEmitterOptions(): void {
    const select = this.emitterSelect;
    if (!select) return;

    const currentValue = select.value;
    const emitters = [...new Set(this.logger.getLogs().map((e) => e.emitter))].sort();

    // Vorhandene Optionen außer "All" entfernen
    while (select.options.length > 1) {
      select.remove(1);
    }

    for (const emitter of emitters) {
      const opt = select.createEl("option", { text: emitter });
      opt.value = emitter;
      if (emitter === currentValue) opt.selected = true;
    }

    // Aktuellen Wert beibehalten
    if (currentValue && currentValue !== EMITTER_ALL && emitters.includes(currentValue)) {
      select.value = currentValue;
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  /** Gibt die gefilterten Einträge zurück */
  private getFilteredEntries(): LogEntry[] {
    return this.logger.getLogs().filter(
      (e) =>
        e.level >= this.filterLevel &&
        (this.filterEmitter === EMITTER_ALL || e.emitter === this.filterEmitter),
    );
  }

  /** Rendert alle gespeicherten Einträge (nach Filter) */
  private renderAll(): void {
    if (!this.listEl) return;
    this.listEl.empty();

    const entries = this.getFilteredEntries();

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
    if (this.filterEmitter !== EMITTER_ALL && entry.emitter !== this.filterEmitter) return;
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

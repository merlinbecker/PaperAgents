import { Modal, App } from "obsidian";
import { ExecutionHistory, HistoryEntry, HistoryFilter } from "../core/history";

export class HistoryPanelModal extends Modal {
  private readonly history: ExecutionHistory;
  private entriesContainer: HTMLElement | null = null;
  private readonly currentFilter: HistoryFilter = {};

  constructor(app: App, history: ExecutionHistory) {
    super(app);
    this.history = history;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("paper-agents-history");

    this.renderHeader(contentEl);
    this.renderFilters(contentEl);
    this.renderStats(contentEl);
    this.entriesContainer = contentEl.createDiv({ cls: "pa-history-entries" });
    this.renderEntries();
    this.renderFooter(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-history-header" });
    header.createEl("h2", { text: "Execution history" });
  }

  private renderFilters(container: HTMLElement): void {
    const filters = container.createDiv({ cls: "pa-history-filters" });

    const searchInput = filters.createEl("input", {
      cls: "pa-history-search",
      attr: { type: "text", placeholder: "Search..." },
    });
    searchInput.addEventListener("input", () => {
      this.currentFilter.search = searchInput.value || undefined;
      this.renderEntries();
    });

    const statusSelect = filters.createEl("select", { cls: "pa-history-filter-select" });
    statusSelect.createEl("option", { text: "All", attr: { value: "" } });
    statusSelect.createEl("option", { text: "Success", attr: { value: "true" } });
    statusSelect.createEl("option", { text: "Failed", attr: { value: "false" } });
    statusSelect.addEventListener("change", () => {
      if (statusSelect.value === "") {
        this.currentFilter.success = undefined;
      } else {
        this.currentFilter.success = statusSelect.value === "true";
      }
      this.renderEntries();
    });
  }

  private renderStats(container: HTMLElement): void {
    const stats = this.history.getStats();
    const statsEl = container.createDiv({ cls: "pa-history-stats" });

    const items = [
      { label: "Total", value: String(stats.totalExecutions) },
      { label: "Success", value: String(stats.successCount) },
      { label: "Failed", value: String(stats.errorCount) },
      { label: "Rate", value: `${(stats.successRate * 100).toFixed(1)}%` },
    ];

    for (const item of items) {
      const stat = statsEl.createDiv({ cls: "pa-history-stat" });
      stat.createSpan({ cls: "pa-history-stat-value", text: item.value });
      stat.createSpan({ cls: "pa-history-stat-label", text: item.label });
    }
  }

  private renderEntries(): void {
    if (!this.entriesContainer) return;
    this.entriesContainer.empty();

    const entries = this.history.getEntries(this.currentFilter);

    if (entries.length === 0) {
      this.entriesContainer.createDiv({ cls: "pa-history-empty", text: "No entries found" });
      return;
    }

    for (const entry of entries) {
      this.renderEntry(this.entriesContainer, entry);
    }
  }

  private renderEntry(container: HTMLElement, entry: HistoryEntry): void {
    const details = container.createEl("details", { cls: "pa-history-entry" });
    const summary = details.createEl("summary", { cls: "pa-history-entry-summary" });

    const icon = entry.result.success ? "✅" : "❌";
    summary.createSpan({ text: `${icon} ${entry.toolName}` });
    summary.createSpan({
      cls: "pa-history-entry-time",
      text: new Date(entry.timestamp).toLocaleString(),
    });
    summary.createSpan({
      cls: "pa-history-entry-duration",
      text: `${entry.duration}ms`,
    });

    const content = details.createDiv({ cls: "pa-history-entry-content" });

    content.createEl("h4", { text: "Parameters" });
    const paramPre = content.createEl("pre", { cls: "pa-output-data" });
    paramPre.createEl("code", { text: JSON.stringify(entry.parameters, null, 2) });

    if (entry.result.data) {
      content.createEl("h4", { text: "Output" });
      const outPre = content.createEl("pre", { cls: "pa-output-data" });
      outPre.createEl("code", {
        text: typeof entry.result.data === "string"
          ? entry.result.data
          : JSON.stringify(entry.result.data, null, 2),
      });
    }

    if (entry.result.error) {
      content.createEl("h4", { text: "Error" });
      content.createDiv({ cls: "pa-output-error-box", text: entry.result.error });
    }
  }

  private renderFooter(container: HTMLElement): void {
    const footer = container.createDiv({ cls: "pa-history-footer" });

    const exportBtn = footer.createEl("button", {
      cls: "pa-btn-submit",
      text: "Export JSON",
    });
    exportBtn.addEventListener("click", () => {
      const data = this.history.exportToJSON();
      navigator.clipboard.writeText(data).then(() => {
        exportBtn.textContent = "Copied!";
        setTimeout(() => { exportBtn.textContent = "Export JSON"; }, 2000);
      }).catch(() => { /* ignore clipboard errors */ });
    });

    const clearBtn = footer.createEl("button", {
      cls: "pa-btn-cancel",
      text: "Clear history",
    });
    clearBtn.addEventListener("click", () => {
      this.history.clearHistory();
      this.renderEntries();
    });
  }
}

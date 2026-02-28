import { Modal, App, Notice } from "obsidian";
import { ExecutionResult, ToolExecution } from "../types";

export class OutputPanelModal extends Modal {
  private result: ExecutionResult;
  private toolName: string;
  private executionTime: number;

  constructor(app: App, toolName: string, result: ExecutionResult, executionTime: number) {
    super(app);
    this.toolName = toolName;
    this.result = result;
    this.executionTime = executionTime;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("paper-agents-output");

    this.renderHeader(contentEl);
    this.renderSummary(contentEl);

    if (this.result.success && this.result.data !== undefined) {
      this.renderOutput(contentEl);
    }

    if (!this.result.success && this.result.error) {
      this.renderError(contentEl);
    }

    if (this.result.log && this.result.log.length > 0) {
      this.renderExecutionLog(contentEl);
    }

    this.renderButtons(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-output-header" });
    const icon = this.result.success ? "✅" : "❌";
    header.createSpan({ cls: "pa-output-icon", text: icon });
    header.createEl("h2", {
      cls: "pa-output-title",
      text: `${this.toolName} — ${this.result.success ? "Success" : "Failed"}`,
    });
  }

  private renderSummary(container: HTMLElement): void {
    const summary = container.createDiv({ cls: "pa-output-summary" });
    const items = [
      { label: "Status", value: this.result.success ? "Completed" : "Failed" },
      { label: "Duration", value: `${this.executionTime}ms` },
      { label: "Steps", value: String(this.result.log?.length || 1) },
    ];

    for (const item of items) {
      const row = summary.createDiv({ cls: "pa-output-summary-row" });
      row.createSpan({ cls: "pa-output-label", text: item.label });
      row.createSpan({ cls: "pa-output-value", text: item.value });
    }
  }

  private renderOutput(container: HTMLElement): void {
    const section = container.createDiv({ cls: "pa-output-section" });
    section.createEl("h3", { text: "Output" });

    const outputData = typeof this.result.data === "string"
      ? this.result.data
      : JSON.stringify(this.result.data, null, 2);

    const pre = section.createEl("pre", { cls: "pa-output-data" });
    pre.createEl("code", { text: outputData });

    const copyBtn = section.createEl("button", {
      cls: "pa-btn-copy",
      text: "Copy to clipboard",
    });
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(outputData).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy to clipboard"; }, 2000);
      }).catch(() => {
        copyBtn.textContent = "Copy failed";
        setTimeout(() => { copyBtn.textContent = "Copy to clipboard"; }, 2000);
        new Notice("Failed to copy to clipboard");
      });
    });
  }

  private renderError(container: HTMLElement): void {
    const section = container.createDiv({ cls: "pa-output-error-section" });
    section.createEl("h3", { text: "Error details" });
    const errorBox = section.createDiv({ cls: "pa-output-error-box" });
    errorBox.createEl("p", { text: this.result.error || "Unknown error" });
  }

  private renderExecutionLog(container: HTMLElement): void {
    const section = container.createDiv({ cls: "pa-output-section" });
    section.createEl("h3", { text: "Execution log" });

    for (const entry of this.result.log) {
      this.renderLogEntry(section, entry);
    }
  }

  private renderLogEntry(container: HTMLElement, entry: ToolExecution): void {
    const details = container.createEl("details", { cls: "pa-output-log-entry" });
    const summary = details.createEl("summary");

    const icon = entry.error ? "❌" : "✅";
    summary.createSpan({ text: `${icon} ${entry.toolName}` });

    if (entry.timestamp) {
      summary.createSpan({
        cls: "pa-output-timestamp",
        text: new Date(entry.timestamp).toLocaleTimeString(),
      });
    }

    const content = details.createDiv({ cls: "pa-output-log-content" });

    if (Object.keys(entry.parameters).length > 0) {
      content.createEl("h4", { text: "Parameters" });
      const paramPre = content.createEl("pre", { cls: "pa-output-data" });
      paramPre.createEl("code", { text: JSON.stringify(entry.parameters, null, 2) });
    }

    if (entry.output !== undefined) {
      content.createEl("h4", { text: "Output" });
      const outputStr = typeof entry.output === "string"
        ? entry.output
        : JSON.stringify(entry.output, null, 2);
      const outPre = content.createEl("pre", { cls: "pa-output-data" });
      outPre.createEl("code", { text: outputStr });
    }

    if (entry.error) {
      content.createEl("h4", { text: "Error" });
      content.createDiv({ cls: "pa-output-error-box", text: entry.error });
    }
  }

  private renderButtons(container: HTMLElement): void {
    const buttons = container.createDiv({ cls: "pa-output-buttons" });

    const copyAllBtn = buttons.createEl("button", {
      cls: "pa-btn-submit",
      text: "Copy full result",
    });
    copyAllBtn.addEventListener("click", () => {
      const fullResult = JSON.stringify(this.result, null, 2);
      navigator.clipboard.writeText(fullResult).then(() => {
        copyAllBtn.textContent = "Copied!";
        setTimeout(() => { copyAllBtn.textContent = "Copy full result"; }, 2000);
      }).catch(() => {
        copyAllBtn.textContent = "Copy failed";
        setTimeout(() => { copyAllBtn.textContent = "Copy full result"; }, 2000);
        new Notice("Failed to copy to clipboard");
      });
    });

    const closeBtn = buttons.createEl("button", {
      cls: "pa-btn-cancel",
      text: "Close",
    });
    closeBtn.addEventListener("click", () => this.close());
  }
}

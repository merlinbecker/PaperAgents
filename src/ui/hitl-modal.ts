/**
 * HITL Modal - Human-In-The-Loop Bestätigungsdialog
 * Zeigt Tool-Execution Preview und ermöglicht Approve/Reject
 */

import { Modal, App } from "obsidian";
import { HITLDecision } from "../core/tool-executor";
import { globalLogger } from "../utils/logger";

/**
 * HITL Approval Modal
 */
export class HITLModal extends Modal {
  private decision: HITLDecision;
  private onDecision: (decision: HITLDecision) => void;
  private resolved = false;

  constructor(
    app: App,
    decision: HITLDecision,
    onDecision: (decision: HITLDecision) => void
  ) {
    super(app);
    this.decision = decision;
    this.onDecision = onDecision;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("paper-agents-hitl");

    // Header
    this.renderHeader(contentEl);

    // Tool Info
    this.renderToolInfo(contentEl);

    // Parameters Preview
    this.renderParametersPreview(contentEl);

    // Warning (if destructive)
    if (this.isDestructiveOperation()) {
      this.renderWarning(contentEl);
    }

    // Buttons
    this.renderButtons(contentEl);

    globalLogger.info("HITL Modal opened", {
      tool: this.decision.tool,
      step: this.decision.step,
    });
  }

  onClose(): void {
    // Auto-reject wenn Modal ohne Entscheidung geschlossen wird
    if (!this.resolved) {
      this.decision.approved = false;
      this.decision.reason = "Modal closed without decision";
      this.onDecision(this.decision);
      globalLogger.warn("HITL Modal closed without decision - auto-rejecting");
    }

    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Rendert Header mit Icon und Title
   */
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-hitl-header" });

    const icon = header.createSpan({ text: "⚠️", cls: "pa-hitl-icon" });

    const title = header.createEl("h2", { text: "Approval Required" });
    title.addClass("pa-hitl-title");
  }

  /**
   * Rendert Tool-Informationen
   */
  private renderToolInfo(container: HTMLElement): void {
    const infoDiv = container.createDiv({ cls: "pa-hitl-info" });

    infoDiv.createEl("p", {
      text: `The following tool requires your approval before execution:`,
    });

    const toolName = infoDiv.createEl("div", { cls: "pa-hitl-tool-name" });
    toolName.createEl("strong", { text: "Tool: " });
    toolName.createSpan({ text: this.decision.tool });

    const stepName = infoDiv.createEl("div", { cls: "pa-hitl-step-name" });
    stepName.createEl("strong", { text: "Step: " });
    stepName.createSpan({ text: this.decision.step });
  }

  /**
   * Rendert Parameter-Preview
   */
  private renderParametersPreview(container: HTMLElement): void {
    const paramsDiv = container.createDiv({ cls: "pa-hitl-parameters" });

    paramsDiv.createEl("h3", { text: "Parameters:" });

    const paramsList = paramsDiv.createEl("div", { cls: "pa-params-list" });

    for (const [key, value] of Object.entries(this.decision.parameters)) {
      const paramItem = paramsList.createDiv({ cls: "pa-param-item" });

      const paramKey = paramItem.createEl("span", { cls: "pa-param-key" });
      paramKey.setText(`${key}:`);

      const paramValue = paramItem.createEl("span", { cls: "pa-param-value" });
      paramValue.setText(this.formatParameterValue(value));
    }
  }

  /**
   * Formatiert Parameter-Wert für Anzeige
   */
  private formatParameterValue(value: any): string {
    if (value === null || value === undefined) {
      return "(empty)";
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  /**
   * Zeigt Warnung bei destruktiven Operationen
   */
  private renderWarning(container: HTMLElement): void {
    const warningDiv = container.createDiv({ cls: "pa-hitl-warning" });

    warningDiv.createEl("h3", { text: "⚠️ Warning" });

    const warningText = warningDiv.createEl("p");
    warningText.setText(this.getWarningMessage());
    warningText.addClass("pa-warning-text");
  }

  /**
   * Generiert Warnung basierend auf Tool
   */
  private getWarningMessage(): string {
    const tool = this.decision.tool.toLowerCase();

    if (tool.includes("write") || tool.includes("file")) {
      return "This operation will modify files in your vault. Make sure you have a backup.";
    }

    if (tool.includes("delete") || tool.includes("remove")) {
      return "This operation will delete data. This action cannot be undone.";
    }

    if (tool.includes("request") || tool.includes("http")) {
      const method = this.decision.parameters.method as string;
      if (method && ["POST", "PUT", "DELETE"].includes(method.toUpperCase())) {
        return "This operation will send a request that may modify external data.";
      }
    }

    return "This operation requires your approval before proceeding.";
  }

  /**
   * Prüft ob Operation destruktiv ist
   */
  private isDestructiveOperation(): boolean {
    const tool = this.decision.tool.toLowerCase();
    return (
      tool.includes("write") ||
      tool.includes("delete") ||
      tool.includes("remove") ||
      tool.includes("modify")
    );
  }

  /**
   * Rendert Approve/Reject Buttons
   */
  private renderButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv({ cls: "pa-hitl-buttons" });

    // Reject Button (links, weniger prominent)
    const rejectBtn = buttonContainer.createEl("button", { text: "❌ Reject" });
    rejectBtn.addClass("pa-btn-reject");
    rejectBtn.addEventListener("click", () => {
      this.handleReject();
    });

    // Approve Button (rechts, prominent)
    const approveBtn = buttonContainer.createEl("button", { text: "✅ Approve" });
    approveBtn.addClass("pa-btn-approve");
    approveBtn.addEventListener("click", () => {
      this.handleApprove();
    });

    // Keyboard Shortcuts
    this.setupKeyboardShortcuts(approveBtn, rejectBtn);
  }

  /**
   * Setup Keyboard Shortcuts
   */
  private setupKeyboardShortcuts(approveBtn: HTMLElement, rejectBtn: HTMLElement): void {
    this.contentEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.handleApprove();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.handleReject();
      }
    });

    // Focus auf Approve-Button setzen
    (approveBtn as HTMLButtonElement).focus();
  }

  /**
   * Behandelt Approve-Entscheidung
   */
  private handleApprove(): void {
    this.decision.approved = true;
    this.decision.reason = "User approved";
    this.resolved = true;

    globalLogger.info("HITL approved", {
      tool: this.decision.tool,
      step: this.decision.step,
    });

    this.onDecision(this.decision);
    this.close();
  }

  /**
   * Behandelt Reject-Entscheidung
   */
  private handleReject(): void {
    this.decision.approved = false;
    this.decision.reason = "User rejected";
    this.resolved = true;

    globalLogger.info("HITL rejected", {
      tool: this.decision.tool,
      step: this.decision.step,
    });

    this.onDecision(this.decision);
    this.close();
  }
}

/**
 * Erstellt und zeigt HITL Modal
 * Helper-Funktion für einfachere Verwendung
 */
export function showHITLModal(
  app: App,
  toolName: string,
  stepName: string,
  parameters: Record<string, any>
): Promise<HITLDecision> {
  return new Promise((resolve) => {
    const decision: HITLDecision = {
      approved: false,
      tool: toolName,
      step: stepName,
      parameters,
    };

    const modal = new HITLModal(app, decision, (finalDecision) => {
      resolve(finalDecision);
    });

    modal.open();
  });
}

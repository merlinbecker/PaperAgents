/**
 * Paper Agents Forms - Dynamische Formulargenerierung aus Parameter-Definitionen
 * Validiert Input, erstellt UI-Elemente basierend auf Parametertypen
 */

import { Modal, App, Setting } from "obsidian";
import { Parameter, ToolMetadata } from "../types";
import ParameterValidator from "../parser/validator";
import { globalLogger } from "../utils/logger";

/**
 * Form Modal für Tool-Ausführung
 */
export class ToolFormModal extends Modal {
  private tool: ToolMetadata;
  private onSubmit: (parameters: Record<string, any>) => void;
  private formValues: Record<string, any> = {};
  private formContainer: HTMLElement | null = null;

  constructor(
    app: App,
    tool: ToolMetadata,
    onSubmit: (parameters: Record<string, any>) => void
  ) {
    super(app);
    this.tool = tool;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("paper-agents-form");

    // Header
    contentEl.createEl("h2", { text: this.tool.name });
    if (this.tool.description) {
      contentEl.createEl("p", { text: this.tool.description });
    }

    // Form Container
    this.formContainer = contentEl.createDiv({ cls: "pa-form-container" });

    // Render Parameter Fields
    this.renderParameterFields();

    // Buttons
    this.renderButtons(contentEl);

    globalLogger.debug(`Opened form for tool: ${this.tool.id}`);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Rendert Input-Felder für alle Parameter
   */
  private renderParameterFields(): void {
    if (!this.formContainer) return;

    for (const param of this.tool.parameters) {
      this.renderParameterField(this.formContainer, param);
    }
  }

  /**
   * Rendert ein einzelnes Parameter-Feld
   */
  private renderParameterField(container: HTMLElement, param: Parameter): void {
    new Setting(container)
      .setName(param.name)
      .setDesc(this.buildParameterDescription(param))
      .addText((text) => {
        // Default-Wert setzen
        if (param.default !== undefined) {
          const defaultStr = this.valueToString(param.default);
          text.setValue(defaultStr);
          this.formValues[param.name] = param.default;
        }

        // Placeholder
        text.setPlaceholder(this.getPlaceholder(param));

        // onChange Handler
        text.onChange((value) => {
          this.formValues[param.name] = this.parseValue(value, param.type);
          globalLogger.debug(`Parameter ${param.name} changed: ${value}`);
        });

        return text;
      });
  }

  /**
   * Baut Beschreibungstext für Parameter
   */
  private buildParameterDescription(param: Parameter): string {
    const parts: string[] = [];

    if (param.description) {
      parts.push(param.description);
    }

    parts.push(`Type: ${param.type}`);

    if (param.required) {
      parts.push("**Required**");
    }

    if (param.default !== undefined) {
      parts.push(`Default: ${this.valueToString(param.default)}`);
    }

    return parts.join(" • ");
  }

  /**
   * Generiert Placeholder basierend auf Typ
   */
  private getPlaceholder(param: Parameter): string {
    switch (param.type) {
      case "string":
        return "Enter text...";
      case "number":
        return "Enter number...";
      case "boolean":
        return "true or false";
      case "array":
        return '["item1", "item2"]';
      case "object":
        return '{"key": "value"}';
      default:
        return "";
    }
  }

  /**
   * Parst Input-Wert basierend auf Typ
   */
  private parseValue(value: string, type: string): any {
    if (!value || value.trim() === "") {
      return undefined;
    }

    switch (type) {
      case "number":
        const num = parseFloat(value);
        return isNaN(num) ? undefined : num;

      case "boolean":
        return value.toLowerCase() === "true";

      case "array":
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : undefined;
        } catch {
          return undefined;
        }

      case "object":
        try {
          const parsed = JSON.parse(value);
          return typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : undefined;
        } catch {
          return undefined;
        }

      case "string":
      default:
        return value;
    }
  }

  /**
   * Konvertiert Wert zu String für Anzeige
   */
  private valueToString(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Rendert Submit/Cancel Buttons
   */
  private renderButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv({ cls: "pa-form-buttons" });

    // Cancel Button
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addClass("pa-btn-cancel");
    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    // Submit Button
    const submitBtn = buttonContainer.createEl("button", { text: "Execute" });
    submitBtn.addClass("pa-btn-submit");
    submitBtn.addEventListener("click", () => {
      this.handleSubmit();
    });
  }

  /**
   * Validiert und submitted Form
   */
  private handleSubmit(): void {
    // Validiere Parameter
    const validation = ParameterValidator.validateParameters(this.tool.parameters, this.formValues);

    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`);
      this.showValidationError(errorMessages);
      globalLogger.warn("Form validation failed", { errors: validation.errors });
      return;
    }

    globalLogger.info(`Form submitted for tool: ${this.tool.id}`, {
      parameters: this.formValues,
    });

    // Callback aufrufen
    this.onSubmit(this.formValues);

    // Modal schließen
    this.close();
  }

  /**
   * Zeigt Validierungs-Fehler
   */
  private showValidationError(errors: string[]): void {
    const errorContainer = this.contentEl.createDiv({ cls: "pa-form-errors" });
    errorContainer.empty();

    const errorTitle = errorContainer.createEl("h4", {
      text: "Validation Errors:",
    });
    errorTitle.addClass("pa-error-title");

    const errorList = errorContainer.createEl("ul");
    for (const error of errors) {
      errorList.createEl("li", { text: error });
    }

    // Auto-remove nach 5 Sekunden
    setTimeout(() => {
      errorContainer.remove();
    }, 5000);
  }
}

/**
 * Quick Form für einfache Tools (1-2 Parameter)
 * Wird inline in Sidebar angezeigt statt als Modal
 */
export class QuickToolForm {
  private container: HTMLElement;
  private tool: ToolMetadata;
  private onSubmit: (parameters: Record<string, any>) => void;
  private formValues: Record<string, any> = {};

  constructor(
    container: HTMLElement,
    tool: ToolMetadata,
    onSubmit: (parameters: Record<string, any>) => void
  ) {
    this.container = container;
    this.tool = tool;
    this.onSubmit = onSubmit;
  }

  /**
   * Rendert Quick-Form
   */
  render(): void {
    this.container.empty();
    this.container.addClass("pa-quick-form");

    // Title
    const title = this.container.createEl("h4", { text: this.tool.name });
    title.addClass("pa-quick-form-title");

    // Parameters (max 2 für Quick-Form)
    const paramsToShow = this.tool.parameters.slice(0, 2);
    for (const param of paramsToShow) {
      this.renderQuickField(param);
    }

    // Submit Button
    const submitBtn = this.container.createEl("button", { text: "Run" });
    submitBtn.addClass("pa-quick-submit");
    submitBtn.addEventListener("click", () => {
      this.handleSubmit();
    });
  }

  /**
   * Rendert Quick-Field (kompakt)
   */
  private renderQuickField(param: Parameter): void {
    const fieldDiv = this.container.createDiv({ cls: "pa-quick-field" });

    const label = fieldDiv.createEl("label", { text: param.name });
    label.addClass("pa-quick-label");

    const input = fieldDiv.createEl("input");
    input.addClass("pa-quick-input");
    input.setAttribute("type", param.type === "number" ? "number" : "text");
    input.setAttribute("placeholder", this.getPlaceholder(param));

    if (param.default !== undefined) {
      input.value = String(param.default);
      this.formValues[param.name] = param.default;
    }

    input.addEventListener("input", () => {
      this.formValues[param.name] = this.parseValue(input.value, param.type);
    });
  }

  /**
   * Placeholder für Quick-Form
   */
  private getPlaceholder(param: Parameter): string {
    if (param.type === "string") return "text...";
    if (param.type === "number") return "123";
    return "";
  }

  /**
   * Parst Quick-Form Value
   */
  private parseValue(value: string, type: string): any {
    if (type === "number") {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return value;
  }

  /**
   * Submit Quick-Form
   */
  private handleSubmit(): void {
    // Einfache Validierung
    for (const param of this.tool.parameters) {
      if (param.required && !this.formValues[param.name]) {
        alert(`Required parameter missing: ${param.name}`);
        return;
      }
    }

    this.onSubmit(this.formValues);
  }

  /**
   * Entfernt Quick-Form
   */
  destroy(): void {
    this.container.empty();
  }
}

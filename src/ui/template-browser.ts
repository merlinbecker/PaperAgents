import { Modal, App } from "obsidian";

export interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  type: "tool" | "agent" | "chain";
  content: string;
}

export class TemplateBrowserModal extends Modal {
  private readonly templates: ToolTemplate[];
  private readonly onImport: (template: ToolTemplate) => void;

  constructor(app: App, templates: ToolTemplate[], onImport: (template: ToolTemplate) => void) {
    super(app);
    this.templates = templates;
    this.onImport = onImport;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("paper-agents-templates");

    contentEl.createEl("h2", { text: "Template library" });

    const controls = contentEl.createDiv({ cls: "pa-history-filters" });
    const searchInput = controls.createEl("input", {
      cls: "pa-history-search",
      attr: { type: "text", placeholder: "Search templates..." },
    });

    const typeSelect = controls.createEl("select", { cls: "pa-history-filter-select" });
    typeSelect.createEl("option", { text: "All types", attr: { value: "" } });
    typeSelect.createEl("option", { text: "Tools", attr: { value: "tool" } });
    typeSelect.createEl("option", { text: "Agents", attr: { value: "agent" } });
    typeSelect.createEl("option", { text: "Chains", attr: { value: "chain" } });

    const grid = contentEl.createDiv({ cls: "pa-template-grid" });

    const renderTemplates = () => {
      grid.empty();
      const search = searchInput.value.toLowerCase();
      const typeFilter = typeSelect.value;

      const filtered = this.templates.filter((t) => {
        if (typeFilter && t.type !== typeFilter) return false;
        if (search && !t.name.toLowerCase().includes(search) && !t.description.toLowerCase().includes(search)) return false;
        return true;
      });

      if (filtered.length === 0) {
        grid.createDiv({ cls: "pa-history-empty", text: "No templates found" });
        return;
      }

      for (const template of filtered) {
        const card = grid.createDiv({ cls: "pa-template-card" });
        card.createDiv({ cls: "pa-template-name", text: template.name });
        card.createDiv({ cls: "pa-template-desc", text: template.description });
        card.createSpan({ cls: "pa-template-type-badge", text: template.type });

        card.addEventListener("click", () => {
          this.onImport(template);
          this.close();
        });
      }
    };

    searchInput.addEventListener("input", renderTemplates);
    typeSelect.addEventListener("change", renderTemplates);
    renderTemplates();

    const footer = contentEl.createDiv({ cls: "pa-history-footer" });

    const importBtn = footer.createEl("button", { cls: "pa-btn-submit", text: "Import from clipboard" });
    importBtn.addEventListener("click", () => {
      void navigator.clipboard.readText().then((text) => {
        const template = JSON.parse(text) as ToolTemplate;
        if (template.id && template.name && template.content) {
          this.onImport(template);
          this.close();
        }
      }).catch(() => {
        /* ignore parse errors */
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  static exportTemplate(template: ToolTemplate): string {
    return JSON.stringify(template, null, 2);
  }

  static parseTemplate(json: string): ToolTemplate | null {
    try {
      const parsed: unknown = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === "object" && "id" in parsed && "name" in parsed && "content" in parsed) {
        return parsed as ToolTemplate;
      }
      return null;
    } catch {
      return null;
    }
  }
}

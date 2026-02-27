import { Modal, App } from "obsidian";
import { Agent, Step } from "../types";

export class WorkflowViewModal extends Modal {
  private agent: Agent;

  constructor(app: App, agent: Agent) {
    super(app);
    this.agent = agent;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pa-workflow-container");

    this.renderHeader(contentEl);
    this.renderCanvas(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "pa-workflow-header" });
    header.createEl("h2", { text: `Workflow: ${this.agent.name}` });

    const info = header.createDiv();
    info.createSpan({
      cls: "pa-tool-badge",
      text: this.agent.type === "chain" ? `${this.agent.steps?.length || 0} steps` : "single",
    });
  }

  private renderCanvas(container: HTMLElement): void {
    const canvas = container.createDiv({ cls: "pa-workflow-canvas" });

    if (this.agent.type === "single") {
      this.renderSingleWorkflow(canvas);
    } else if (this.agent.type === "chain" && this.agent.steps) {
      this.renderChainWorkflow(canvas, this.agent.steps);
    }
  }

  private renderSingleWorkflow(canvas: HTMLElement): void {
    const step = canvas.createDiv({ cls: "pa-workflow-step" });
    step.createDiv({ cls: "pa-workflow-step-name", text: this.agent.name });

    if (this.agent.preprocess) {
      step.createDiv({ cls: "pa-workflow-step-type", text: "Pre-process -> Execute -> Post-process" });
    } else {
      step.createDiv({ cls: "pa-workflow-step-type", text: "Direct execution" });
    }
  }

  private renderChainWorkflow(canvas: HTMLElement, steps: Step[]): void {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      if (i > 0) {
        const connector = canvas.createDiv({ cls: "pa-workflow-connector" });
        connector.textContent = "\u2193";
      }

      const stepEl = canvas.createDiv({ cls: "pa-workflow-step" });
      stepEl.createDiv({ cls: "pa-workflow-step-name", text: step.name });

      const badges: string[] = [];
      if (step.condition) badges.push("conditional");
      if (step.loop) badges.push(`loop:${step.loop.over}`);
      if (step.retry) badges.push(`retry:${step.retry.maxAttempts}x`);
      if (step.continueOnError) badges.push("continue-on-error");

      if (badges.length > 0) {
        stepEl.createDiv({ cls: "pa-workflow-step-type", text: badges.join(" | ") });
      }
    }
  }
}

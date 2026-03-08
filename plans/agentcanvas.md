# Agent Canvas – Feature Plan

## Overview

The **Agent Canvas** mode transforms an Obsidian document into an interactive workspace where the user can collaborate with an AI agent directly inside the Markdown file. The agent's responses appear as [Obsidian callouts](https://help.obsidian.md/Editing+and+formatting/Callouts) inserted into the document, making the document itself the conversation thread.

---

## Motivation & Research

### How other providers implement canvas / inline annotation

| Provider | Approach |
|---|---|
| **ChatGPT Canvas** | Dedicated split-pane editor. The AI can read and edit the full document. User can select text and ask questions about it. AI replies appear directly in the document (edits) or in the chat rail. |
| **Claude Artifacts** | Separate pane showing a rendered "artifact" (code, SVG, HTML, etc.). The chat rail stays separate; the AI can update the artifact in place. |
| **Notion AI** | Inline block suggestions. AI inserts a specially-styled block at the cursor position; user can accept or dismiss. |
| **Google Docs "Help me write"** | Floating AI panel; AI output is shown in a preview chip; user clicks "Insert" to add to the document. |
| **Cursor / Copilot** | Code-editor specific: AI suggestions appear inline (ghost text) or as diff hunks in the editor. |

### Key insight for Obsidian

Obsidian's native **callout** blocks (`> [!note] …`) are the ideal representation for AI annotations because:
- They render beautifully in reading view.
- They are editable in source view like normal Markdown.
- They are distinguishable from normal document content by their `> [!…]` prefix.
- They support a custom title, so the agent name and timestamp can be embedded.

---

## User Story

> *As an Obsidian user, I want to apply an AI agent to my current document so that the agent can annotate the document with feedback, suggestions, or analysis, and I can continue the conversation inline without leaving the document.*

---

## Feature Requirements

### FR-1: Command and sidebar button

- A command **"Apply interactive agent to document"** (`paper-agents:apply-agent-canvas`) is registered in the Obsidian command palette.
- A **canvas button** (🖊️) is added to the Paper Agents sidebar header alongside the existing chat button.
- Both triggers open the same **Canvas Modal**.

### FR-2: Agent selection

- If the active document's frontmatter contains `paper-agent: <agent_id>`, that agent is used automatically.
- Otherwise, the Canvas Modal shows a dropdown to select from all loaded agents.
- If no agents are loaded, a helpful error notice is displayed.

### FR-3: Conversation start

- On first run, the full document content (excluding the agent's previous callouts) is sent to the agent as context with a framing prompt:

  ```
  You are reviewing the following document. Provide annotations, feedback, or analysis.
  When referencing a specific part of the document, quote it briefly.
  To place your annotation after a specific paragraph, start your response with
  `@after-paragraph-N:` (e.g., `@after-paragraph-3:`) on the first line.
  Otherwise your annotation will be appended at the end of the document.

  === DOCUMENT ===
  {document_content}
  === END ===
  ```

- The conversation is managed by the existing `ConversationManager` and `Orchestrator`.

### FR-4: Response as callout

- The agent's response is appended to the document as an Obsidian callout:

  ```markdown
  > [!note] 🤖 Agent: My Agent *(2026-01-01 10:05)*
  >
  > Agent response text here...
  ```

- A separator comment `<!-- paper-agents-canvas -->` is prepended to the callout block so the plugin can identify and skip agent-injected content in subsequent context builds.

### FR-5: Continued conversation

- After the first response, the user can type a follow-up message in the modal's input field.
- The user's message is also appended to the document as a callout:

  ```markdown
  > [!question] 👤 User *(2026-01-01 10:07)*
  >
  > User reply here...
  ```

- The conversation history used by the LLM contains all messages (both user and agent), preserving context.

### FR-6: Streaming

- Agent tokens stream into the modal in real-time.
- The callout is inserted into the document only once the full response is complete (to avoid partial writes).

### FR-7: Inline placement hints (Phase 4)

- The agent can include `@after-paragraph-N:` at the very beginning of its response to indicate where the callout should be inserted.
- Example: `@after-paragraph-3: Your annotation here.` inserts the callout after paragraph 3.
- The `buildInitialPrompt` includes instructions about the hint syntax so the model can use it.
- `CanvasAgent.parseInlinePlacement(responseText)` strips the hint and returns the paragraph index.
- `CanvasAgent.insertCalloutAfterParagraph(content, calloutText, N)` inserts the formatted callout after the N-th paragraph.
- If the index is out of range or no hint is present, the callout is appended at the end (existing behaviour unchanged).

### FR-8: Document diff view (Phase 4)

- After the first agent response is written to the document, a **📊 View diff** button appears below the conversation panel.
- Clicking the button reveals a collapsible diff section showing:
  - Original vs. current document line counts (excluding canvas callouts).
  - A list of all canvas callout blocks (agent and user) that have been added, with their title and a truncated body preview.
- `CanvasAgent.extractCanvasCallouts(content)` returns structured metadata for each callout block.

### FR-9: Multi-agent canvas (Phase 5)

- When two or more agents are loaded, a **Multi-agent mode** checkbox appears in the agent-selection section.
- When enabled, all agents are shown as individual checkboxes.
- Clicking **Start canvas session** (or **Run all agents**) runs each selected agent **sequentially**:
  1. Each agent gets its own `ConversationManager` conversation.
  2. The same document context (without prior canvas callouts) is sent to every agent.
  3. Each agent's response is appended as a separate callout block.
- A visual separator (`── Running: <Agent Name> ──`) appears in the conversation panel between agents.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `src/core/canvas-agent.ts` | `CanvasAgent` service: read document content, strip previous callouts, inject new callouts |
| `src/ui/canvas-modal.ts` | `CanvasModal` class: agent selection, streaming display, input, document writing |

### Modified files

| File | Change |
|---|---|
| `src/commands/index.ts` | Register `apply-agent-canvas` command |
| `src/ui/sidebar.ts` | Add canvas button (🖊️) to header; wire `onOpenCanvas` callback |
| `src/main.ts` | Pass `activateCanvas()` to sidebar; implement `activateCanvas()` method |

### Data flow

```
User triggers command / sidebar button
    │
    ▼
CanvasModal opens
    │
    ├─ read frontmatter → resolve agent
    │
    ├─ read document body → strip canvas callouts → build context
    │
    ▼
Orchestrator.sendMessage(agent, conversationId, contextPrompt)
    │
    ├─ stream tokens → update modal streaming display
    │
    └─ onComplete → CanvasAgent.appendCallout(file, agentName, content)
                        │
                        └─ vault.process() → append callout block to document
```

---

## Callout format specification

### Agent callout

```markdown
<!-- paper-agents-canvas -->
> [!note] 🤖 Agent: Research Assistant *(2026-01-01T10:05:00Z)*
>
> Your document is well-structured. Consider expanding the introduction to include...
```

### User callout

```markdown
<!-- paper-agents-canvas -->
> [!question] 👤 User *(2026-01-01T10:07:00Z)*
>
> Can you give a specific example for point 3?
```

---

## Frontmatter support

Documents can pre-configure which agent to use:

```markdown
---
paper-agent: research_assistant
---

# My Document
...
```

When `paper-agent` is found in the frontmatter, the agent selection step is skipped.

---

## Acceptance Criteria

- [x] Command `paper-agents:apply-agent-canvas` appears in the Obsidian command palette.
- [x] Sidebar shows a canvas button (🖊️) that opens the Canvas Modal.
- [x] If active document has `paper-agent: <id>` frontmatter, that agent is auto-selected.
- [x] Without frontmatter, user can select an agent from the dropdown.
- [x] On confirmation, the document content is sent to the agent as context.
- [x] Agent response is appended to the document as a callout with agent name and timestamp.
- [x] User can type follow-up messages; they are appended as user callouts, and agent replies are appended next.
- [x] Previous callouts are excluded from subsequent context builds.
- [x] Streaming tokens are visible in the modal while the response is generated.
- [x] Graceful error handling: no API key → Notice; no agents loaded → Notice.
- [x] Callout-dismissal: 🗑️-Button im Modal entfernt den Callout aus Dokument und Modal.
- [x] Selektions-Kontext: Wenn Text selektiert ist, wird nur die Selektion als Kontext gesendet.
- [x] Inline placement: Agent response starting with `@after-paragraph-N:` is inserted after paragraph N.
- [x] Document diff view: 📊 button reveals a list of all added callouts with title/body preview.
- [x] Multi-agent canvas: Multi-agent mode checkbox, sequential agent execution, visual agent separator.

---

## Future Enhancements

- **Inline placement**: Use a special markup in the agent response to indicate where to insert the callout (e.g., `@after-paragraph-3:`). ✅ *Implemented in Phase 4*
- **Callout dismissal**: Allow users to delete individual agent callouts with a button. ✅ *Implemented in Phase 2*
- **Document diff view**: Show a side-by-side diff of the original document and the agent-annotated version. ✅ *Implemented in Phase 4*
- **Multi-agent canvas**: Support running multiple agents on the same document and merging their annotations. ✅ *Implemented in Phase 5*
- **Selection-scoped context**: User selects text before triggering the command; only that selection is sent to the agent. ✅ *Implemented in Phase 3*

---

## Timeline

| Phase | Content | Status |
|---|---|---|
| **Phase 1** | Core implementation: command, modal, callout injection, frontmatter support | ✅ Fertig |
| **Phase 2** | Callout dismissal (🗑️-Button) | ✅ Fertig |
| **Phase 3** | Selection-scoped context | ✅ Fertig |
| **Phase 4** | Inline placement hints (`@after-paragraph-N:`), document diff view (📊) | ✅ Fertig |
| **Phase 5** | Multi-agent canvas (sequential execution, agent checkboxes) | ✅ Fertig |

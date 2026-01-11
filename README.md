```markdown
# Paper Agents

**Because AI agents shouldn’t require a PhD in frameworkology.**

---
<a href="https://www.buymeacoffee.com/merlinbecker"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a beer&emoji=🍺&slug=merlinbecker&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" /></a>


## 🤖 The Premise

**Paper Agents** is an Obsidian plugin for people who suspect that "agentic workflows" might just be **fancy terminology for glorified note-taking with extra steps**—and want to prove it.

This tool lets you **design, test, and execute AI agents** using nothing but **Markdown, YAML, and the absolute minimum of JavaScript necessary to avoid looking like a caveperson**. No bloated frameworks. No vendor lock-in. Just **agents you can actually understand**, because they’re written in the same place you jot down your grocery lists.

---

## 📜 The Manifesto (or: Why This Exists)

I built Paper Agents because:
1. **Agent hype is outpacing agent clarity.** Everyone’s talking about "autonomous agents," but nobody’s explaining how they work in terms simpler than a research paper.
2. **Most agent tools are overengineered.** If your agent requires a 20-step setup and a cloud subscription, it’s not a tool—it’s a **hostage situation**.
3. **The best way to understand something is to build it badly first.** Paper Agents is your **safe space for terrible ideas**, where you can prototype agents in Markdown before inflicting them on the world.

**Core belief:** If you can’t sketch an agent on paper, you don’t understand it. If you can’t test it in 30 seconds, it’s not a tool—it’s a **career**.

---

## 🛠 How It Works (Or Doesn’t)

### 1. **Define Your Agent in Markdown**
Use YAML frontmatter to declare what your agent does, and JavaScript snippets to handle the parts where **pure stubbornness isn’t enough**.

Example:
````markdown
---
tool: sarcasm_generator
name: "Passive-Aggressive Response Bot"
description: "Generates mildly disappointing replies to overenthusiastic emails."
type: single
parameters:
  - name: input_text
    type: string
    description: "The text you’d rather not respond to."
---

```javascript
// Pre-processing: Add eye-roll emoji
function prepareParams(params) {
  return { text: params.input_text + " 🙄" };
}
```

```text
// System Prompt
You are a world-weary assistant. Respond to the following text with the minimum enthusiasm legally required:
{{input_text}}
```
````

### 2. **Test It Before You Regret It**
Click **"Test Tool"** to see if your agent works—or if it’s just **another overpromised AI disappointment**.

### 3. **Connect to the Outside World (If You Must)**
- **OpenRouter integration**: Because even minimalists need LLMs sometimes.
- **REST API calls**: For when you absolutely, positively have to talk to a server.
- **File operations**: Read/write notes, with **human confirmation** so you don’t accidentally delete your life’s work.

### 4. **Run It Offline (Because the Cloud Is Overrated)**
- **Local JS execution**: For tasks so simple, they don’t deserve an API call.
- **Offline audio processing**: Transcribe your rants without uploading them to **Some Corporation™**.

---

## 🔧 Features (Or: Things That Might Work)

| Feature               | Reality Check                                  |
|-----------------------|------------------------------------------------|
| **YAML tool definitions** | Yes, you’re writing config files. No, you don’t get a trophy. |
| **Sandboxed JavaScript** | Your code runs in a cage, like it should.      |
| **Human-in-the-loop**    | Because automation is great until it’s not.   |
| **Markdown-native**      | Design agents where you already pretend to organize your life. |
| **Chain tools**         | Combine steps like a **Rube Goldberg machine**, but with less charm. |

---

## 🚀 Example: An Agent That Does Your Homework (Poorly)

1. **Task**: "Summarize this 50-page PDF."
2. **Agent**:
   - Reads the PDF (if you’ve enabled file access).
   - Extracts key sentences (or hallucinates them).
   - Outputs a summary (or a **vague approximation of one**).
3. **Result**: A draft that’s **80% correct and 100% your problem now**.

---

## 📦 Installation (Or: How to Acquire Regrets)

1. Install from **Obsidian Community Plugins**.
2. Add your **OpenRouter API key** (if you’re feeling brave).
3. Start writing agents in Markdown.
4. **Realize you’ve just reinvented the wheel**—but at least it’s *your* wheel.

---

## 💡 Philosophy

> *"If you can’t explain your agent to a tired intern, you’ve already lost."*

Paper Agents is for:
- **Developers who miss the days when code was just text files.**
- **Obsidian users who suspect their notes could be doing more (but not *too* much more).**
- **People who like their tools like their coffee: strong, simple, and **without surprise subscriptions**."*

---

## 🛣 Roadmap (Or: Future Disappointments)

- [ ] **Agent memory**: Because forgetting things is **your job**, not the computer’s.
- [ ] **Debugging tools**: For when your agent inevitably **misinterprets everything**.
- [ ] **Community templates**: Share your **questionable life choices** with others.

---

## 📌 License

MIT © [Merlin Becker](https://github.com/merlinbecker)

---
*"Paper Agents: Proving that AI doesn’t have to be complicated—just **mildly frustrating** in new ways."*
```
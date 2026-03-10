export interface SidebarExample {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  usageHint: string;
  icon: string;
  group: string;
  tags: string[];
  fileType: "tool" | "agent";
  fileName: string;
  content: string;
}

// ── Content builder helpers ──────────────────────────────────────────────────

/**
 * Generates the YAML frontmatter block for a tool definition file.
 * @param id - Unique tool identifier
 * @param name - Human-readable tool name
 * @param type - Tool type: "single" or "chain"
 * @param parameters - Pre-formatted YAML string for the parameters list (indented with 2 spaces)
 * @param description - Short description of the tool
 * @param extra - Optional extra frontmatter lines appended before the closing `---`
 */
function buildToolFrontmatter(
  id: string,
  name: string,
  type: "single" | "chain",
  parameters: string,
  description: string,
  extra?: string
): string {
  return `---
tool: true
id: ${id}
name: "${name}"
type: ${type}
parameters:
${parameters}description: "${description}"${extra ? `\n${extra}` : ""}
---`;
}

/**
 * Generates the YAML frontmatter block for an agent definition file.
 * @param id - Unique agent identifier
 * @param name - Human-readable agent name
 * @param description - Short description of the agent
 * @param model - OpenRouter model identifier (e.g. "openai/gpt-4o-mini")
 * @param tools - List of tool IDs available to the agent
 * @param maxMessages - Maximum conversation history length
 * @param temperature - LLM sampling temperature (0–1)
 */
function buildAgentFrontmatter(
  id: string,
  name: string,
  description: string,
  model: string,
  tools: string[],
  maxMessages: number,
  temperature: number
): string {
  const toolLines = tools.map((t) => `  - ${t}`).join("\n");
  return `---
agent: true
id: ${id}
name: "${name}"
description: "${description}"
model: ${model}
tools:
${toolLines}
memory:
  type: conversation
  maxMessages: ${maxMessages}
temperature: ${temperature}
---`;
}

/**
 * Generates the `#### **Tool-Ausführung**` YAML execution block for a tool file.
 * @param toolId - The built-in or custom tool to invoke
 * @param parametersYaml - Pre-formatted YAML string for the parameter mappings (indented with 2 spaces)
 */
function buildToolExecutionBlock(toolId: string, parametersYaml: string): string {
  return `#### **Tool-Ausführung**
\`\`\`yaml
tool: "${toolId}"
parameters:
${parametersYaml}\`\`\``;
}

/** Generates the `#### **Pre-Processing**` JavaScript block for a tool file. */
function buildPreprocessBlock(code: string): string {
  return `#### **Pre-Processing**
\`\`\`javascript
// @preprocess
${code}\`\`\``;
}

/** Generates the `#### **Post-Processing**` JavaScript block for a tool file. */
function buildPostprocessBlock(code: string): string {
  return `#### **Post-Processing**
\`\`\`javascript
// @postprocess
${code}\`\`\``;
}

// ── Examples ─────────────────────────────────────────────────────────────────

export const SIDEBAR_EXAMPLES: SidebarExample[] = [
  {
    id: "search-vault",
    title: "Search Vault Files",
    description: "Search your vault for files matching a query",
    longDescription:
      "The simplest example: use the built-in search_files tool to find files in your vault. This is a predefined tool that requires no setup — just open the sidebar, click search_files, and enter a search query.",
    usageHint:
      'Click "search_files" in the Predefined Tools section above, enter a search query like "meeting notes", and run it. The results show all matching files with their paths.',
    icon: "🔍",
    group: "Predefined Tools",
    tags: ["beginner", "no setup"],
    fileType: "tool",
    fileName: "example-search.md",
    content: `${buildToolFrontmatter(
      "search_vault_example",
      "Search Vault",
      "single",
      `  - name: query
    type: string
    description: "What to search for"
    required: true
  - name: path
    type: string
    description: "Folder to search in (default: entire vault)"
    required: false
    default: "/"
`,
      "Search for files in your vault by name or content"
    )}

This tool uses the built-in \`search_files\` tool.

${buildToolExecutionBlock("search_files", `  query: "{{query}}"
  path: "{{path}}"
`)}`,
  },
  {
    id: "daily-note",
    title: "Daily Note Creator",
    description: "Create a structured daily note with template",
    longDescription:
      "This custom tool demonstrates pre-processing and post-processing with JavaScript. It generates a daily note with a structured template including metadata, task sections, and reflections. The pre-processing step builds the note content, and the post-processing step formats the success message.",
    usageHint:
      'Install this example to your vault, then reload custom tools (Command Palette > "Paper Agents: Reload Custom Tools"). The tool will appear in the Custom Tools section.',
    icon: "📝",
    group: "Custom Tools",
    tags: ["javascript", "write_file", "template"],
    fileType: "tool",
    fileName: "daily-note-creator.md",
    content: `${buildToolFrontmatter(
      "create_daily_note",
      "Create Daily Note",
      "single",
      `  - name: tags
    type: string
    description: "Comma-separated tags for the note"
    required: false
    default: ""
  - name: mood
    type: string
    description: "Today's mood"
    required: false
    default: "neutral"
`,
      "Creates a daily note with a structured template"
    )}

${buildPreprocessBlock(`const today = new Date().toISOString().split('T')[0];
input.filePath = \`daily-notes/\${today}.md\`;

const tagList = input.tags
  ? input.tags.split(',').map(t => \`#\${t.trim()}\`).join(' ')
  : '';

input.content = \`# Daily Note - \${today}

## Metadata
- Date: \${today}
- Mood: \${input.mood}
- Tags: \${tagList}

## Tasks
- [ ] Review yesterday's notes
- [ ] Plan today's priorities

## Notes


## Reflections

\`;
return input;
`)}

${buildToolExecutionBlock("write_file", `  filePath: "{{filePath}}"
  content: "{{content}}"
  overwrite: false
`)}

${buildPostprocessBlock(`return {
  message: "Daily note created successfully",
  path: output.filePath || "unknown",
  log: []
};
`)}`,
  },
  {
    id: "search-and-count",
    title: "Search & Count Chain",
    description: "Chain: search files, then count and summarize results",
    longDescription:
      "This is a chain tool — it executes multiple steps in sequence. First it searches for files, then the post-processing step analyzes the results: counting files by type, calculating total size, and finding the largest file. This demonstrates how chain steps can build on each other's output.",
    usageHint:
      "Install this tool, reload custom tools, then run it with a search query. The output will include a summary with file type statistics and the largest file found.",
    icon: "🔗",
    group: "Chain Tools",
    tags: ["chain", "multi-step", "post-processing"],
    fileType: "tool",
    fileName: "search-and-count.md",
    content: `${buildToolFrontmatter(
      "search_and_count",
      "Search & Count Results",
      "chain",
      `  - name: query
    type: string
    description: "Search query"
    required: true
  - name: folder
    type: string
    description: "Folder to search in"
    required: false
    default: "/"
`,
      "Searches for files and provides statistics"
    )}

#### **Steps**
\`\`\`yaml
steps:
  - name: "search"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "{{folder}}"
\`\`\`

${buildPostprocessBlock(`const results = output.results || [];
const fileTypes = {};

results.forEach(file => {
  const ext = file.path.split('.').pop() || 'none';
  fileTypes[ext] = (fileTypes[ext] || 0) + 1;
});

return {
  summary: {
    total_files: results.length,
    file_types: fileTypes,
  },
  files: results.map(f => ({
    name: f.name,
    path: f.path,
  })),
  log: []
};
`)}`,
  },
  {
    id: "conditional-chain",
    title: "Conditional Chain",
    description: "Chain with if/else logic based on previous results",
    longDescription:
      "Advanced chain example with conditional steps. After searching for files, the chain checks if any results were found. If results exist, it reads the first file. If no results are found, it skips the read step. This demonstrates the conditional execution feature with the 'condition' field on steps.",
    usageHint:
      "Install this tool and run it with a search query. If files are found, the first file's content will be read automatically. Check the output to see which steps executed.",
    icon: "🔀",
    group: "Advanced Features",
    tags: ["conditional", "chain", "advanced"],
    fileType: "tool",
    fileName: "conditional-chain.md",
    content: `${buildToolFrontmatter(
      "conditional_read",
      "Conditional Search & Read",
      "chain",
      `  - name: query
    type: string
    description: "What to search for"
    required: true
`,
      "Searches for files, reads the first result if found",
      "continueOnError: true"
    )}

#### **Steps**
\`\`\`yaml
steps:
  - name: "search"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "/"

  - name: "read_first"
    tool: "read_file"
    condition:
      field: "search.results.length"
      operator: "gt"
      value: 0
    parameters:
      filePath: "{{search.results.0.path}}"
\`\`\`

${buildPostprocessBlock(`const searchResults = output.search?.results || [];
const fileContent = output.read_first?.content;

return {
  found: searchResults.length,
  firstFile: searchResults[0]?.path || "none",
  contentPreview: fileContent
    ? fileContent.substring(0, 200) + "..."
    : "No file read",
  log: []
};
`)}`,
  },
  {
    id: "research-agent",
    title: "Research Assistant",
    description: "AI agent that searches and summarizes your vault",
    longDescription:
      "An AI agent powered by OpenRouter that helps you research information in your vault. It can search for files, read their contents, and provide summaries. The agent uses the search_files and read_file tools to find and analyze information, then responds in a conversational way. Requires an OpenRouter API key in Settings.",
    usageHint:
      'Install this agent, reload agents (Command Palette > "Paper Agents: Reload Agents"), then open the Chat (Command Palette > "Paper Agents: Open Chat"). Select "Research Assistant" from the agent dropdown and start asking questions about your vault.',
    icon: "🤖",
    group: "AI Agents",
    tags: ["agent", "LLM", "requires API key"],
    fileType: "agent",
    fileName: "research-assistant.md",
    content: `${buildAgentFrontmatter(
      "research_assistant",
      "Research Assistant",
      "Searches and summarizes information from your vault",
      "openai/gpt-4o-mini",
      ["search_files", "read_file"],
      30,
      0.7
    )}

# Research Assistant

## System Prompt
You are a helpful research assistant for Obsidian. Your job is to help the user find and understand information in their vault.

**Your capabilities:**
- Search for files in the vault (search_files)
- Read file contents (read_file)
- Summarize and analyze information

**Rules:**
1. Always search before saying you can't find something
2. Quote relevant passages from files you find
3. Ask for clarification if the request is unclear
4. Use Markdown formatting in your responses

**Response format:**
- Use bullet points for lists
- Put file names in \`backticks\`
- Use > blockquotes for citations from files`,
  },
  {
    id: "writing-agent",
    title: "Writing Helper",
    description: "AI agent that helps improve and edit your texts",
    longDescription:
      "An AI writing assistant that can read your notes, suggest improvements, correct errors, and help structure your texts. It reads files from your vault, analyzes the content, and provides detailed feedback with specific suggestions. It can also write improved versions back to your vault (with your approval via HITL). Requires an OpenRouter API key.",
    usageHint:
      'Install this agent, reload agents, then open the Chat. Select "Writing Helper" and tell it which file to review, e.g., "Please review my notes in projects/my-essay.md".',
    icon: "✍️",
    group: "AI Agents",
    tags: ["agent", "LLM", "writing", "requires API key"],
    fileType: "agent",
    fileName: "writing-helper.md",
    content: `${buildAgentFrontmatter(
      "writing_helper",
      "Writing Helper",
      "Helps improve, edit, and structure your texts",
      "openai/gpt-4o",
      ["read_file", "write_file"],
      20,
      0.8
    )}

# Writing Helper

## System Prompt
You are an experienced writing assistant and editor. You help the user write better texts.

**Your tasks:**
- Proofread texts and correct errors
- Improve style and expression
- Structure and organize texts
- Give feedback on content and structure

**How you work:**
1. Read the text carefully (read_file)
2. Analyze strengths and weaknesses
3. Suggest specific improvements
4. If needed: Write an improved version (write_file)

**Important rules:**
- Keep the author's voice
- Explain your suggested changes
- Ask about the goal of the text if unclear
- Never overwrite without confirmation

**Format for suggestions:**
- Original: "..."
- Suggestion: "..."
- Reason: ...`,
  },
  {
    id: "api-agent",
    title: "API Helper",
    description: "AI agent for making HTTP requests and processing responses",
    longDescription:
      "An AI agent specialized in working with web APIs. It can make HTTP requests (GET, POST, PUT, DELETE), analyze API responses, and save results to your vault. Useful for fetching data from external services, testing APIs, or integrating external data into your notes. POST/PUT/DELETE requests require your approval via the HITL confirmation dialog. Requires an OpenRouter API key.",
    usageHint:
      'Install this agent, reload agents, then open the Chat. Select "API Helper" and ask it to fetch data, e.g., "Fetch the latest posts from https://jsonplaceholder.typicode.com/posts?_limit=5".',
    icon: "🌐",
    group: "AI Agents",
    tags: ["agent", "LLM", "API", "HTTP", "requires API key"],
    fileType: "agent",
    fileName: "api-helper.md",
    content: `${buildAgentFrontmatter(
      "api_helper",
      "API Helper",
      "Makes HTTP requests and processes API responses",
      "openai/gpt-4o-mini",
      ["rest_request", "write_file"],
      25,
      0.5
    )}

# API Helper

## System Prompt
You are an expert in web APIs and HTTP requests. You help the user communicate with external services.

**Your capabilities:**
- Execute HTTP requests (GET, POST, PUT, DELETE)
- Analyze and explain API responses
- Save results to files in the vault

**Available HTTP methods:**
- GET: Fetch data (no confirmation needed)
- POST: Send data (requires confirmation)
- PUT: Update data (requires confirmation)
- DELETE: Remove data (requires confirmation)

**How you work:**
1. Understand what the user wants to achieve
2. Explain what request you will make
3. Execute the request
4. Explain the response clearly
5. If needed: Save results

**Security notes:**
- Ask for API keys if needed
- Explain what data will be sent
- Warn about sensitive operations (POST/PUT/DELETE)`,
  },
  {
    id: "ocr-agent",
    title: "PDF OCR Agent",
    description: "AI agent that converts PDFs to Markdown using Mistral OCR",
    longDescription:
      "An AI agent that uses OpenRouter's file-parser plugin powered by Mistral OCR to convert PDF files into Markdown. The agent reads a PDF from your vault, sends it to the Mistral OCR model via the file-parser plugin, and saves the extracted Markdown to a file. Requires an OpenRouter API key and a model that supports the file-parser plugin (e.g. mistralai/mistral-ocr-latest).",
    usageHint:
      'Install this agent, reload agents (Command Palette > "Paper Agents: Reload Agents"), then open the Chat. Select "PDF OCR Agent" and type the path to a PDF, e.g., "Please convert /pdfs/paper.pdf to Markdown and save it as /notes/paper.md".',
    icon: "📄",
    group: "AI Agents",
    tags: ["agent", "LLM", "OCR", "PDF", "Mistral", "requires API key"],
    fileType: "agent",
    fileName: "ocr-agent.md",
    content: `---
agent: true
id: ocr_agent
name: "PDF OCR Agent"
description: "Converts PDFs to Markdown using Mistral OCR via OpenRouter"
model: mistralai/mistral-ocr-latest
tools:
  - read_binary_file
  - split_and_read_pdf
  - write_file
  - file_parser
memory:
  type: conversation
  maxMessages: 20
temperature: 0.1
agenticLoop:
  enabled: true
  maxIterations: 10
  terminationCheck: tool
---

# PDF OCR Agent

## System Prompt
You are a specialized OCR agent. Your task is to convert PDF files into Markdown and save the results.

**Workflow (memory-efficient, recommended for mobile):**
1. For PDFs that may be large (>20 MB) on mobile, use the three-phase \`split_and_read_pdf\` + \`read_binary_file\` approach:
   a. Call \`split_and_read_pdf\` with only \`filePath\` (no \`chunkIndex\`) to get metadata: \`totalChunks\`, \`pagesPerChunk\`, etc.
   b. For each chunk, call \`split_and_read_pdf\` with \`chunkIndex=0, 1, …\` **and** \`saveTo="_chunks"\`.
      This writes the chunk PDF to the vault and returns a \`chunkPath\` – no large base64 blob is kept in memory.
   c. Call \`read_binary_file\` on the returned \`chunkPath\` to load that one chunk for OCR processing.
      Process the OCR result before requesting the next chunk. This keeps only one chunk in memory at a time.
   For smaller PDFs or desktop use, \`read_binary_file\` works directly without splitting.
2. The \`file_parser\` plugin automatically receives and processes each file part — wait for the OCR result to appear in the next turn.
3. If the PDF was split, process each chunk individually and combine the resulting Markdown parts.
4. Save the combined Markdown text using \`write_file\` at the specified output path. Do NOT repeat the full OCR text in your assistant reply — write it directly to the file and reference the file with a wikilink.
5. End the task with \`finish_task\` and provide the wikilink to the saved file (e.g. \`[[filename]]\`).

**Rules:**
- Preserve the structure of the PDF as much as possible in Markdown (headings, lists, tables)
- If no output path is specified, use the same path as the input file with the extension \`.md\`
- Only overwrite existing files if the user explicitly confirms
- Use \`ask_user\` if the path is unclear or a file already exists
- When processing split PDF chunks, combine all Markdown results in page order before saving
- Always pass \`saveTo="_chunks"\` when splitting on mobile to avoid out-of-memory crashes
- After calling \`write_file\`, reference the result with \`[[filename]]\` only — do not output the full OCR text in your reply

## Context
Date: {{current_date}}
Time: {{current_time}}`,
  },
  {
    id: "canvas-system-prompt",
    title: "Canvas System Prompt",
    description: "Custom system prompt for Agent Canvas sessions",
    longDescription:
      "Define a custom system prompt for Agent Canvas sessions. Save this file to your canvas Markdown folder and configure the path in Settings → Agent Canvas → Canvas system prompt file. The body text of this file replaces the built-in canvas instructions, so you can tailor the agent's behavior precisely for your document-review workflows.",
    usageHint:
      'Install this file to your canvas folder (default: paper-agents-canvas/), then go to Settings → Agent Canvas → "Canvas system prompt file" and enter the file path. Open the Agent Canvas modal to use your custom prompt automatically.',
    icon: "🖊️",
    group: "Agent Canvas",
    tags: ["canvas", "system-prompt", "customization"],
    fileType: "agent",
    fileName: "canvas-system-prompt.md",
    content: `---
canvas-system-prompt: true
---

You are a critical but constructive document reviewer. Your goal is to help the author improve clarity, structure, and depth.

**Review guidelines:**
- Focus on high-impact improvements first
- Quote the exact passage you are commenting on
- Suggest concrete rewrites where appropriate
- Keep each annotation concise (3–5 sentences)
- Use \`@after-paragraph-N:\` to place your annotation directly below the relevant paragraph

**What to look for:**
1. Unclear or ambiguous sentences
2. Missing context or unexplained assumptions
3. Logical gaps or unsupported claims
4. Repetition that could be condensed
5. Opportunities to strengthen the conclusion

When you have finished reviewing, summarize the top 3 improvements the author should prioritize.`,
  },
];

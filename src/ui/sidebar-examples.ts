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
    content: `---
tool: true
id: search_vault_example
name: "Search Vault"
type: single
parameters:
  - name: query
    type: string
    description: "What to search for"
    required: true
  - name: path
    type: string
    description: "Folder to search in (default: entire vault)"
    required: false
    default: "/"
description: "Search for files in your vault by name or content"
---

This tool uses the built-in \`search_files\` tool.

#### **Tool-Ausführung**
\`\`\`yaml
tool: "search_files"
parameters:
  query: "{{query}}"
  path: "{{path}}"
\`\`\``,
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
    content: `---
tool: true
id: create_daily_note
name: "Create Daily Note"
type: single
parameters:
  - name: tags
    type: string
    description: "Comma-separated tags for the note"
    required: false
    default: ""
  - name: mood
    type: string
    description: "Today's mood"
    required: false
    default: "neutral"
description: "Creates a daily note with a structured template"
---

#### **Pre-Processing**
\`\`\`javascript
// @preprocess
const today = new Date().toISOString().split('T')[0];
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
\`\`\`

#### **Tool-Ausführung**
\`\`\`yaml
tool: "write_file"
parameters:
  filePath: "{{filePath}}"
  content: "{{content}}"
  overwrite: false
\`\`\`

#### **Post-Processing**
\`\`\`javascript
// @postprocess
return {
  message: "Daily note created successfully",
  path: output.filePath || "unknown",
  log: []
};
\`\`\``,
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
    content: `---
tool: true
id: search_and_count
name: "Search & Count Results"
type: chain
parameters:
  - name: query
    type: string
    description: "Search query"
    required: true
  - name: folder
    type: string
    description: "Folder to search in"
    required: false
    default: "/"
description: "Searches for files and provides statistics"
---

#### **Steps**
\`\`\`yaml
steps:
  - name: "search"
    tool: "search_files"
    parameters:
      query: "{{query}}"
      path: "{{folder}}"
\`\`\`

#### **Post-Processing**
\`\`\`javascript
// @postprocess
const results = output.results || [];
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
\`\`\``,
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
    content: `---
tool: true
id: conditional_read
name: "Conditional Search & Read"
type: chain
parameters:
  - name: query
    type: string
    description: "What to search for"
    required: true
description: "Searches for files, reads the first result if found"
continueOnError: true
---

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

#### **Post-Processing**
\`\`\`javascript
// @postprocess
const searchResults = output.search?.results || [];
const fileContent = output.read_first?.content;

return {
  found: searchResults.length,
  firstFile: searchResults[0]?.path || "none",
  contentPreview: fileContent
    ? fileContent.substring(0, 200) + "..."
    : "No file read",
  log: []
};
\`\`\``,
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
    content: `---
agent: true
id: research_assistant
name: "Research Assistant"
description: "Searches and summarizes information from your vault"
model: openai/gpt-4o-mini
tools:
  - search_files
  - read_file
memory:
  type: conversation
  maxMessages: 30
temperature: 0.7
---

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
    content: `---
agent: true
id: writing_helper
name: "Writing Helper"
description: "Helps improve, edit, and structure your texts"
model: openai/gpt-4o
tools:
  - read_file
  - write_file
memory:
  type: conversation
  maxMessages: 20
temperature: 0.8
---

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
    content: `---
agent: true
id: api_helper
name: "API Helper"
description: "Makes HTTP requests and processes API responses"
model: openai/gpt-4o-mini
tools:
  - rest_request
  - write_file
memory:
  type: conversation
  maxMessages: 25
temperature: 0.5
---

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
];

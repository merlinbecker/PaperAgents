/**
 * ConversationManager - Verwaltet Konversationen mit LLM-Agenten
 * 
 * Funktionen:
 * - Konversations-State-Management
 * - Message-History-Verwaltung
 * - Token-Counting (approximativ)
 * - Memory-Management (Truncation, Summary-Placeholder)
 */

import type {
  AgentDefinition,
  Conversation,
  Message,
  MessageRole,
  MemoryConfig,
  ConversationContext,
  ToolCallInfo,
} from "../types";

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_MAX_TOKENS = 4000;

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();

  createConversation(agentId: string, id?: string): Conversation {
    const conversationId = id || this.generateId();
    const now = Date.now();

    const conversation: Conversation = {
      id: conversationId,
      agentId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  listConversations(agentId?: string): Conversation[] {
    const all = Array.from(this.conversations.values());
    if (agentId) {
      return all.filter((c) => c.agentId === agentId);
    }
    return all;
  }

  addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    toolCall?: ToolCallInfo
  ): Message | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    const message: Message = {
      role,
      content,
      timestamp: Date.now(),
      toolCall,
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    return message;
  }

  getMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? [...conversation.messages] : [];
  }

  clearMessages(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return false;
    }
    conversation.messages = [];
    conversation.updatedAt = Date.now();
    return true;
  }

  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  estimateConversationTokens(conversationId: string): number {
    const messages = this.getMessages(conversationId);
    return messages.reduce((total, msg) => {
      return total + this.estimateTokens(msg.content);
    }, 0);
  }

  getMessagesForContext(
    conversationId: string,
    memoryConfig: MemoryConfig,
    systemPrompt?: string
  ): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    if (memoryConfig.type === "none") {
      return [];
    }

    const maxMessages = memoryConfig.maxMessages || DEFAULT_MAX_MESSAGES;
    const maxTokens = memoryConfig.maxTokens || DEFAULT_MAX_TOKENS;

    let messages = [...conversation.messages];
    
    if (messages.length > maxMessages) {
      messages = messages.slice(-maxMessages);
    }

    const systemTokens = systemPrompt ? this.estimateTokens(systemPrompt) : 0;
    let availableTokens = maxTokens - systemTokens;

    const result: Message[] = [];
    for (let i = messages.length - 1; i >= 0 && availableTokens > 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const msgTokens = this.estimateTokens(msg.content);
      
      if (msgTokens <= availableTokens) {
        result.unshift(msg);
        availableTokens -= msgTokens;
      } else {
        break;
      }
    }

    return result;
  }

  shouldTruncate(conversationId: string, memoryConfig: MemoryConfig): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || memoryConfig.type === "none") {
      return false;
    }

    const maxMessages = memoryConfig.maxMessages || DEFAULT_MAX_MESSAGES;
    return conversation.messages.length > maxMessages;
  }

  shouldSummarize(conversationId: string, memoryConfig: MemoryConfig): boolean {
    if (memoryConfig.type !== "summary" || !memoryConfig.summarizeAfter) {
      return false;
    }

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return false;
    }

    return conversation.messages.length >= memoryConfig.summarizeAfter;
  }

  buildContext(
    agent: AgentDefinition,
    conversationId: string
  ): ConversationContext | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    const now = new Date();

    return {
      agent,
      conversation,
      currentDate: now.toISOString().split("T")[0] || "",
      currentTime: now.toTimeString().split(" ")[0] || "",
    };
  }

  formatMessagesForLLM(
    messages: Message[],
    systemPrompt: string
  ): { role: string; content: string }[] {
    const formatted: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === "tool" && msg.toolCall) {
        formatted.push({
          role: "assistant",
          content: `[Tool Call: ${msg.toolCall.toolId}]\nResult: ${JSON.stringify(msg.toolCall.result || msg.toolCall.error)}`,
        });
      } else {
        formatted.push({
          role: msg.role === "tool" ? "assistant" : msg.role,
          content: msg.content,
        });
      }
    }

    return formatted;
  }

  toMarkdown(conversationId: string): string {
    const messages = this.getMessages(conversationId);
    const lines: string[] = [];

    for (const msg of messages) {
      const timestamp = msg.timestamp
        ? new Date(msg.timestamp).toISOString()
        : "";

      switch (msg.role) {
        case "user":
          lines.push(`### User ${timestamp ? `(${timestamp})` : ""}`);
          lines.push(msg.content);
          lines.push("");
          break;
        case "assistant":
          lines.push(`### Assistant ${timestamp ? `(${timestamp})` : ""}`);
          lines.push(msg.content);
          lines.push("");
          break;
        case "system":
          lines.push(`### System ${timestamp ? `(${timestamp})` : ""}`);
          lines.push(msg.content);
          lines.push("");
          break;
        case "tool":
          lines.push(`### Tool ${timestamp ? `(${timestamp})` : ""}`);
          if (msg.toolCall) {
            lines.push(`<!-- tool:${msg.toolCall.toolId} -->`);
            lines.push(`<!-- params:${JSON.stringify(msg.toolCall.parameters)} -->`);
            if (msg.toolCall.result !== undefined) {
              lines.push(`Result: ${JSON.stringify(msg.toolCall.result)}`);
            }
            if (msg.toolCall.error) {
              lines.push(`Error: ${msg.toolCall.error}`);
            }
          }
          lines.push("");
          break;
      }
    }

    return lines.join("\n");
  }

  parseMarkdown(markdown: string): Message[] {
    const messages: Message[] = [];
    const blocks = markdown.split(/^### /gm).filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.split("\n");
      const headerLine = lines[0] || "";
      const contentLines = lines.slice(1);
      const content = contentLines.filter(l => !l.startsWith("<!-- ")).join("\n").trim();

      const role = headerLine.toLowerCase().split(/[\s(]/)[0] || "";
      const timestamp = this.parseTimestamp(headerLine);

      if (role === "user") {
        messages.push({ role: "user", content, timestamp });
      } else if (role === "assistant") {
        messages.push({ role: "assistant", content, timestamp });
      } else if (role === "system") {
        messages.push({ role: "system", content, timestamp });
      } else if (role === "tool") {
        const toolMatch = contentLines.find(l => l.startsWith("<!-- tool:"));
        const paramsMatch = contentLines.find(l => l.startsWith("<!-- params:"));
        
        let toolCall: ToolCallInfo | undefined;
        if (toolMatch) {
          const toolId = toolMatch.replace("<!-- tool:", "").replace(" -->", "");
          let parameters: Record<string, any> = {};
          if (paramsMatch) {
            try {
              parameters = JSON.parse(paramsMatch.replace("<!-- params:", "").replace(" -->", ""));
            } catch {
              parameters = {};
            }
          }
          
          const resultLine = contentLines.find(l => l.startsWith("Result: "));
          const errorLine = contentLines.find(l => l.startsWith("Error: "));
          
          toolCall = {
            toolId,
            parameters,
            result: resultLine ? JSON.parse(resultLine.replace("Result: ", "")) : undefined,
            error: errorLine ? errorLine.replace("Error: ", "") : undefined,
          };
        }
        
        messages.push({ role: "tool", content, timestamp, toolCall });
      }
    }

    return messages;
  }

  private parseTimestamp(headerLine: string): number | undefined {
    const match = headerLine.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    return undefined;
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportConversation(conversationId: string): string | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }
    return JSON.stringify(conversation, null, 2);
  }

  importConversation(json: string): Conversation | null {
    try {
      const conversation = JSON.parse(json) as Conversation;
      if (!conversation.id || !conversation.agentId || !conversation.messages) {
        return null;
      }
      this.conversations.set(conversation.id, conversation);
      return conversation;
    } catch {
      return null;
    }
  }
}

export const conversationManager = new ConversationManager();

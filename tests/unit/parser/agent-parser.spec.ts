/**
 * Tests für AgentParser
 */

import { describe, it, expect } from "vitest";
import { AgentParser, AgentParseError } from "../../../src/parser/agent-parser";

describe("AgentParser", () => {
  describe("parseAgentFile", () => {
    it("should parse a valid agent file", () => {
      const content = `---
agent: true
id: test_agent
name: "Test Agent"
description: "A test agent"
model: openai/gpt-4o
tools:
  - search_files
  - read_file
memory:
  type: conversation
  maxMessages: 20
temperature: 0.7
---

## System Prompt
Du bist ein hilfreicher Assistent.

## Kontext
Datum: {{current_date}}
`;

      const parsed = AgentParser.parseAgentFile(content);

      expect(parsed.frontmatter.agent).toBe(true);
      expect(parsed.frontmatter.id).toBe("test_agent");
      expect(parsed.frontmatter.name).toBe("Test Agent");
      expect(parsed.frontmatter.description).toBe("A test agent");
      expect(parsed.frontmatter.model).toBe("openai/gpt-4o");
      expect(parsed.frontmatter.tools).toEqual(["search_files", "read_file"]);
      expect(parsed.frontmatter.memory).toEqual({ type: "conversation", maxMessages: 20 });
      expect(parsed.frontmatter.temperature).toBe(0.7);
      expect(parsed.systemPrompt).toBe("Du bist ein hilfreicher Assistent.");
      expect(parsed.contextTemplate).toBe("Datum: {{current_date}}");
    });

    it("should throw error for missing frontmatter", () => {
      const content = `# No frontmatter here`;
      
      expect(() => AgentParser.parseAgentFile(content)).toThrow(AgentParseError);
    });

    it("should throw error for non-agent file", () => {
      const content = `---
tool: true
id: not_an_agent
---`;
      
      expect(() => AgentParser.parseAgentFile(content)).toThrow("File is not an agent definition");
    });

    it("should parse agent with minimal frontmatter", () => {
      const content = `---
agent: true
id: minimal
name: "Minimal Agent"
---

## System Prompt
Einfacher Prompt.
`;

      const parsed = AgentParser.parseAgentFile(content);
      expect(parsed.frontmatter.id).toBe("minimal");
      expect(parsed.frontmatter.name).toBe("Minimal Agent");
      expect(parsed.systemPrompt).toBe("Einfacher Prompt.");
    });

    it("should handle English context section", () => {
      const content = `---
agent: true
id: english_agent
name: "English Agent"
---

## System Prompt
You are a helpful assistant.

## Context
Date: {{current_date}}
`;

      const parsed = AgentParser.parseAgentFile(content);
      expect(parsed.contextTemplate).toBe("Date: {{current_date}}");
    });
  });

  describe("toAgentDefinition", () => {
    it("should convert parsed file to AgentDefinition", () => {
      const content = `---
agent: true
id: converter_test
name: "Converter Test"
tools:
  - write_file
memory:
  type: summary
  maxMessages: 10
---

## System Prompt
Test prompt for conversion.
`;

      const parsed = AgentParser.parseAgentFile(content);
      const agent = AgentParser.toAgentDefinition(parsed);

      expect(agent.id).toBe("converter_test");
      expect(agent.name).toBe("Converter Test");
      expect(agent.tools).toEqual(["write_file"]);
      expect(agent.memory.type).toBe("summary");
      expect(agent.memory.maxMessages).toBe(10);
      expect(agent.systemPrompt).toBe("Test prompt for conversion.");
      expect(agent.model).toBe("openai/gpt-4o-mini");
    });

    it("should throw error for missing id", () => {
      const content = `---
agent: true
name: "No ID"
---

## System Prompt
Test.
`;

      const parsed = AgentParser.parseAgentFile(content);
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing required field: id");
    });

    it("should throw error for missing name", () => {
      const content = `---
agent: true
id: no_name
---

## System Prompt
Test.
`;

      const parsed = AgentParser.parseAgentFile(content);
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing required field: name");
    });

    it("should throw error for missing system prompt", () => {
      const content = `---
agent: true
id: no_prompt
name: "No Prompt"
---

## Kontext
Nur Kontext, kein System Prompt.
`;

      const parsed = AgentParser.parseAgentFile(content);
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing System Prompt section");
    });

    it("should use default memory config when not specified", () => {
      const content = `---
agent: true
id: default_memory
name: "Default Memory"
---

## System Prompt
Test.
`;

      const parsed = AgentParser.parseAgentFile(content);
      const agent = AgentParser.toAgentDefinition(parsed);

      expect(agent.memory.type).toBe("conversation");
      expect(agent.memory.maxMessages).toBe(50);
    });

    it("should handle memory with snake_case keys", () => {
      const content = `---
agent: true
id: snake_case
name: "Snake Case Memory"
memory:
  type: conversation
  max_messages: 15
---

## System Prompt
Test.
`;

      const parsed = AgentParser.parseAgentFile(content);
      const agent = AgentParser.toAgentDefinition(parsed);

      expect(agent.memory.maxMessages).toBe(15);
    });
  });

  describe("parse", () => {
    it("should parse content directly to AgentDefinition", () => {
      const content = `---
agent: true
id: direct_parse
name: "Direct Parse"
tools:
  - search_files
---

## System Prompt
Direct parsing test.
`;

      const agent = AgentParser.parse(content);

      expect(agent.id).toBe("direct_parse");
      expect(agent.name).toBe("Direct Parse");
      expect(agent.tools).toEqual(["search_files"]);
      expect(agent.systemPrompt).toBe("Direct parsing test.");
    });
  });

  describe("isAgentFile", () => {
    it("should return true for agent files", () => {
      const content = `---
agent: true
id: test
name: "Test"
---`;

      expect(AgentParser.isAgentFile(content)).toBe(true);
    });

    it("should return false for tool files", () => {
      const content = `---
tool: true
id: test
name: "Test"
---`;

      expect(AgentParser.isAgentFile(content)).toBe(false);
    });

    it("should return false for files without frontmatter", () => {
      const content = `# Just markdown`;

      expect(AgentParser.isAgentFile(content)).toBe(false);
    });
  });

  describe("validateAgentDefinition", () => {
    it("should validate a correct agent definition", () => {
      const content = `---
agent: true
id: valid_agent
name: "Valid Agent"
tools:
  - read_file
---

## System Prompt
Valid prompt.
`;

      const agent = AgentParser.parse(content);
      const result = AgentParser.validateAgentDefinition(agent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid temperature", () => {
      const content = `---
agent: true
id: invalid_temp
name: "Invalid Temp"
temperature: 3.0
---

## System Prompt
Test.
`;

      const agent = AgentParser.parse(content);
      const result = AgentParser.validateAgentDefinition(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Temperature must be between 0 and 2");
    });

    it("should detect invalid maxTokens", () => {
      const content = `---
agent: true
id: invalid_tokens
name: "Invalid Tokens"
maxTokens: 0
---

## System Prompt
Test.
`;

      const agent = AgentParser.parse(content);
      const result = AgentParser.validateAgentDefinition(agent);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Max tokens must be at least 1");
    });
  });

  describe("memory types", () => {
    it("should handle 'none' memory type", () => {
      const content = `---
agent: true
id: no_memory
name: "No Memory"
memory:
  type: none
---

## System Prompt
Stateless agent.

`;

      const agent = AgentParser.parse(content);
      expect(agent.memory.type).toBe("none");
    });

    it("should handle 'summary' memory type", () => {
      const content = `---
agent: true
id: summary_memory
name: "Summary Memory"
memory:
  type: summary
  summarizeAfter: 10
---

## System Prompt
Summarizing agent.

`;

      const agent = AgentParser.parse(content);
      expect(agent.memory.type).toBe("summary");
    });
  });
});

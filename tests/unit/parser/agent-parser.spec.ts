/**
 * Tests für AgentParser
 */

import { describe, it, expect } from "vitest";
import { AgentParser, AgentParseError } from "../../../src/parser/agent-parser";

/** Builds a minimal valid agent file string. */
const makeContent = (frontmatterLines: string, systemPrompt = "Test.") =>
  `---\nagent: true\n${frontmatterLines}\n---\n\n## System Prompt\n${systemPrompt}\n`;

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
      expect(() => AgentParser.parseAgentFile("# No frontmatter here")).toThrow(AgentParseError);
    });

    it("should throw error for non-agent file", () => {
      expect(() => AgentParser.parseAgentFile("---\ntool: true\nid: not_an_agent\n---")).toThrow(
        "File is not an agent definition"
      );
    });

    it("should parse agent with minimal frontmatter", () => {
      const parsed = AgentParser.parseAgentFile(makeContent('id: minimal\nname: "Minimal Agent"', "Einfacher Prompt."));
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
      const content = makeContent(
        'id: converter_test\nname: "Converter Test"\ntools:\n  - write_file\nmemory:\n  type: summary\n  maxMessages: 10',
        "Test prompt for conversion."
      );
      const agent = AgentParser.parse(content);

      expect(agent.id).toBe("converter_test");
      expect(agent.name).toBe("Converter Test");
      expect(agent.tools).toEqual(["write_file"]);
      expect(agent.memory.type).toBe("summary");
      expect(agent.memory.maxMessages).toBe(10);
      expect(agent.systemPrompt).toBe("Test prompt for conversion.");
      expect(agent.model).toBeUndefined();
    });

    it("should use model from frontmatter when specified", () => {
      const agent = AgentParser.parse(
        makeContent('id: model_test\nname: "Model Test"\nmodel: anthropic/claude-3-opus')
      );
      expect(agent.model).toBe("anthropic/claude-3-opus");
    });

    it("should throw error for missing id", () => {
      const parsed = AgentParser.parseAgentFile(makeContent('name: "No ID"'));
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing required field: id");
    });

    it("should throw error for missing name", () => {
      const parsed = AgentParser.parseAgentFile(makeContent("id: no_name"));
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing required field: name");
    });

    it("should throw error for missing system prompt", () => {
      const content = "---\nagent: true\nid: no_prompt\nname: \"No Prompt\"\n---\n\n## Kontext\nNur Kontext, kein System Prompt.\n";
      const parsed = AgentParser.parseAgentFile(content);
      expect(() => AgentParser.toAgentDefinition(parsed)).toThrow("Missing System Prompt section");
    });

    it("should use default memory config when not specified", () => {
      const agent = AgentParser.parse(makeContent('id: default_memory\nname: "Default Memory"'));
      expect(agent.memory.type).toBe("conversation");
      expect(agent.memory.maxMessages).toBe(50);
    });

    it("should handle memory with snake_case keys", () => {
      const agent = AgentParser.parse(
        makeContent('id: snake_case\nname: "Snake Case Memory"\nmemory:\n  type: conversation\n  max_messages: 15')
      );
      expect(agent.memory.maxMessages).toBe(15);
    });
  });

  describe("parse", () => {
    it("should parse content directly to AgentDefinition", () => {
      const agent = AgentParser.parse(
        makeContent('id: direct_parse\nname: "Direct Parse"\ntools:\n  - search_files', "Direct parsing test.")
      );
      expect(agent.id).toBe("direct_parse");
      expect(agent.name).toBe("Direct Parse");
      expect(agent.tools).toEqual(["search_files"]);
      expect(agent.systemPrompt).toBe("Direct parsing test.");
    });
  });

  describe("isAgentFile", () => {
    it("should return true for agent files", () => {
      expect(AgentParser.isAgentFile("---\nagent: true\nid: test\nname: \"Test\"\n---")).toBe(true);
    });

    it("should return false for tool files", () => {
      expect(AgentParser.isAgentFile("---\ntool: true\nid: test\nname: \"Test\"\n---")).toBe(false);
    });

    it("should return false for files without frontmatter", () => {
      expect(AgentParser.isAgentFile("# Just markdown")).toBe(false);
    });
  });

  describe("validateAgentDefinition", () => {
    it("should validate a correct agent definition", () => {
      const result = AgentParser.validateAgentDefinition(
        AgentParser.parse(makeContent('id: valid_agent\nname: "Valid Agent"\ntools:\n  - read_file', "Valid prompt."))
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid temperature", () => {
      const result = AgentParser.validateAgentDefinition(
        AgentParser.parse(makeContent('id: invalid_temp\nname: "Invalid Temp"\ntemperature: 3.0'))
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Temperature must be between 0 and 2");
    });

    it("should detect invalid maxTokens", () => {
      const result = AgentParser.validateAgentDefinition(
        AgentParser.parse(makeContent('id: invalid_tokens\nname: "Invalid Tokens"\nmaxTokens: 0'))
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Max tokens must be at least 1");
    });
  });

  describe("memory types", () => {
    it("should handle 'none' memory type", () => {
      const agent = AgentParser.parse(makeContent('id: no_memory\nname: "No Memory"\nmemory:\n  type: none', "Stateless agent."));
      expect(agent.memory.type).toBe("none");
    });

    it("should handle 'summary' memory type", () => {
      const agent = AgentParser.parse(
        makeContent('id: summary_memory\nname: "Summary Memory"\nmemory:\n  type: summary\n  summarizeAfter: 10', "Summarizing agent.")
      );
      expect(agent.memory.type).toBe("summary");
    });
  });
});

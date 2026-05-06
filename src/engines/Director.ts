// Real Claude Agent SDK integration. Wraps query() with an MCP server that
// exposes Vulcan-specific manual lookup tools so Claude can pull additional
// facts during the agent loop. The route still pre-fetches the planner-
// curated context inline (so default answer quality is preserved); these
// tools are available when Claude needs to refine.
import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { findManualImageById } from "@/data/VisualRegistry";
import { retrieveManualContext, type WeldProcess } from "@/data/ProductGrounding";
import { getTroubleshootingItems, getVisualKnowledgeForIntent } from "@/data/SchemaGrounding";
import type { PlannerIntent, PlannerSlots } from "@/engines/IntentRouter";

const PLANNER_INTENTS: PlannerIntent[] = [
  "setup",
  "polarity",
  "duty_cycle",
  "process_selection",
  "settings_recommendation",
  "troubleshooting",
  "weld_image_diagnosis",
  "manual_image_question",
  "wire_loading",
  "front_panel_controls",
  "explanation",
  "general"
];

const WELD_PROCESSES: WeldProcess[] = ["mig", "flux-core", "tig", "stick", "unknown"];

const manualLookupTool = tool(
  "lookup_vulcan_manual_context",
  "Retrieve curated Vulcan OmniPro 220 manual snippets for a question (polarity, duty cycle, troubleshooting, wire feed, settings). Returns snippets and references with page numbers. Use when you need additional manual facts beyond what's already in the prompt.",
  { question: z.string().describe("The user's specific welder question") },
  async ({ question }) => {
    const ctx = retrieveManualContext(question);
    return { content: [{ type: "text", text: JSON.stringify(ctx) }] };
  }
);

const visualKnowledgeTool = tool(
  "lookup_vulcan_visual_knowledge",
  "Retrieve indexed visual/diagram knowledge for a routed intent (process selection grid, weld defect catalog, wiring tables). Optionally include indexed manual image facts for a specific image id. Use when you need diagram-derived facts that aren't in the prompt.",
  {
    intent: z.string().describe("Planner intent: setup | polarity | duty_cycle | process_selection | settings_recommendation | troubleshooting | weld_image_diagnosis | manual_image_question | wire_loading | front_panel_controls"),
    process: z.string().optional().describe("Optional process: mig | flux-core | tig | stick | unknown"),
    manual_image_id: z.string().optional().describe("Optional: a specific manual image id to fetch extracted facts for")
  },
  async ({ intent, process, manual_image_id }) => {
    const safeIntent: PlannerIntent = PLANNER_INTENTS.includes(intent as PlannerIntent)
      ? (intent as PlannerIntent)
      : "setup";
    const safeProcess: WeldProcess = WELD_PROCESSES.includes(process as WeldProcess)
      ? (process as WeldProcess)
      : "unknown";
    const slots: PlannerSlots = { process: safeProcess };
    const intentText = getVisualKnowledgeForIntent(safeIntent, slots);
    const lines: string[] = [];
    if (intentText.trim()) lines.push(intentText.trim());
    if (safeIntent === "troubleshooting") {
      const items = getTroubleshootingItems("", safeProcess);
      if (items.length) {
        lines.push("");
        lines.push("Troubleshooting items (cause | check | fix):");
        items.forEach((it) => lines.push(`- ${it.cause} | ${it.check} | ${it.fix}`));
      }
    }
    if (manual_image_id) {
      const img = findManualImageById(manual_image_id);
      if (img) {
        lines.push("");
        lines.push(`Manual image (${img.title}, ${img.source} p.${img.page}):`);
        img.extractedFacts.forEach((fact) => lines.push(`- ${fact}`));
      }
    }
    const text = lines.join("\n") || "No additional visual knowledge for this intent.";
    return { content: [{ type: "text", text }] };
  }
);

const vulcanMcpServer = createSdkMcpServer({
  name: "vulcan",
  version: "1.0.0",
  tools: [manualLookupTool, visualKnowledgeTool]
});

// MCP-prefixed tool names that Claude sees during the agent loop.
export const vulcanAgentToolNames = [
  `mcp__vulcan__${manualLookupTool.name}`,
  `mcp__vulcan__${visualKnowledgeTool.name}`
];

export type VulcanAgentResult = {
  text: string;
  numTurns: number;
  durationMs: number;
  toolCalls: number;
};

// Vercel and other serverless environments have a read-only filesystem
// except for /tmp. The Claude Agent SDK defaults to ~/.claude for config
// and debug logs, which fails with EROFS on Vercel. Pointing both to /tmp
// keeps the SDK happy without changing any agent behaviour.
if (!process.env.CLAUDE_CONFIG_DIR) {
  process.env.CLAUDE_CONFIG_DIR = "/tmp/.claude";
}
if (!process.env.CLAUDE_CODE_DEBUG_LOGS_DIR) {
  process.env.CLAUDE_CODE_DEBUG_LOGS_DIR = "/tmp/.claude/debug";
}
if (!process.env.HOME) {
  process.env.HOME = "/tmp";
}

export async function runVulcanAgent(params: {
  prompt: string;
  systemPrompt: string;
  model?: string;
  maxTurns?: number;
  // When provided, the agent emits each text fragment Claude generates so the
  // caller can stream output to the client in real time. The `text` field on
  // the resolved result still contains the full final response.
  onTextDelta?: (delta: string) => void;
}): Promise<VulcanAgentResult> {
  const it = query({
    prompt: params.prompt,
    options: {
      model: params.model,
      systemPrompt: params.systemPrompt,
      mcpServers: { vulcan: vulcanMcpServer },
      // Disable Claude Code's built-in coding tools (Bash, Read, Edit, etc.).
      // This agent must only use our manual lookup tools.
      tools: [],
      allowedTools: vulcanAgentToolNames,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      // SDK isolation mode: don't load user/project settings or CLAUDE.md.
      settingSources: [],
      persistSession: false,
      maxTurns: params.maxTurns ?? 6,
      includePartialMessages: Boolean(params.onTextDelta)
    }
  });

  let finalText = "";
  let numTurns = 0;
  let durationMs = 0;
  let toolCalls = 0;
  for await (const msg of it) {
    if (msg.type === "stream_event" && params.onTextDelta) {
      const event = msg.event as { type?: string; delta?: { type?: string; text?: string } };
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && typeof event.delta.text === "string") {
        params.onTextDelta(event.delta.text);
      }
    } else if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "tool_use") toolCalls += 1;
      }
    } else if (msg.type === "result") {
      if (msg.subtype === "success") {
        finalText = msg.result;
        numTurns = msg.num_turns;
        durationMs = msg.duration_ms;
      } else {
        throw new Error(`Agent SDK error: ${msg.subtype}`);
      }
    }
  }
  if (!finalText) throw new Error("Agent SDK returned no final result text");
  return { text: finalText, numTurns, durationMs, toolCalls };
}

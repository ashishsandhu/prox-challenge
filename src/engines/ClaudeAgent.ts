import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { retrieveManualContext } from "@/data/ProductGrounding";

export const manualLookupTool = tool(
  "lookup_vulcan_manual_context",
  "Retrieve curated Vulcan OmniPro 220 manual context for setup, polarity, duty cycle, troubleshooting, and wire-feed questions.",
  {
    question: z.string().describe("The user's welder question")
  },
  async ({ question }) => {
    const context = retrieveManualContext(question);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(context)
        }
      ]
    };
  }
);

export const agentToolNames = [manualLookupTool.name];

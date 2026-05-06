"use client";

import { FileText } from "lucide-react";
import { dedupeRefs, type ManualRef } from "@/data/ProductGrounding";

export function GroundingNodes({ refs }: { refs: ManualRef[] }) {
  if (!refs.length) return null;
  const uniqueRefs = dedupeRefs(refs);

  const handleClick = (ref: ManualRef) => {
    // Dispatch a custom event to trigger a chat query
    const event = new CustomEvent("explain-manual-ref", {
      detail: { ref }
    });
    window.dispatchEvent(event);
  };

  return null;
}

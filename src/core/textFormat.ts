// Strip inline markdown markers (**bold**, *em*, __bold__, _em_, `code`) from
// short LLM-generated status strings that are rendered as plain text in pills,
// captions, and inline cautions. Keeps the inner text intact so the meaning
// is preserved without the literal asterisks/underscores leaking into the UI.
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_(?!\s)([^_\n]+?)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]+?)`/g, "$1");
}

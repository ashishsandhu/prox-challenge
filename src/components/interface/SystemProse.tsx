import ReactMarkdown from "react-markdown";

export function SystemProse({ content }: { content: string }) {
    return (
        <div className="space-y-2 text-sm leading-6">
            <ReactMarkdown
                components={{
                    p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
                    ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
                    li: ({ children }) => <li>{children}</li>,
                    code: ({ children }) => <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-text-primary">{children}</code>,
                    a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-acid hover:underline">
                            {children}
                        </a>
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

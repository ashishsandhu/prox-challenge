import { stripInlineMarkdown } from "@/core/textFormat";

type CalloutDirection = "top" | "bottom" | "left" | "right";

type VisualCalloutProps = {
    text: string;
    position: {
        x: number;
        y: number;
    };
    direction: CalloutDirection;
    delayMs?: number;
    targetPosition?: { x: number; y: number };
};

export function VisualCallout({ text, position, direction, delayMs = 0, targetPosition }: VisualCalloutProps) {
    const bubbleTransform = getBubbleTransform(direction);
    const arrowStyles = getArrowStyles(direction);

    return (
        <div
            className="pointer-events-none absolute z-20"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`
            }}
        >
            {targetPosition && (
                <svg
                    className="absolute pointer-events-none"
                    style={{
                        left: 0,
                        top: 0,
                        overflow: "visible",
                        width: "100%",
                        height: "100%"
                    }}
                    aria-hidden
                >
                    <line
                        x1="0%"
                        y1="0%"
                        x2={`${(targetPosition.x - position.x) * 100}%`}
                        y2={`${(targetPosition.y - position.y) * 100}%`}
                        stroke="rgba(183, 245, 74, 0.35)"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            )}
            <div className="relative" style={{ transform: bubbleTransform }}>
                <div
                    className="relative max-w-[160px] rounded-xl border border-torch/70 bg-white backdrop-blur-sm [animation:callout-in_220ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{
                        animationDelay: `${delayMs}ms`,
                        backgroundColor: "rgba(255, 255, 255, 0.95)"
                    }}
                >
                    <div className="px-3 py-2 text-[11px] font-semibold leading-4 text-zinc-950">
                        <p
                            style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden"
                            }}
                        >
                            {stripInlineMarkdown(text)}
                        </p>
                    </div>
                    <ArrowPointer direction={direction} arrowStyles={arrowStyles} />
                </div>
            </div>
        </div>
    );
}

function ArrowPointer(
    { direction, arrowStyles }: { direction: CalloutDirection; arrowStyles: Record<string, any> }
) {
    return (
        <div
            className="absolute pointer-events-none"
            style={arrowStyles.container}
            aria-hidden
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={arrowStyles.svg}
            >
                <path
                    d={arrowStyles.path}
                    fill="rgba(183, 245, 74, 0.9)"
                    stroke="rgba(183, 245, 74, 0.9)"
                    strokeWidth="0.5"
                />
            </svg>
        </div>
    );
}

function getBubbleTransform(direction: CalloutDirection) {
    if (direction === "top") return "translate(-50%, calc(-100% - 16px))";
    if (direction === "bottom") return "translate(-50%, 16px)";
    if (direction === "left") return "translate(calc(-100% - 16px), -50%)";
    return "translate(16px, -50%)";
}

function getArrowStyles(direction: CalloutDirection) {
    if (direction === "top") {
        return {
            container: {
                left: "50%",
                bottom: "-8px",
                transform: "translateX(-50%)"
            },
            svg: { transform: "rotate(180deg)" },
            path: "M 8 0 L 16 14 L 0 14 Z"
        };
    }

    if (direction === "bottom") {
        return {
            container: {
                left: "50%",
                top: "-8px",
                transform: "translateX(-50%)"
            },
            svg: {},
            path: "M 8 14 L 16 0 L 0 0 Z"
        };
    }

    if (direction === "left") {
        return {
            container: {
                right: "-8px",
                top: "50%",
                transform: "translateY(-50%)"
            },
            svg: { transform: "rotate(-90deg)" },
            path: "M 8 0 L 16 14 L 0 14 Z"
        };
    }

    return {
        container: {
            left: "-8px",
            top: "50%",
            transform: "translateY(-50%)"
        },
        svg: { transform: "rotate(90deg)" },
        path: "M 8 0 L 16 14 L 0 14 Z"
    };
}

export type { CalloutDirection, VisualCalloutProps };

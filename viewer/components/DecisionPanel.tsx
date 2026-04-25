"use client";

interface Decision {
  conclusion: string;
  rejected: string[];
  confidence: "low" | "medium" | "high";
  revisitIf: string;
  decidedAt: string;
}

interface DecisionPanelProps {
  decision: Decision;
}

const CONFIDENCE_DOT: Record<Decision["confidence"], string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

const CONFIDENCE_LABEL: Record<Decision["confidence"], string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

export function DecisionPanel({ decision }: DecisionPanelProps) {
  return (
    <div
      id="decision"
      className="w-full border-b border-neutral-200 bg-neutral-50 px-6 py-3 flex items-start gap-4"
    >
      {/* Confidence dot */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        <span
          className={`w-2.5 h-2.5 rounded-full ${CONFIDENCE_DOT[decision.confidence]}`}
          title={CONFIDENCE_LABEL[decision.confidence]}
        />
        <span className="text-[10px] text-neutral-400 leading-none whitespace-nowrap">
          {decision.confidence}
        </span>
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900 leading-snug">
          {decision.conclusion}
        </p>

        {decision.rejected && decision.rejected.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="text-xs text-neutral-400 self-center">Rejected:</span>
            {decision.rejected.map((r) => (
              <span
                key={r}
                className="px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 text-xs border border-neutral-300"
              >
                {r}
              </span>
            ))}
          </div>
        )}

        {decision.revisitIf && (
          <p className="text-xs text-neutral-400 italic mt-1">
            Revisit if: {decision.revisitIf}
          </p>
        )}
      </div>

      {/* Date */}
      <span className="text-[11px] text-neutral-400 shrink-0 pt-0.5">
        {new Date(decision.decidedAt).toLocaleDateString()}
      </span>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { TokenInfo, WordGroup } from "@/lib/types";
import { formatPercent, getConfidenceStyle } from "@/lib/confidence";
import { groupTokensIntoWords, isWhitespaceGroup } from "@/lib/group-tokens";

interface WordVisualizerProps {
  tokens: TokenInfo[];
}

function renderGroupText(text: string): React.ReactNode {
  if (text.length === 0) return "\u200B";
  return text;
}

export default function WordVisualizer({ tokens }: WordVisualizerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const groups: WordGroup[] = useMemo(
    () => groupTokensIntoWords(tokens),
    [tokens],
  );

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nog geen output. Voer een prompt in en klik op Genereer.
      </p>
    );
  }

  return (
    <div
      className="leading-9 text-base whitespace-pre-wrap break-words"
      onMouseLeave={() => setActiveIndex(null)}
    >
      {groups.map((g, i) => {
        // Whitespace-groepen krijgen geen markering en geen tooltip —
        // ze fungeren puur als visuele ademruimte tussen woorden.
        if (isWhitespaceGroup(g)) {
          return <span key={i}>{renderGroupText(g.text)}</span>;
        }

        const style = getConfidenceStyle(g.probability);
        const isActive = activeIndex === i;
        return (
          <span
            key={i}
            className="relative inline cursor-help transition-colors"
            style={style}
            onMouseEnter={() => setActiveIndex(i)}
            onClick={() => setActiveIndex(isActive ? null : i)}
            tabIndex={0}
            onFocus={() => setActiveIndex(i)}
            onBlur={() => setActiveIndex(null)}
            aria-label={`Woordgroep ${g.text}, probability ${formatPercent(
              g.probability,
            )}`}
          >
            {renderGroupText(g.text)}
            {isActive && <WordGroupTooltip group={g} />}
          </span>
        );
      })}
    </div>
  );
}

function WordGroupTooltip({ group }: { group: WordGroup }) {
  return (
    <span
      role="tooltip"
      className="absolute left-0 top-full z-20 mt-1 w-80 -translate-x-0 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-800 shadow-lg"
      style={{ pointerEvents: "none" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold">Woordgroep</span>
        <code className="max-w-[60%] truncate rounded bg-slate-100 px-1.5 py-0.5">
          {JSON.stringify(group.text)}
        </code>
      </div>
      <div className="mb-1 flex justify-between">
        <span className="text-slate-500">Probability (laagste)</span>
        <span className="font-medium">{formatPercent(group.probability)}</span>
      </div>
      <div className="mb-1 flex justify-between">
        <span className="text-slate-500">Logprob (laagste)</span>
        <span className="font-mono">{group.logprob.toFixed(4)}</span>
      </div>
      <div className="mb-2 flex justify-between">
        <span className="text-slate-500">Tokens</span>
        <span className="font-medium">{group.tokens.length}</span>
      </div>

      <div className="mb-1 mt-2 font-semibold text-slate-700">
        Onderliggende tokens
      </div>
      <ul className="space-y-1">
        {group.tokens.map((t, i) => (
          <li
            key={i}
            className="rounded border border-slate-100 bg-slate-50 px-1.5 py-1"
          >
            <div className="flex items-center justify-between gap-2">
              <code className="max-w-[55%] truncate rounded bg-white px-1 py-0.5">
                {JSON.stringify(t.token)}
              </code>
              <span className="text-slate-600">
                {formatPercent(t.probability)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
              <span>logprob</span>
              <span className="font-mono">{t.logprob.toFixed(4)}</span>
            </div>
            {t.topAlternatives.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {t.topAlternatives.map((alt, j) => (
                  <li
                    key={j}
                    className="flex items-center justify-between gap-2 text-[10px] text-slate-600"
                  >
                    <code className="max-w-[55%] truncate rounded bg-white px-1 py-0.5">
                      {JSON.stringify(alt.token)}
                    </code>
                    <span>{formatPercent(alt.probability)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </span>
  );
}

"use client";

import { useState } from "react";
import type { TokenInfo } from "@/lib/types";
import { formatPercent, getConfidenceStyle } from "@/lib/confidence";

interface TokenVisualizerProps {
  tokens: TokenInfo[];
}

/**
 * Rendert een token tekstueel met behoud van spaties en newlines.
 * Voor zuivere whitespace-tokens tonen we de inhoud via white-space: pre,
 * zodat de oorspronkelijke layout van het modelantwoord bewaard blijft.
 */
function renderTokenText(token: string): React.ReactNode {
  if (token.length === 0) return "\u200B"; // zero-width space als anchor
  return token;
}

export default function TokenVisualizer({ tokens }: TokenVisualizerProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
      {tokens.map((t, i) => {
        const style = getConfidenceStyle(t.probability);
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
            aria-label={`Token ${t.token}, probability ${formatPercent(
              t.probability,
            )}`}
          >
            {renderTokenText(t.token)}
            {isActive && <TokenTooltip token={t} />}
          </span>
        );
      })}
    </div>
  );
}

function TokenTooltip({ token }: { token: TokenInfo }) {
  return (
    <span
      role="tooltip"
      className="absolute left-0 top-full z-20 mt-1 w-72 -translate-x-0 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-800 shadow-lg"
      // stoppen van pointer-events op het tooltipje voorkomt flicker
      style={{ pointerEvents: "none" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold">Token</span>
        <code className="rounded bg-slate-100 px-1.5 py-0.5">
          {JSON.stringify(token.token)}
        </code>
      </div>
      <div className="mb-1 flex justify-between">
        <span className="text-slate-500">Probability</span>
        <span className="font-medium">{formatPercent(token.probability)}</span>
      </div>
      <div className="mb-2 flex justify-between">
        <span className="text-slate-500">Logprob</span>
        <span className="font-mono">{token.logprob.toFixed(4)}</span>
      </div>
      {token.topAlternatives.length > 0 && (
        <>
          <div className="mb-1 mt-2 font-semibold text-slate-700">
            Top alternatieven
          </div>
          <ul className="space-y-0.5">
            {token.topAlternatives.map((alt, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2"
              >
                <code className="truncate rounded bg-slate-50 px-1.5 py-0.5">
                  {JSON.stringify(alt.token)}
                </code>
                <span className="text-slate-600">
                  {formatPercent(alt.probability)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </span>
  );
}

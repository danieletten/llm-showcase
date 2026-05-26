"use client";

import { useMemo } from "react";
import TokenVisualizer from "@/components/TokenVisualizer";
import WordVisualizer from "@/components/WordVisualizer";
import { computeConfidenceMetrics, getConfidenceStyle } from "@/lib/confidence";
import type {
  ConfidenceMetrics,
  DebugStats,
  GenerateTokenConfidenceResponse,
  TokenInfo,
} from "@/lib/types";

export type ViewMode = "words" | "tokens";

// Stabiele leeg-referentie zodat `useMemo` op `tokens` niet onnodig opnieuw
// triggert wanneer er (nog) geen response is.
const EMPTY_TOKENS: TokenInfo[] = [];

export interface ConfidenceOutputProps {
  title: string;
  /** Resultaat van een succesvolle call, of null wanneer er (nog) geen is. */
  response: GenerateTokenConfidenceResponse | null;
  /** Foutmelding voor deze specifieke output (compare-mode kan één van twee falen). */
  error?: string | null;
  /** Wordt getoond zolang deze specifieke output nog laadt. */
  loading?: boolean;
  viewMode: ViewMode;
  /**
   * Optioneel: als meegegeven, toont deze component een interne weergave-toggle.
   * Niet meegeven wanneer de toggle elders in de UI staat.
   */
  onViewModeChange?: (next: ViewMode) => void;
}

export default function ConfidenceOutput({
  title,
  response,
  error,
  loading,
  viewMode,
  onViewModeChange,
}: ConfidenceOutputProps) {
  const tokens = response?.tokens ?? EMPTY_TOKENS;
  const metrics: ConfidenceMetrics = useMemo(
    () => computeConfidenceMetrics(tokens),
    [tokens],
  );

  const mocked = Boolean(response?.mocked);
  const mockReason = response?.mockReason;
  const upstreamError = response?.upstreamError;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {mocked && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Demo data, geen echte model probabilities
              {mockReason === "llm-error-dev-fallback"
                ? " (dev fallback na LLM-fout)"
                : ""}
            </span>
          )}
          {onViewModeChange && (
            <ViewToggle value={viewMode} onChange={onViewModeChange} />
          )}
        </div>
      </div>

      {mockReason === "llm-error-dev-fallback" && upstreamError && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Upstream-fout (alleen zichtbaar in development):{" "}
          <code className="font-mono">{upstreamError}</code>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <Legend />

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Een taalmodel kiest niet simpelweg woorden uit een vaste lijst. Per
        token berekent het welke vervolgen waarschijnlijk zijn. Donkerdere
        markering betekent dat het gekozen token minder vanzelfsprekend was
        volgens het model.
      </p>

      <div className="mt-4 rounded-md bg-slate-50/60 px-4 py-4">
        {loading && tokens.length === 0 ? (
          <p className="text-sm text-slate-500">Bezig met genereren…</p>
        ) : viewMode === "words" ? (
          <WordVisualizer tokens={tokens} />
        ) : (
          <TokenVisualizer tokens={tokens} />
        )}
      </div>

      {tokens.length > 0 && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {viewMode === "words"
              ? "In woordweergave worden meerdere tokens samengevoegd voor leesbaarheid. De kleur gebruikt de laagste probability van de onderliggende tokens. Klik of hover op een woord voor de tokens en alternatieven."
              : "In tokenweergave zie je de ruwe tokens zoals het model ze produceerde. Klik of hover op een token voor probability, logprob en top alternatieven."}
          </p>

          <MetricsRow metrics={metrics} />

          {response?.debug && <DebugPanel debug={response.debug} />}
        </>
      )}
    </section>
  );
}

function MetricsRow({ metrics }: { metrics: ConfidenceMetrics }) {
  // Kleine, rustige cijferregel boven debug — geen grote dashboards.
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
      <Stat
        label="Gemiddelde probability"
        value={`${(metrics.averageProbability * 100).toFixed(1)}%`}
      />
      <Stat
        label="Laagste probability"
        value={`${(metrics.minProbability * 100).toFixed(1)}%`}
      />
      <Stat
        label="Tokens onder 50%"
        value={`${metrics.lowConfidenceTokenCount} / ${metrics.tokenCount}`}
      />
      <Stat
        label="Tokens onder 20%"
        value={`${metrics.veryLowConfidenceTokenCount} / ${metrics.tokenCount}`}
      />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="font-mono text-slate-700">{value}</dd>
    </div>
  );
}

function Legend() {
  // Gebruikt exact dezelfde helper als de echte tokens en woordgroepen.
  const samples = [0.98, 0.85, 0.65, 0.4, 0.15];
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-500">
        Voorbeeldmarkering per token probability:
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span>Hoge zekerheid</span>
        {samples.map((p) => (
          <span key={p} style={getConfidenceStyle(p)}>
            {(p * 100).toFixed(0)}%
          </span>
        ))}
        <span>Lage zekerheid</span>
      </div>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const base =
    "px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-1 focus:ring-slate-400";
  const active = "bg-slate-900 text-white";
  const inactive = "bg-white text-slate-600 hover:bg-slate-100";
  return (
    <div
      role="group"
      aria-label="Weergavemodus"
      className="inline-flex overflow-hidden rounded-md border border-slate-300"
    >
      <button
        type="button"
        aria-pressed={value === "words"}
        onClick={() => onChange("words")}
        className={`${base} ${value === "words" ? active : inactive}`}
      >
        Woorden
      </button>
      <button
        type="button"
        aria-pressed={value === "tokens"}
        onClick={() => onChange("tokens")}
        className={`${base} border-l border-slate-300 ${
          value === "tokens" ? active : inactive
        }`}
      >
        Tokens
      </button>
    </div>
  );
}

function DebugPanel({ debug }: { debug: DebugStats }) {
  return (
    <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <summary className="cursor-pointer font-medium text-slate-600">
        Debug
      </summary>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <dt className="text-slate-500">mocked</dt>
        <dd>{String(debug.mocked)}</dd>
        <dt className="text-slate-500">tokens</dt>
        <dd>{debug.tokenCount}</dd>
        <dt className="text-slate-500">tokens met alternatieven</dt>
        <dd>{debug.tokensWithAlternatives}</dd>
        <dt className="text-slate-500">min probability</dt>
        <dd>{(debug.minProbability * 100).toFixed(2)}%</dd>
        <dt className="text-slate-500">max probability</dt>
        <dd>{(debug.maxProbability * 100).toFixed(2)}%</dd>
      </dl>
    </details>
  );
}

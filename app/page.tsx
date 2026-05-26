"use client";

import { useState } from "react";
import TokenVisualizer from "@/components/TokenVisualizer";
import WordVisualizer from "@/components/WordVisualizer";
import { getConfidenceStyle } from "@/lib/confidence";
import type {
  DebugStats,
  GenerateTokenConfidenceResponse,
  MockReason,
  TokenInfo,
} from "@/lib/types";

type ViewMode = "words" | "tokens";

// Voorbeeldprompts voor de demo — variatie tussen feitelijk, creatief en kort.
const EXAMPLE_PROMPTS: readonly string[] = [
  "Leg entropie uit in één zin.",
  "Schrijf één mysterieuze zin over een oude vuurtoren.",
  "Schrijf een korte reclameslogan voor een nieuwe koffiezaak.",
];

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>(
    "Leg in twee zinnen uit waarom de lucht blauw is.",
  );
  const [temperature, setTemperature] = useState<number>(0.7);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("words");
  const [mocked, setMocked] = useState<boolean>(false);
  const [mockReason, setMockReason] = useState<MockReason | null>(null);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setTokens([]);
    setMocked(false);
    setMockReason(null);
    setUpstreamError(null);
    setDebug(null);
    try {
      const res = await fetch("/api/generate-token-confidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, temperature }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Request mislukt (${res.status}).`);
      }

      const data = (await res.json()) as GenerateTokenConfidenceResponse;
      setTokens(data.tokens);
      setMocked(Boolean(data.mocked));
      setMockReason(data.mockReason ?? null);
      setUpstreamError(data.upstreamError ?? null);
      setDebug(data.debug ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          LLM Token Confidence Visualizer
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Zie hoe een LLM token-voor-token tekst genereert. Donkerdere
          markering = lagere waarschijnlijkheid volgens het model.
        </p>
      </header>

      <section className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Voorbeelden
          </span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                disabled={loading}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Prompt
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Typ hier je prompt…"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Temperatuur</span>
            <span className="font-mono text-slate-500">
              {temperature.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length === 0}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Genereren…" : "Genereer"}
          </button>
          {loading && (
            <span className="text-sm text-slate-500">
              Bezig met opvragen van logprobs…
            </span>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Output</h2>
          <div className="flex items-center gap-2">
            {mocked && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Demo data, geen echte model probabilities
                {mockReason === "llm-error-dev-fallback"
                  ? " (dev fallback na LLM-fout)"
                  : ""}
              </span>
            )}
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {mockReason === "llm-error-dev-fallback" && upstreamError && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Upstream-fout (alleen zichtbaar in development):{" "}
            <code className="font-mono">{upstreamError}</code>
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
          {viewMode === "words" ? (
            <WordVisualizer tokens={tokens} />
          ) : (
            <TokenVisualizer tokens={tokens} />
          )}
        </div>

        {tokens.length > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {viewMode === "words"
              ? "In woordweergave worden meerdere tokens samengevoegd voor leesbaarheid. De kleur gebruikt de laagste probability van de onderliggende tokens. Klik of hover op een woord voor de tokens en alternatieven."
              : "In tokenweergave zie je de ruwe tokens zoals het model ze produceerde. Klik of hover op een token voor probability, logprob en top alternatieven."}
          </p>
        )}

        {debug && tokens.length > 0 && <DebugPanel debug={debug} />}
      </section>

      <footer className="mt-6 text-xs text-slate-500">
        Wissel tussen Woorden en Tokens om dezelfde uitvoer op twee niveaus te
        bekijken.
      </footer>
    </main>
  );
}

function Legend() {
  // Een paar voorbeeldwaarden die de schaal van confidence laten zien.
  // Gebruikt exact dezelfde helper als de echte tokens en woordgroepen,
  // zodat de legenda niet kan afdrijven van de werkelijke kleurmapping.
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
    <details className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
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

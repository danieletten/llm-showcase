"use client";

import { useState } from "react";
import ConfidenceOutput, {
  type ViewMode,
} from "@/components/ConfidenceOutput";
import type { GenerateTokenConfidenceResponse } from "@/lib/types";

type ExampleCard = {
  id: string;
  title: string;
  prompt: string;
  context: string;
  /** Optionele korte toelichting onder de kaart (bv. demo-pointer). */
  note?: string;
  /** Zet compare mode automatisch aan bij klikken. */
  forceCompareMode?: boolean;
};

const PS_REFACTOR_PROMPT = `Refactor dit PowerShell script:

$subs = Get-AzSubscription
foreach ($s in $subs) {
  Set-AzContext -SubscriptionId $s.Id
  $vms = Get-AzVM
  foreach ($vm in $vms) {
    Write-Host $vm.Name
    if ($vm.Tags["Owner"] -eq $null) {
      Write-Host "No owner tag"
    }
  }
}`;

const PS_REFACTOR_CONTEXT = [
  "Het script wordt gebruikt door cloud engineers om Azure resources te controleren.",
  "Refactor met focus op leesbaarheid, foutafhandeling, veilige logging en herbruikbaarheid.",
  "Behoud hetzelfde gedrag.",
  "Gebruik duidelijke functienamen, comment-based help en Write-Verbose in plaats van Write-Host.",
  "Maak geen externe dependencies aan.",
  "Zorg dat het resultaat geschikt blijft voor PowerShell 7 en de Az PowerShell module.",
].join("\n");

const EXAMPLE_CARDS: readonly ExampleCard[] = [
  {
    id: "entropy",
    title: "Entropie simpel uitgelegd",
    prompt: "Leg entropie uit in één zin.",
    context:
      "Doelgroep: leerlingen van 15 jaar. Vermijd formules. Gebruik een alledaagse vergelijking met een rommelige kamer. Antwoord in maximaal 20 woorden.",
  },
  {
    id: "lighthouse",
    title: "Mysterieuze vuurtoren",
    prompt: "Schrijf één mysterieuze zin over een oude vuurtoren.",
    context:
      'Stijl: kalm, filmisch en licht onheilspellend. Locatie: een verlaten eiland in de mist. De zin moet de woorden "mist", "licht" en "stilte" bevatten. Maximaal 18 woorden.',
  },
  {
    id: "coffee",
    title: "Koffiezaak slogan",
    prompt: "Schrijf een korte reclameslogan voor een nieuwe koffiezaak.",
    context:
      "De koffiezaak heet Morgenlicht. De zaak zit naast een treinstation. De doelgroep is forenzen. De belofte is snelle, goede koffie voor onderweg. De toon is warm en optimistisch. Maximaal 8 woorden.",
  },
  {
    id: "ps-refactor",
    title: "PowerShell refactor",
    prompt: PS_REFACTOR_PROMPT,
    context: PS_REFACTOR_CONTEXT,
    note: "Het script zelf is context, maar het vertelt nog niet wat goed refactoren betekent. Met doelcriteria zoals leesbaarheid, foutafhandeling en logging wordt de opdracht veel specifieker.",
    forceCompareMode: true,
  },
];

type OutputSlot = {
  data: GenerateTokenConfidenceResponse | null;
  error: string | null;
  loading: boolean;
};

const EMPTY_SLOT: OutputSlot = { data: null, error: null, loading: false };

interface GenerateBody {
  prompt: string;
  temperature: number;
  context?: string;
}

async function callGenerate(
  body: GenerateBody,
): Promise<GenerateTokenConfidenceResponse> {
  const res = await fetch("/api/generate-token-confidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request mislukt (${res.status}).`);
  }
  return (await res.json()) as GenerateTokenConfidenceResponse;
}

export default function HomePage() {
  const [prompt, setPrompt] = useState<string>(
    "Leg in twee zinnen uit waarom de lucht blauw is.",
  );
  const [context, setContext] = useState<string>("");
  const [temperature, setTemperature] = useState<number>(0.7);
  // Houd bij of de gebruiker de slider zelf heeft aangeraakt. Voorbeeldkaarten
  // mogen alleen terugvallen op een aanbevolen temperatuur als dat niet zo is.
  const [temperatureTouched, setTemperatureTouched] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>("words");

  // Eén slot voor de "single output"-modus, twee slots voor compare-mode.
  const [singleSlot, setSingleSlot] = useState<OutputSlot>(EMPTY_SLOT);
  const [noContextSlot, setNoContextSlot] = useState<OutputSlot>(EMPTY_SLOT);
  const [withContextSlot, setWithContextSlot] =
    useState<OutputSlot>(EMPTY_SLOT);

  // Globale fout (bv. bij parsefouten in de single-flow). Per-output fouten
  // worden door ConfidenceOutput zelf getoond.
  const [globalError, setGlobalError] = useState<string | null>(null);
  const loading =
    singleSlot.loading || noContextSlot.loading || withContextSlot.loading;

  function applyExample(card: ExampleCard) {
    setPrompt(card.prompt);
    setContext(card.context);
    if (card.forceCompareMode) {
      setCompareMode(true);
      // Aanbevolen demowaarde, maar respecteer een eerdere keuze van de gebruiker.
      if (!temperatureTouched) setTemperature(0.7);
    }
    setGlobalError(null);
  }

  async function handleGenerate() {
    setGlobalError(null);
    const trimmedPrompt = prompt.trim();
    const trimmedContext = context.trim();
    if (!trimmedPrompt) return;

    if (compareMode) {
      // Twee parallelle calls; één failure mag de andere niet meeslepen.
      setSingleSlot(EMPTY_SLOT);
      setNoContextSlot({ data: null, error: null, loading: true });
      setWithContextSlot({ data: null, error: null, loading: true });

      const [noCtx, withCtx] = await Promise.allSettled([
        callGenerate({ prompt: trimmedPrompt, temperature }),
        callGenerate({
          prompt: trimmedPrompt,
          temperature,
          context: trimmedContext.length > 0 ? trimmedContext : undefined,
        }),
      ]);

      setNoContextSlot({
        data: noCtx.status === "fulfilled" ? noCtx.value : null,
        error:
          noCtx.status === "rejected"
            ? noCtx.reason instanceof Error
              ? noCtx.reason.message
              : String(noCtx.reason)
            : null,
        loading: false,
      });
      setWithContextSlot({
        data: withCtx.status === "fulfilled" ? withCtx.value : null,
        error:
          withCtx.status === "rejected"
            ? withCtx.reason instanceof Error
              ? withCtx.reason.message
              : String(withCtx.reason)
            : null,
        loading: false,
      });
      return;
    }

    // Single-output flow.
    setNoContextSlot(EMPTY_SLOT);
    setWithContextSlot(EMPTY_SLOT);
    setSingleSlot({ data: null, error: null, loading: true });
    try {
      const data = await callGenerate({
        prompt: trimmedPrompt,
        temperature,
        context: trimmedContext.length > 0 ? trimmedContext : undefined,
      });
      setSingleSlot({ data, error: null, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Onbekende fout.";
      setSingleSlot({ data: null, error: msg, loading: false });
      setGlobalError(msg);
    }
  }

  const compareWithEmptyContext = compareMode && context.trim().length === 0;

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
          <div className="grid gap-2 sm:grid-cols-3">
            {EXAMPLE_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => applyExample(card)}
                disabled={loading}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="font-semibold text-slate-800">{card.title}</div>
                <div className="mt-1 text-slate-500">
                  {card.note ?? "Prompt + context worden ingevuld."}
                </div>
                {card.forceCompareMode && (
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Zet compare mode aan
                  </div>
                )}
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
            rows={3}
            spellCheck={false}
            maxLength={1000}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Typ hier je prompt…"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Context, optioneel</span>
            <span className="font-mono text-xs text-slate-400">
              {context.length} / 2000
            </span>
          </span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            spellCheck={false}
            maxLength={2000}
            className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Voeg achtergrondinformatie, doelgroep, stijl, constraints of voorbeelden toe."
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
            onChange={(e) => {
              setTemperature(parseFloat(e.target.value));
              setTemperatureTouched(true);
            }}
            className="w-full"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          <span>Vergelijk zonder en met context</span>
        </label>

        {compareMode && (
          <p className="text-xs leading-relaxed text-slate-500">
            Relevante context verkleint vaak de keuzeruimte van het model.
            Daardoor worden sommige vervolgtokens waarschijnlijker en zie je
            meestal minder donkere markering.
          </p>
        )}

        {compareWithEmptyContext && (
          <div
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            Voeg context toe om het verschil zichtbaar te maken.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length === 0}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Genereren…" : "Genereer"}
          </button>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {globalError && !compareMode && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {globalError}
          </div>
        )}
      </section>

      {compareMode ? (
        <div className="space-y-6">
          <ConfidenceOutput
            title="Zonder context"
            response={noContextSlot.data}
            error={noContextSlot.error}
            loading={noContextSlot.loading}
            viewMode={viewMode}
          />
          <ConfidenceOutput
            title="Met context"
            response={withContextSlot.data}
            error={withContextSlot.error}
            loading={withContextSlot.loading}
            viewMode={viewMode}
          />
        </div>
      ) : (
        <ConfidenceOutput
          title="Output"
          response={singleSlot.data}
          error={singleSlot.error}
          loading={singleSlot.loading}
          viewMode={viewMode}
        />
      )}

      <footer className="mt-6 text-xs text-slate-500">
        Wissel tussen Woorden en Tokens om dezelfde uitvoer op twee niveaus te
        bekijken.
      </footer>
    </main>
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


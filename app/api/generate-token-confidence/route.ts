import { NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import type {
  ApiErrorResponse,
  DebugStats,
  GenerateTokenConfidenceRequest,
  GenerateTokenConfidenceResponse,
  TokenInfo,
} from "@/lib/types";

export const runtime = "nodejs";

// Aantal alternatieven dat we per token opvragen (min. 5 volgens spec).
const TOP_LOGPROBS = 5;

// Lage cap op output tokens: dit is een demo, niet een chat. Houd hem klein
// voor snelheid en kostenbeheersing — alle voorbeeldprompts passen ruim
// binnen 120 tokens.
const MAX_OUTPUT_TOKENS = 120;

// Inputlimieten zodat de demo-endpoint niet als gratis LLM-proxy misbruikt
// kan worden. Server-side controle — afwijzen met 400 als overschreden.
const MAX_PROMPT_CHARS = 1000;
const MAX_CONTEXT_CHARS = 2000;

// Azure OpenAI: 'model' veld op de request = de *deployment name*.
const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini";
// Min. 2024-06-01 voor logprobs/top_logprobs op chat completions.
const AZURE_API_VERSION =
  process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

const IS_PROD = process.env.NODE_ENV === "production";

const LOGPROBS_MISSING_MESSAGE =
  "Het gekozen model of endpoint geeft geen token probabilities terug. " +
  "Kies een model dat Chat Completions logprobs ondersteunt.";

/**
 * Converteert een logprob naar een probability in [0, 1].
 * Toelichting: een logprob is de natuurlijke log van de kans dat het model
 * dit token koos. probability = exp(logprob).
 *   - logprob = 0     -> probability = 1   (volledig zeker)
 *   - logprob = -0.1  -> probability ~ 0.905
 *   - logprob = -2    -> probability ~ 0.135 (onzeker)
 */
function logprobToProbability(logprob: number): number {
  return Math.exp(logprob);
}

export async function POST(req: Request) {
  let body: GenerateTokenConfidenceRequest;
  try {
    body = (await req.json()) as GenerateTokenConfidenceRequest;
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Ongeldige JSON in request body." },
      { status: 400 },
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const rawContext =
    typeof body?.context === "string" ? body.context.trim() : "";
  const context = rawContext.length > 0 ? rawContext : undefined;
  const temperature =
    typeof body?.temperature === "number" && Number.isFinite(body.temperature)
      ? Math.min(Math.max(body.temperature, 0), 2)
      : 0.7;

  if (!prompt) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Prompt mag niet leeg zijn." },
      { status: 400 },
    );
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json<ApiErrorResponse>(
      {
        error: `Prompt is te lang (${prompt.length} tekens, max ${MAX_PROMPT_CHARS}).`,
      },
      { status: 400 },
    );
  }

  if (context && context.length > MAX_CONTEXT_CHARS) {
    return NextResponse.json<ApiErrorResponse>(
      {
        error: `Context is te lang (${context.length} tekens, max ${MAX_CONTEXT_CHARS}).`,
      },
      { status: 400 },
    );
  }

  // Geen Azure credentials? Stuur een mock terug zodat de UI demonstreerbaar blijft.
  if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
    const mock = buildMockResponse(prompt);
    return NextResponse.json<GenerateTokenConfidenceResponse>({
      ...mock,
      mockReason: "missing-credentials",
      debug: computeDebugStats(mock.tokens, true),
    });
  }

  try {
    const client = new AzureOpenAI({
      endpoint: AZURE_ENDPOINT,
      apiKey: AZURE_API_KEY,
      apiVersion: AZURE_API_VERSION,
      deployment: AZURE_DEPLOYMENT,
    });

    const completion = await client.chat.completions.create({
      // Op Azure is dit veld de deployment name.
      model: AZURE_DEPLOYMENT,
      temperature,
      max_tokens: MAX_OUTPUT_TOKENS,
      logprobs: true,
      top_logprobs: TOP_LOGPROBS,
      messages: buildMessages(prompt, context),
    });

    const choice = completion.choices?.[0];
    const content = choice?.message?.content ?? "";
    const contentLogprobs = choice?.logprobs?.content;

    // Server-side debug: alleen tellingen, GEEN inhoud van prompt/respons/tokens.
    console.info(
      "[token-confidence] LLM response received",
      JSON.stringify({
        deployment: AZURE_DEPLOYMENT,
        apiVersion: AZURE_API_VERSION,
        finishReason: choice?.finish_reason ?? null,
        contentChars: content.length,
        logprobTokens: contentLogprobs?.length ?? 0,
        hasLogprobs: Boolean(contentLogprobs && contentLogprobs.length > 0),
      }),
    );

    if (!contentLogprobs || contentLogprobs.length === 0) {
      return NextResponse.json<ApiErrorResponse>(
        { error: LOGPROBS_MISSING_MESSAGE },
        { status: 502 },
      );
    }

    const tokens: TokenInfo[] = contentLogprobs.map((entry) => ({
      token: entry.token,
      logprob: entry.logprob,
      probability: logprobToProbability(entry.logprob),
      topAlternatives: (entry.top_logprobs ?? []).map((alt) => ({
        token: alt.token,
        logprob: alt.logprob,
        probability: logprobToProbability(alt.logprob),
      })),
    }));

    const response: GenerateTokenConfidenceResponse = {
      text: content,
      tokens,
      debug: computeDebugStats(tokens, false),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Onbekende fout bij LLM-call.";
    console.error("[token-confidence] LLM call failed:", message);

    // BELANGRIJK: in productie nooit stilzwijgend terugvallen op mock.
    // In dev mag het, maar de UI moet dit expliciet tonen.
    if (!IS_PROD) {
      const mock = buildMockResponse(prompt);
      return NextResponse.json<GenerateTokenConfidenceResponse>({
        ...mock,
        mockReason: "llm-error-dev-fallback",
        upstreamError: message,
        debug: computeDebugStats(mock.tokens, true),
      });
    }

    return NextResponse.json<ApiErrorResponse>(
      { error: `LLM-call mislukt: ${message}` },
      { status: 500 },
    );
  }
}

/**
 * Bouw de chat-messages. Zonder context: korte beknopt-assistent prompt.
 * Met context: explicietere system-prompt + user-bericht in `Context: …
 * \n\nTaak: …` formaat, zodat de demo het effect van context op
 * token-probabilities goed kan laten zien.
 */
function buildMessages(prompt: string, context: string | undefined) {
  if (!context) {
    return [
      {
        role: "system" as const,
        content:
          "Je bent een beknopte assistent. Geef korte, behulpzame antwoorden.",
      },
      { role: "user" as const, content: prompt },
    ];
  }

  return [
    {
      role: "system" as const,
      content:
        "Je bent een taalmodel dat helder, beknopt en volgens de gegeven context antwoordt. Gebruik de context alleen als die relevant is.",
    },
    {
      role: "user" as const,
      content: `Context:\n${context}\n\nTaak:\n${prompt}`,
    },
  ];
}

/**
 * Bereken samenvattende statistieken over de tokens — handig voor een
 * debug-paneel in de UI en voor server-side logging zonder inhoud te lekken.
 */
function computeDebugStats(tokens: TokenInfo[], mocked: boolean): DebugStats {
  if (tokens.length === 0) {
    return {
      mocked,
      tokenCount: 0,
      tokensWithAlternatives: 0,
      minProbability: 0,
      maxProbability: 0,
    };
  }
  let min = Infinity;
  let max = -Infinity;
  let withAlts = 0;
  for (const t of tokens) {
    if (t.probability < min) min = t.probability;
    if (t.probability > max) max = t.probability;
    if (t.topAlternatives && t.topAlternatives.length > 0) withAlts++;
  }
  return {
    mocked,
    tokenCount: tokens.length,
    tokensWithAlternatives: withAlts,
    minProbability: min,
    maxProbability: max,
  };
}

/**
 * Mock-respons voor lokale demo zonder API key.
 * Splitst een vast antwoord in pseudo-tokens met plausibele probabilities.
 */
function buildMockResponse(prompt: string): GenerateTokenConfidenceResponse {
  const text = `Mock-antwoord op: "${prompt.slice(0, 40)}". Dit is een demo.`;
  // Heel simpele "tokenisatie" op woordgrenzen, mét behoud van spaties.
  const rawTokens = text.match(/\s+|\S+/g) ?? [text];

  const tokens: TokenInfo[] = rawTokens.map((tok, i) => {
    // Pseudo-random maar deterministisch: varieer confidence per index.
    const seed = (i * 9301 + 49297) % 233280;
    const r = seed / 233280; // 0..1
    const probability = 0.45 + r * 0.5; // 0.45..0.95
    const logprob = Math.log(probability);
    const alts = Array.from({ length: TOP_LOGPROBS }, (_, k) => {
      const p = Math.max(0.01, probability - (k + 1) * 0.08 - r * 0.05);
      return {
        token: k === 0 ? tok : `${tok}_alt${k}`,
        logprob: Math.log(p),
        probability: p,
      };
    });
    return { token: tok, logprob, probability, topAlternatives: alts };
  });

  return { text, tokens, mocked: true };
}

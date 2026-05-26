/**
 * Gedeelde types voor de Token Confidence Visualizer.
 * Bewust losgekoppeld van OpenAI-specifieke typen zodat de visualizer
 * later met andere providers (of een mock) gebruikt kan worden.
 */

export interface TokenAlternative {
  token: string;
  logprob: number;
  probability: number;
}

export interface TokenInfo {
  token: string;
  logprob: number;
  probability: number;
  topAlternatives: TokenAlternative[];
}

/**
 * Een woordgroep is één of meer aaneengesloten tokens die samen een
 * leesbare visuele eenheid vormen (een woord, leestekenfragment, of
 * stuk whitespace).
 *
 *  - `probability` = laagste probability van de onderliggende tokens.
 *  - `logprob`     = laagste logprob van de onderliggende tokens.
 *  - `tokens`      = originele tokens (incl. whitespace, niet getrimd).
 */
export interface WordGroup {
  text: string;
  tokens: TokenInfo[];
  probability: number;
  logprob: number;
}

export interface GenerateTokenConfidenceRequest {
  prompt: string;
  /**
   * Optionele achtergrondinformatie / constraints. Wordt server-side in een
   * apart system+user-bericht meegestuurd zodat de demo het verschil tussen
   * "zonder context" en "met context" kan laten zien.
   */
  context?: string;
  temperature: number;
}

export interface DebugStats {
  mocked: boolean;
  tokenCount: number;
  tokensWithAlternatives: number;
  minProbability: number;
  maxProbability: number;
}

/**
 * Samenvattende confidence-statistieken die per output worden getoond.
 * Bewust losgekoppeld van `DebugStats` — `ConfidenceMetrics` is UI-facing,
 * `DebugStats` is voor het techniek-paneel.
 */
export interface ConfidenceMetrics {
  tokenCount: number;
  averageProbability: number;
  minProbability: number;
  /** Aantal tokens met probability < 0.50 */
  lowConfidenceTokenCount: number;
  /** Aantal tokens met probability < 0.20 */
  veryLowConfidenceTokenCount: number;
}

export type MockReason = "missing-credentials" | "llm-error-dev-fallback";

export interface GenerateTokenConfidenceResponse {
  text: string;
  tokens: TokenInfo[];
  /** Aanwezig wanneer een mock-respons is gebruikt (bv. geen API key). */
  mocked?: boolean;
  /** Waarom de mock werd gebruikt (alleen wanneer mocked === true). */
  mockReason?: MockReason;
  /** Originele upstream-foutmelding als de dev-fallback is gebruikt. */
  upstreamError?: string;
  /** Samenvattende statistieken voor debug / UI. */
  debug?: DebugStats;
}

export interface ApiErrorResponse {
  error: string;
}

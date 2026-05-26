// E2E sanity check tegen /api/generate-token-confidence.
// Print alleen geaggregeerde info — geen prompts, geen volledige tekst,
// en duidelijk gemarkeerd of de respons mock of echt is.
const res = await fetch("http://localhost:3000/api/generate-token-confidence", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Geef een korte definitie van entropie in één zin.",
    temperature: 0.7,
  }),
});

console.log("HTTP status:", res.status);
const data = await res.json();

if (!res.ok) {
  console.log("Error payload:", data);
  process.exit(1);
}

const tokens = data.tokens ?? [];
console.log("mocked:", Boolean(data.mocked));
console.log("mockReason:", data.mockReason ?? null);
console.log("debug:", data.debug);
console.log("tokenCount:", tokens.length);
console.log(
  "first 8 tokens (probability % only):",
  tokens.slice(0, 8).map((t) => `${(t.probability * 100).toFixed(1)}%`),
);

if (tokens.length > 0) {
  // Kies een token in het midden i.p.v. de allereerste (vaak '0' logprob = 100%).
  const sample = tokens[Math.min(3, tokens.length - 1)];
  // Saniteer: token-strings vervangen door lengtes, getallen afronden.
  const sanitized = {
    token_length: sample.token.length,
    logprob: Number(sample.logprob.toFixed(4)),
    probability: Number(sample.probability.toFixed(4)),
    topAlternatives_count: sample.topAlternatives?.length ?? 0,
    topAlternatives_sanitized: (sample.topAlternatives ?? []).map((a) => ({
      token_length: a.token.length,
      logprob: Number(a.logprob.toFixed(4)),
      probability: Number(a.probability.toFixed(4)),
    })),
  };
  console.log("sanitized sample token:", JSON.stringify(sanitized, null, 2));
}

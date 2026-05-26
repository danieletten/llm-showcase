import type { TokenInfo, WordGroup } from "@/lib/types";

function isPureWhitespace(s: string): boolean {
  return s.length > 0 && s.trim().length === 0;
}

function startsWithWhitespace(s: string): boolean {
  return s.length > 0 && /^\s/.test(s);
}

function makeGroup(tokens: TokenInfo[]): WordGroup {
  const text = tokens.map((t) => t.token).join("");
  // Probability van de groep = laagste van de onderliggende tokens
  // (het zwakste schakeltje bepaalt hoe "vanzelfsprekend" het woord was).
  const probability = Math.min(...tokens.map((t) => t.probability));
  const logprob = Math.min(...tokens.map((t) => t.logprob));
  return { text, tokens, probability, logprob };
}

/**
 * Groepeert raw model-tokens tot leesbare woordgroepen.
 *
 * Regels:
 *  - Een token dat met whitespace begint, opent een nieuwe woordgroep
 *    (de leading whitespace blijft in de groep, dus originele spacing
 *    blijft behouden).
 *  - Een token dat puur whitespace is (bv. "\n", "  ") wordt als losse
 *    whitespace-groep gerendered — zo blijven newlines en grote spaties
 *    zichtbaar zonder dat ze visueel deel uitmaken van een gemarkeerd
 *    woord.
 *  - Tokens zonder leading whitespace (typisch leestekens of vervolg-
 *    fragmenten van een woord) worden aan de huidige groep geplakt.
 *
 * Tokens worden nergens getrimd; alle whitespace en lege strings blijven
 * in `tokens[]` aanwezig zodat de detail-tooltip dezelfde info kan tonen
 * als de tokenweergave.
 */
export function groupTokensIntoWords(tokens: TokenInfo[]): WordGroup[] {
  const groups: WordGroup[] = [];
  let current: TokenInfo[] = [];

  function flush() {
    if (current.length === 0) return;
    groups.push(makeGroup(current));
    current = [];
  }

  for (const t of tokens) {
    if (t.token.length === 0) {
      // Lege string-token: hang aan huidige groep als die bestaat, anders
      // sla over als eigen "anchor"-groep zodat we hem niet kwijtraken.
      if (current.length === 0) {
        groups.push(makeGroup([t]));
      } else {
        current.push(t);
      }
      continue;
    }

    if (isPureWhitespace(t.token)) {
      flush();
      groups.push(makeGroup([t]));
      continue;
    }

    if (startsWithWhitespace(t.token)) {
      flush();
      current.push(t);
      continue;
    }

    current.push(t);
  }

  flush();
  return groups;
}

/** True wanneer de groep alleen whitespace bevat (geen visuele markering). */
export function isWhitespaceGroup(group: WordGroup): boolean {
  return group.text.length > 0 && group.text.trim().length === 0;
}

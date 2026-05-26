import type { CSSProperties } from "react";

/**
 * Mapt een probability (0..1) naar een rustige inline-stijl voor de
 * achtergrond van een token of woordgroep.
 *
 * Bewust geen groen: groen/rood voelt als goed/fout, terwijl dit puur
 * waarschijnlijkheid is. Schaal loopt daarom van transparant (hoge
 * probability) via licht geel/oranje naar warm rood (lage probability).
 *
 * De hue gaat van ~38 (warm geel/oranje) naar ~6 (rood), lightness daalt
 * mee en alpha groeit naarmate de onzekerheid toeneemt — zo blijft de
 * tekst leesbaar.
 */
export function getConfidenceStyle(probability: number): CSSProperties {
  const p = Math.min(Math.max(probability, 0), 1);
  const uncertainty = 1 - p;

  if (p >= 0.95) {
    return {
      backgroundColor: "transparent",
      borderRadius: "0.3rem",
      padding: "0 0.06rem",
    };
  }

  const hue = 38 - uncertainty * 32; // 38 → 6 (geel/oranje → rood)
  const saturation = 92;
  const lightness = 96 - uncertainty * 38; // licht → dieper
  const alpha = 0.16 + uncertainty * 0.56; // 0.16 → 0.72

  return {
    backgroundColor: `hsla(${hue.toFixed(2)}, ${saturation}%, ${lightness.toFixed(2)}%, ${alpha.toFixed(3)})`,
    borderRadius: "0.3rem",
    padding: "0 0.06rem",
  };
}

export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

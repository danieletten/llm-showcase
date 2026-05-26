import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Token Confidence Visualizer",
  description:
    "Visualiseer hoe een LLM tekst token-voor-token genereert, inclusief probabilities en alternatieven.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}

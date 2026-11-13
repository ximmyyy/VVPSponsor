import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Tone = "positive" | "attention" | "danger" | "neutral";
// Toon volgt het statuslabel; onbekende labels blijven neutraal.
const tones: [RegExp, Tone][] = [
  [/^(Vervallen|Beëindigd|Geannuleerd|Teruggedraaid|Afgewezen)/, "danger"],
  [/looptijd verstreken|^Inactief|^Uitgefaseerd|^Gearchiveerd/, "neutral"],
  [
    /^(Actief|Bevestigd|Voldaan|Uitgevoerd|Gepubliceerd|Uitgereikt|Afgewikkeld|Goedgekeurd|Gecontroleerd)/,
    "positive",
  ],
  [
    /^(Prospect|Concept|Open|Openstaand|Deels betaald|In uitvoering|In behandeling|Tegoed)/,
    "attention",
  ],
];
function toneOf(children: unknown): Tone {
  if (typeof children !== "string") return "neutral";
  return tones.find(([pattern]) => pattern.test(children))?.[1] ?? "neutral";
}
export function Badge({
  className,
  children,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      data-tone={toneOf(children)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

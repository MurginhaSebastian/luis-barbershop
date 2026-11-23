import { Brush, Droplet, Eye, Gem, Hand, type LucideIcon, Scissors, Sparkles, Wind } from "lucide-react";

const ICONS: [RegExp, LucideIcon][] = [
  [/pesta|ceja/i, Eye],
  [/manicure|pedicure|u[ñn]a/i, Hand],
  [/corte/i, Scissors],
  [/planch|secad/i, Wind],
  [/cepill/i, Brush],
  [/lace/i, Gem],
  [/botox|tinte|mecha/i, Droplet],
];

/** Ícono del servicio de spa según su nombre; sin coincidencia, Sparkles. */
export const spaIconFor = (name: string): LucideIcon => ICONS.find(([p]) => p.test(name))?.[1] ?? Sparkles;

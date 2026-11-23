import { Brush, Droplet, Eye, Gem, Hand, Scissors, Sparkles, Wind } from "lucide-react";
import { expect, test } from "vitest";
import { spaIconFor } from "./spa-icon";

test.each([
  ["Corte de mujer", Scissors],
  ["Planchado", Wind],
  ["Cepillado", Brush],
  ["Laceado", Gem],
  ["Botox capilar", Droplet],
  ["Tinte de mujer", Droplet],
  ["Mechas", Droplet],
  ["Pestañas 1x1", Eye],
  ["Laminado de cejas", Eye],
  ["Manicure", Hand],
  ["Pedicure", Hand],
  ["Peinados", Sparkles],
])("%s", (name, icon) => expect(spaIconFor(name)).toBe(icon));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Alias cortos (s1, b1, a1) para los uuid que ve el modelo: un uuid cuesta ~25 tokens y el límite gratis es por
 * tokens/minuto. Solo viven en la frontera de GroqAssistant: lo que entra a los casos de uso son siempre los ids reales.
 */
export class IdAliases {
  private readonly toAlias = new Map<string, string>();
  private readonly toId = new Map<string, string>();
  private readonly count = { s: 0, b: 0, a: 0 };

  /** s = servicio, b = barbero, a = cita. Un id ya conocido conserva su alias. */
  register(kind: "s" | "b" | "a", id: string): string {
    const known = this.toAlias.get(id);
    if (known) return known;
    const alias = `${kind}${++this.count[kind]}`;
    this.toAlias.set(id, alias);
    this.toId.set(alias, id);
    return alias;
  }

  /** Lo que se le muestra al modelo: ids conocidos y uuid nuevos (las citas del cliente) pasan a alias. */
  encode(value: unknown): unknown {
    return this.walk(value, (s) => this.toAlias.get(s) ?? (UUID.test(s) ? this.register("a", s) : s));
  }

  /** Lo que el modelo manda: sus alias vuelven a ser ids reales. Un alias desconocido queda tal cual (Zod lo rechaza). */
  decode(value: unknown): unknown {
    return this.walk(value, (s) => this.toId.get(s) ?? s);
  }

  private walk(value: unknown, map: (s: string) => string): unknown {
    if (typeof value === "string") return map(value);
    if (Array.isArray(value)) return value.map((v) => this.walk(v, map));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.walk(v, map)]));
    return value;
  }
}

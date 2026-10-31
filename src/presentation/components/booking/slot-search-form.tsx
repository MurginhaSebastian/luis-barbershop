import Form from "next/form";
import type { Barber, Service } from "@/core/entities/catalog";
import { formatPrice } from "@/presentation/lib/format";
import { choiceClass, legendClass } from "./styles";

/** Pasos 1–3: formulario GET; al enviarlo, la página se recarga con los horarios libres. */
export function SlotSearchForm(props: {
  services: Service[];
  barbers: Barber[];
  selected: { serviceIds: string[]; barberId?: string; date: string };
  minDate: string;
  maxDate: string;
}) {
  return (
    <Form action="/reservar" scroll={false} className="space-y-10">
      <fieldset>
        <legend className={legendClass}>1. Servicios</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.services.map((s) => (
            <label key={s.id} className={choiceClass}>
              <input
                type="checkbox"
                name="servicios"
                value={s.id}
                defaultChecked={props.selected.serviceIds.includes(s.id)}
                className="size-4 accent-primary"
              />
              <span className="flex-1">{s.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {s.durationMinutes} min · {formatPrice(s.priceCents)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>2. Barbero</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {props.barbers.map((b) => (
            <label key={b.id} className={choiceClass}>
              <input
                type="radio"
                name="barbero"
                value={b.id}
                required
                defaultChecked={props.selected.barberId === b.id}
                className="size-4 accent-primary"
              />
              {b.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="dia" className={`${legendClass} block`}>
          3. Día
        </label>
        <input
          id="dia"
          type="date"
          name="dia"
          required
          min={props.minDate}
          max={props.maxDate}
          defaultValue={props.selected.date}
          className="h-11 rounded-xl border border-input bg-card px-4 focus-visible:outline-2 focus-visible:outline-ring"
        />
        <p className="mt-2 text-sm text-muted-foreground">Puedes reservar con hasta dos semanas de anticipación.</p>
      </div>

      <button
        type="submit"
        className="h-11 rounded-full border border-primary px-6 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        Ver horarios
      </button>
    </Form>
  );
}

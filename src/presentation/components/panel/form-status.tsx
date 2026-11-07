import type { AdminState } from "./admin-state";

/** Mensaje tras guardar: el error se anuncia de inmediato; lo demás, sin interrumpir. */
export function FormStatus({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  return (
    <p aria-live="polite" className="text-sm">
      {state.ok && <span className="text-primary">{state.ok}</span>}
      {state.warning && <span className="block text-foreground">{state.warning}</span>}
    </p>
  );
}

export const panelField =
  "h-11 w-full rounded-xl border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring";
export const panelSave =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

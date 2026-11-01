export const legendClass = "mb-4 font-heading text-2xl";
export const choiceClass =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-2 has-focus-visible:ring-ring";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const primaryButtonClass = `min-h-12 cursor-pointer rounded-full bg-primary px-8 font-semibold text-primary-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60 ${focusRing}`;
export const outlineButtonClass = `min-h-11 cursor-pointer rounded-full border border-primary px-6 text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground disabled:cursor-wait disabled:opacity-60 ${focusRing}`;

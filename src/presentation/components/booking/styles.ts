export const choiceClass =
  "flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-primary/60 has-checked:border-primary has-checked:bg-secondary has-focus-visible:ring-2 has-focus-visible:ring-ring";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const primaryButtonClass = `min-h-12 cursor-pointer rounded-full bg-primary px-8 font-semibold text-primary-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
export const linkChoiceClass = `flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors duration-200 hover:border-primary/60 hover:bg-secondary ${focusRing}`;

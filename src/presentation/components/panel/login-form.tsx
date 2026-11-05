"use client";

import { useActionState } from "react";
import { primaryButtonClass } from "@/presentation/components/booking/styles";

export interface LoginState {
  error?: string;
}

export function LoginForm({ action }: { action: (prev: LoginState, form: FormData) => Promise<LoginState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="password" className="mb-1.5 block">
          Clave
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "password-error" : undefined}
          className="h-12 w-full rounded-xl border border-input bg-card px-4 focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive"
        />
        {state.error && (
          <p id="password-error" role="alert" className="mt-1.5 text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

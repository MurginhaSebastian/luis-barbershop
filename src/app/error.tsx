"use client";

import { useEffect } from "react";
import { container, ctaClass, sectionTitle } from "@/presentation/components/landing/styles";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`${container} py-24 text-center`}>
      <h1 className={sectionTitle}>No pudimos cargar la página</h1>
      <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
        Es un problema nuestro, no de tu conexión. Vuelve a intentarlo en unos minutos.
      </p>
      <button type="button" onClick={retry} className={`${ctaClass} mt-8`}>
        Intentar de nuevo
      </button>
    </main>
  );
}

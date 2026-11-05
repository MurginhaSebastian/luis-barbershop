"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Va dentro de un <Link>: indica que la opción tocada está cargando. */
export function PendingHint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />;
}

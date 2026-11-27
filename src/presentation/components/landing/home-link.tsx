"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** Enlace a la portada. Ya en ella, Next no se mueve: sube al inicio (al video) y quita el #ancla. */
export function HomeLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  const pathname = usePathname();
  return (
    <Link
      {...props}
      href="/"
      onClick={(event) => {
        if (pathname !== "/") return;
        event.preventDefault();
        history.replaceState(history.state, "", "/");
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    />
  );
}

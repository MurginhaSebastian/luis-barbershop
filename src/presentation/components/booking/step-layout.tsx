"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef } from "react";

/** Plantilla de cada paso: al entrar, el foco va al título para que teclado y lector sigan el flujo. */
export function StepLayout(props: {
  progress: ReactNode;
  title: string;
  backHref?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <>
      {props.progress}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div>
        {props.backHref && (
          <Link
            href={props.backHref}
            className="mb-2 -ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 text-muted-foreground transition-colors duration-200 hover:text-primary"
          >
            <ChevronLeft aria-hidden className="size-4" />
            Atrás
          </Link>
        )}
        <h2 ref={heading} tabIndex={-1} className="font-heading text-3xl outline-none sm:text-4xl">
          {props.title}
        </h2>
        <div className="mt-6">{props.children}</div>
      </div>
      {props.summary}
      </div>
    </>
  );
}

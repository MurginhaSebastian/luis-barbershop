"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatDayParts } from "@/presentation/lib/format";
import { cn } from "@/presentation/lib/utils";

export interface DayOption {
  date: string;
  href: string;
  closed: boolean;
}

const chip = "flex min-h-18 w-16 shrink-0 flex-col items-center justify-center rounded-xl border sm:w-auto";

/** Los días que se pueden reservar; un toque recarga las horas. En móvil se desliza de lado. */
export function DayStrip({ days, selected }: { days: DayOption[]; selected: string }) {
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <ul
      aria-label="Elige el día"
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0"
    >
      {days.map(({ date, href, closed }) => {
        const { weekday, day, month } = formatDayParts(date);
        const label = (
          <>
            <span className="text-xs capitalize">{weekday}</span>
            <span className="font-heading text-2xl leading-tight tabular-nums">{day}</span>
            <span className="text-xs">{closed ? "cerrado" : month}</span>
          </>
        );
        const isSelected = date === selected;
        return (
          <li key={date} className="snap-center">
            {closed ? (
              <span aria-disabled className={cn(chip, "border-border/50 text-muted-foreground")}>
                {label}
              </span>
            ) : (
              <Link
                ref={isSelected ? current : undefined}
                href={href}
                scroll={false}
                prefetch={false}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  chip,
                  "cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary/60 hover:bg-secondary",
                )}
              >
                {label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

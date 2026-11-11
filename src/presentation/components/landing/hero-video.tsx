"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/presentation/lib/utils";

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

/**
 * Video de fondo de la portada, sin sonido y en bucle, sobre la foto que hace de póster. No arranca solo con
 * movimiento reducido ni con ahorro de datos: queda la foto y el botón para reproducirlo.
 */
export function HeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const quiet =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      (navigator as NavigatorWithConnection).connection?.saveData === true;
    // Si el navegador no deja reproducir (ahorro de batería), sigue la foto y el botón lo vuelve a intentar.
    if (!quiet) video.current?.play().catch(() => {});
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <>
      <video
        ref={video}
        aria-hidden
        tabIndex={-1}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onPlaying={() => setShown(true)}
        className={cn(
          "absolute inset-0 -z-10 size-full object-cover transition-opacity duration-700",
          shown ? "opacity-100" : "opacity-0",
        )}
      >
        <source src="/videos/corte-movil.mp4" type="video/mp4" media="(max-width: 767px) and (orientation: portrait)" />
        <source src="/videos/corte-escritorio.mp4" type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar el video" : "Reproducir el video"}
        className="absolute top-4 right-4 z-10 grid size-11 cursor-pointer place-items-center rounded-full border border-foreground/40 bg-background/60 text-foreground backdrop-blur transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
      </button>
    </>
  );
}

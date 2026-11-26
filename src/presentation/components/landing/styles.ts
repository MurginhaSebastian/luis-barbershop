export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
export const sectionTitle = "font-heading text-4xl sm:text-5xl";
export const ctaClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors duration-200 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";
export const ghostCtaClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-foreground/60 px-8 text-base text-foreground transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

// Sistema visual de la portada (Stitch): dorado con texto negro, esquinas de 4 px, Poppins.
const btn =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-sm px-6 font-label text-label-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4";
/** Botón principal: dorado champán con texto #111111. */
export const goldBtn = `${btn} bg-gold text-on-gold hover:bg-white focus-visible:outline-gold`;
/** Secundario sobre fondo oscuro. */
export const darkGhostBtn = `${btn} border border-dark-outline bg-dark-elevated/70 text-on-dark-canvas hover:border-gold hover:text-gold focus-visible:outline-gold`;
/** Botón oscuro sobre fondo crema. */
export const darkBtn = `${btn} bg-dark-canvas text-on-dark-canvas hover:bg-gold hover:text-on-gold focus-visible:outline-gold-on-light`;
/** Secundario sobre fondo crema. */
export const lightGhostBtn = `${btn} border border-on-light-canvas/40 text-on-light-canvas hover:border-on-light-canvas hover:bg-white focus-visible:outline-gold-on-light`;
/** Botón de "Para ellas": #8E4B52 con texto blanco. */
export const spaBtn = `${btn} bg-spa-primary text-on-spa-primary hover:bg-on-spa-surface focus-visible:outline-spa-primary`;
export const eyebrowDark = "font-eyebrow text-eyebrow uppercase text-gold";
export const eyebrowLight = "font-eyebrow text-eyebrow uppercase text-gold-on-light";
export const h2Light = "font-headline text-headline-lg-mobile md:text-headline-lg";

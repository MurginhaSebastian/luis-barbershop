import type { Metadata } from "next";

// Área privada: que no aparezca en buscadores.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return children;
}

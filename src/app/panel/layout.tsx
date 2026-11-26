import type { Metadata } from "next";
import { PanelShell } from "@/presentation/components/panel/panel-shell";
import { logoutAction } from "./actions";

// Área privada: que no aparezca en buscadores. El manifest permite instalar el panel (en iPhone, para recibir avisos).
export const metadata: Metadata = { robots: { index: false, follow: false }, manifest: "/panel.webmanifest" };

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return <PanelShell logout={logoutAction}>{children}</PanelShell>;
}

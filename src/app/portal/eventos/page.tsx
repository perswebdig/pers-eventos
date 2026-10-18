import { redirect } from "next/navigation";

export const metadata = { title: "Eventos" };

// A lista de eventos virou o feed da página inicial do portal.
export default function PortalEventosPage() {
  redirect("/portal");
}

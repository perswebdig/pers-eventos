import { isDemoMode } from "@/lib/env.server";
import { PedidosView } from "@/features/pedidos/pedidos-view";

export const metadata = { title: "Pedidos" };

export default function PedidosPage() {
  return <PedidosView demoMode={isDemoMode()} />;
}

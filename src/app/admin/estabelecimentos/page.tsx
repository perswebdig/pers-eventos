import { requireRole } from "@/lib/auth/session";
import { EstabelecimentosView } from "@/features/admin/estabelecimentos-view";

export const metadata = { title: "Estabelecimentos" };

export default async function AdminEstabelecimentosPage() {
  await requireRole(["super_admin"]);
  return <EstabelecimentosView />;
}

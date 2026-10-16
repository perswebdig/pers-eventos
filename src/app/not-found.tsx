import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        icon="search"
        title="Página não encontrada"
        description="O endereço acessado não existe ou foi movido."
        actions={<Button render={<Link href="/">Voltar ao início</Link>} />}
        className="w-full max-w-md"
      />
    </div>
  );
}

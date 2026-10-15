"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Trash2, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { getPessoaDetalhe } from "@/db/repos/pessoas";
import { calcularIdade, formatCpf, formatDate, formatTelefone } from "@/lib/format";

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5">
      <dt className="col-span-1 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="col-span-2 text-sm">{valor || "—"}</dd>
    </div>
  );
}

const STATUS_INSCRICAO: Record<string, string> = {
  inscrito: "Inscrito",
  confirmado: "Confirmado",
  checkin: "Check-in",
  checkout: "Check-out",
  cancelado: "Cancelado",
};

export function PessoaDetailSheet({
  pessoaId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  pessoaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const detalhe = useLiveQuery(
    () => (pessoaId ? getPessoaDetalhe(pessoaId) : Promise.resolve(null)),
    [pessoaId],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {!detalhe ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <User className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{detalhe.pessoa.nome_completo}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    <SyncStatusBadge status={detalhe.pessoa.sync_status} />
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="px-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados
              </h3>
              <dl className="divide-y">
                <Linha rotulo="CPF" valor={detalhe.pessoa.cpf ? formatCpf(detalhe.pessoa.cpf) : null} />
                <Linha rotulo="RG" valor={detalhe.pessoa.rg} />
                <Linha
                  rotulo="Nascimento"
                  valor={
                    detalhe.pessoa.data_nascimento
                      ? `${formatDate(detalhe.pessoa.data_nascimento)}${
                          calcularIdade(detalhe.pessoa.data_nascimento) !== null
                            ? ` (${calcularIdade(detalhe.pessoa.data_nascimento)} anos)`
                            : ""
                        }`
                      : null
                  }
                />
                <Linha
                  rotulo="Telefone"
                  valor={detalhe.pessoa.telefone ? formatTelefone(detalhe.pessoa.telefone) : null}
                />
                <Linha rotulo="E-mail" valor={detalhe.pessoa.email} />
                <Linha rotulo="Endereço" valor={detalhe.pessoa.endereco} />
              </dl>

              <Separator className="my-3" />

              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Emergência e saúde
              </h3>
              <dl className="divide-y">
                <Linha
                  rotulo="Contato"
                  valor={
                    detalhe.pessoa.contato_emergencia_nome
                      ? `${detalhe.pessoa.contato_emergencia_nome}${
                          detalhe.pessoa.contato_emergencia_telefone
                            ? ` · ${formatTelefone(detalhe.pessoa.contato_emergencia_telefone)}`
                            : ""
                        }`
                      : null
                  }
                />
                <Linha rotulo="Restrições" valor={detalhe.pessoa.restricoes_alimentares} />
                <Linha rotulo="Saúde" valor={detalhe.pessoa.condicoes_saude} />
                <Linha rotulo="Medicações" valor={detalhe.pessoa.medicacoes} />
              </dl>

              {detalhe.menor ? (
                <>
                  <Separator className="my-3" />
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <h3 className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-500">
                      Responsável (menor)
                    </h3>
                    <dl className="divide-y">
                      <Linha rotulo="Nome" valor={detalhe.menor.responsavel_nome} />
                      <Linha
                        rotulo="CPF"
                        valor={formatCpf(detalhe.menor.responsavel_cpf)}
                      />
                    </dl>
                  </div>
                </>
              ) : null}

              {detalhe.pessoa.observacoes ? (
                <>
                  <Separator className="my-3" />
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Observações
                  </h3>
                  <p className="whitespace-pre-wrap text-sm">{detalhe.pessoa.observacoes}</p>
                </>
              ) : null}

              <Separator className="my-3" />

              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico de eventos
              </h3>
              {detalhe.historico.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
              ) : (
                <ul className="space-y-2 py-1">
                  {detalhe.historico.map(({ inscricao, evento }) => (
                    <li
                      key={inscricao.id}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {evento?.nome ?? "Evento removido"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {evento ? formatDate(evento.data_inicio) : ""}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {STATUS_INSCRICAO[inscricao.status] ?? inscricao.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SheetFooter className="border-t">
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onEdit(detalhe.pessoa.id)}>
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onDelete(detalhe.pessoa.id)}
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

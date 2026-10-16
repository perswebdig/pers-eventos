"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, UserPlus, Users, Shield, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { formatCpf } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { Profile } from "@/types/database";

type Usuario = Profile & { pessoa_nome?: string | null };

async function fetchUsuarios(): Promise<Usuario[]> {
  try {
    const res = await fetch("/api/usuarios");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
    return (body as { data: Usuario[] }).data ?? [];
  } catch {
    return [];
  }
}

async function criarUsuario(values: {
  nome: string;
  email: string;
  password: string;
  papel: "tenant_admin" | "staff" | "cliente";
  pessoa_id?: string;
}) {
  const res = await fetch("/api/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
  return body.data;
}

async function atualizarUsuario(id: string, patch: Partial<Usuario>) {
  const res = await fetch(`/api/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
  return body.data;
}

async function deletarUsuario(id: string) {
  const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
}

const PAPEL_OPCOES: { value: "tenant_admin" | "staff" | "cliente"; label: string }[] = [
  { value: "tenant_admin", label: "Admin do Estabelecimento" },
  { value: "staff", label: "Recepção" },
  { value: "cliente", label: "Cliente" },
];

export function UsuariosView() {
  const [termo, setTermo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await fetchUsuarios();
      setUsuarios(data);
    } catch (err) {
      toast.error("Falha ao carregar usuários", { description: (err as Error).message });
      setUsuarios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          u.nome?.toLowerCase().includes(termo.toLowerCase()) ||
          u.email?.toLowerCase().includes(termo.toLowerCase()) ||
          u.papel?.toLowerCase().includes(termo.toLowerCase()),
      ),
    [usuarios, termo],
  );

  function abrirCriacao() {
    setEditing(null);
    setFormOpen(true);
  }

  function abrirEdicao(u: Usuario) {
    setEditing(u);
    setFormOpen(true);
  }

  async function handleSubmit(values: {
    nome: string;
    email: string;
    password: string;
    papel: "tenant_admin" | "staff" | "cliente";
    pessoa_id?: string;
  }) {
    setSalvando(true);
    try {
      if (editing) {
        await atualizarUsuario(editing.id, {
          nome: values.nome,
          papel: values.papel,
        });
        toast.success("Usuário atualizado");
      } else {
        await criarUsuario(values);
        toast.success("Usuário criado e convite enviado por e-mail");
      }
      setFormOpen(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível salvar", { description: (err as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletarUsuario(deleteId);
      toast.success("Usuário removido");
      setDeleteId(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível remover", { description: (err as Error).message });
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            {carregando ? "Carregando…" : `${filtrados.length} usuário(s)`}
          </p>
        </div>
        <Button onClick={abrirCriacao}>
          <UserPlus className="size-4" /> Convidar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome, e-mail ou papel"
          className="pl-8"
          aria-label="Buscar usuários"
        />
      </div>

      {carregando ? (
        <LoadingSkeleton count={3} />
      ) : filtrados.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Nome</th>
                    <th className="p-3 font-medium hidden md:table-cell">E-mail</th>
                    <th className="p-3 font-medium">Papel</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                            {u.nome?.slice(0, 1).toUpperCase() ??
                              u.email?.slice(0, 1).toUpperCase() ??
                              "?"}
                          </div>
                          <div>
                            <p className="font-medium">{u.nome ?? "—"}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-sm text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="gap-1">
                          {u.papel === "tenant_admin" && <Shield className="size-3" />}
                          {u.papel === "staff" && <Users className="size-3" />}
                          {u.papel === "cliente" && <Mail className="size-3" />}
                          {ROLE_LABEL[u.papel as keyof typeof ROLE_LABEL] ?? u.papel}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            u.ativo
                              ? "border-green-600/30 text-green-700 dark:text-green-500"
                              : "border-muted-foreground/30 text-muted-foreground"
                          }
                        >
                          {u.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirEdicao(u)}
                            aria-label={`Editar ${u.nome ?? u.email}`}
                          >
                            <UserPlus className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(u.id)}
                            aria-label={`Excluir ${u.nome ?? u.email}`}
                          >
                            <Mail className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={termo ? "search" : "users"}
          title={termo ? "Nenhum resultado" : "Nenhum usuário cadastrado"}
          description={
            termo
              ? "Tente outro nome, e-mail ou papel."
              : "Convide administradores e recepcionistas para seu estabelecimento."
          }
          actions={
            !termo ? (
              <Button onClick={abrirCriacao}>
                <UserPlus className="size-4" /> Convidar primeiro usuário
              </Button>
            ) : null
          }
        />
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar usuário" : "Convidar usuário"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere o papel e status do usuário."
                : "O convidado receberá um e-mail para definir a senha."}
            </DialogDescription>
          </DialogHeader>
          <UsuarioForm
            editing={editing}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            salvando={salvando}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário perderá acesso ao estabelecimento. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UsuarioForm({
  editing,
  onSubmit,
  onCancel,
  salvando,
}: {
  editing: Usuario | null;
  onSubmit: (values: {
    nome: string;
    email: string;
    password: string;
    papel: "tenant_admin" | "staff" | "cliente";
    pessoa_id?: string;
  }) => Promise<void>;
  onCancel: () => void;
  salvando: boolean;
}) {
  const [values, setValues] = useState({
    nome: editing?.nome ?? "",
    email: editing?.email ?? "",
    password: "",
    papel: (editing?.papel as "tenant_admin" | "staff" | "cliente") ?? "staff",
    pessoa_id: "",
  });

  useEffect(() => {
    if (editing) {
      setValues({
        nome: editing.nome ?? "",
        email: editing.email ?? "",
        password: "",
        papel: (editing.papel as "tenant_admin" | "staff" | "cliente") ?? "staff",
        pessoa_id: "",
      });
    } else {
      setValues({ nome: "", email: "", password: "", papel: "staff", pessoa_id: "" });
    }
  }, [editing]);

  async function handleSubmitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!values.nome.trim() || !values.email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    if (!editing && values.password.length < 6) {
      toast.error("A senha precisa de ao menos 6 caracteres");
      return;
    }
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmitForm} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="usuario_nome">Nome *</Label>
        <Input
          id="usuario_nome"
          value={values.nome}
          onChange={(e) => setValues({ ...values, nome: e.target.value })}
          autoComplete="name"
          disabled={!!editing}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="usuario_email">E-mail *</Label>
        <Input
          id="usuario_email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          autoComplete="email"
          disabled={!!editing}
        />
      </div>

      {!editing && (
        <div className="grid gap-1.5">
          <Label htmlFor="usuario_password">Senha inicial *</Label>
          <Input
            id="usuario_password"
            type="password"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            autoComplete="new-password"
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />
          <p className="text-xs text-muted-foreground">
            O usuário poderá alterar no primeiro acesso.
          </p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="usuario_papel">Papel *</Label>
        <select
          id="usuario_papel"
          value={values.papel}
          onChange={(e) =>
            setValues({ ...values, papel: e.target.value as "tenant_admin" | "staff" | "cliente" })
          }
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          {PAPEL_OPCOES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {editing ? "Salvar alterações" : "Enviar convite"}
        </Button>
      </div>
    </form>
  );
}

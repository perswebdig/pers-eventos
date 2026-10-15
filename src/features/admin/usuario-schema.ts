import { z } from "zod";

// Papéis que podem ser atribuídos pela API de gestão de usuários.
// `super_admin` nunca é atribuível por aqui (apenas via banco/seed).
export const USUARIO_PAPEIS = ["tenant_admin", "staff", "cliente"] as const;

export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
  papel: z.enum(["tenant_admin", "staff", "cliente"]),
  pessoa_id: z.string().trim().uuid("Pessoa inválida").optional().or(z.literal("")),
  tenant_id: z.string().trim().uuid().optional(),
});

export type UsuarioCreateValues = z.infer<typeof usuarioCreateSchema>;

export const usuarioUpdateSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  papel: z.enum(["tenant_admin", "staff", "cliente"]).optional(),
  ativo: z.boolean().optional(),
  pessoa_id: z.string().trim().uuid().nullable().optional(),
  password: z.string().min(6).optional(),
});

export type UsuarioUpdateValues = z.infer<typeof usuarioUpdateSchema>;

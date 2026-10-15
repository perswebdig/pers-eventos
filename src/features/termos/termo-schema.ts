import { z } from "zod";

export const TERMO_TIPO = [
  { value: "responsabilidade", label: "Termo de Responsabilidade" },
  { value: "imagem", label: "Termo de Uso de Imagem" },
] as const;

export type TermoTipo = (typeof TERMO_TIPO)[number]["value"];

export const termoTipoLabel = (value: string): string =>
  TERMO_TIPO.find((t) => t.value === value)?.label ?? value;

export const termoAceiteSchema = z.object({
  pessoa_id: z.string().min(1, "Pessoa obrigatória"),
  evento_id: z.string().optional(),
  tipo: z.enum(["responsabilidade", "imagem"]),
  assinatura_base64: z.string().min(1, "Assinatura obrigatória"),
});

export type TermoAceiteValues = z.infer<typeof termoAceiteSchema>;

export const termoTexto: Record<TermoTipo, string> = {
  responsabilidade: `TERMO DE RESPONSABILIDADE

Eu, abaixo assinado, declaro estar ciente dos riscos inerentes às atividades
realizadas em ambiente natural (trilhas, banhos de rio, exposição ao sol,
insetos, animais, etc.) e assumo total responsabilidade por minha integridade
física e pela de eventuais menores sob minha guarda durante a vivência.

Autorizo a equipe organizadora a prestar os primeiros socorros e a acionar
serviços de emergência caso necessário.

Estou ciente de que a organização não se responsabiliza por objetos de valor,
perdas ou danos a bens pessoais.`,
  imagem: `TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM E VOZ

Autorizo, de forma gratuita e por tempo indeterminado, o uso de minha imagem
e voz (fotografias, filmagens, depoimentos) captadas durante a vivência,
para fins de divulgação institucional do PersEventos em redes sociais, site,
materiais impressos e relatórios.

Esta autorização não gera nenhum direito de remuneração.`,
};
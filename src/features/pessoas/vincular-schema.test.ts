import { describe, expect, it } from "vitest";
import { interpretarBusca, vincularPessoaSchema } from "./vincular-schema";

describe("interpretarBusca", () => {
  it("detecta CPF com ou sem máscara", () => {
    expect(interpretarBusca("123.456.789-01")).toEqual({ cpf: "12345678901" });
    expect(interpretarBusca("12345678901")).toEqual({ cpf: "12345678901" });
  });

  it("detecta e-mail e normaliza para minúsculas", () => {
    expect(interpretarBusca("Pessoa@Exemplo.com")).toEqual({ email: "pessoa@exemplo.com" });
  });

  it("rejeita entrada vazia ou ambígua", () => {
    expect(interpretarBusca("")).toBeNull();
    expect(interpretarBusca("123")).toBeNull();
    expect(interpretarBusca("sem arroba")).toBeNull();
  });
});

describe("vincularPessoaSchema", () => {
  it("aceita CPF válido em qualquer formato", () => {
    const r = vincularPessoaSchema.safeParse({ cpf: "123.456.789-01", email: null });
    expect(r.success).toBe(true);
  });

  it("aceita somente e-mail", () => {
    const r = vincularPessoaSchema.safeParse({ email: "a@b.com" });
    expect(r.success).toBe(true);
  });

  it("exige CPF ou e-mail", () => {
    const r = vincularPessoaSchema.safeParse({ cpf: null, email: "" });
    expect(r.success).toBe(false);
  });

  it("rejeita CPF incompleto e e-mail inválido", () => {
    expect(vincularPessoaSchema.safeParse({ cpf: "123" }).success).toBe(false);
    expect(vincularPessoaSchema.safeParse({ email: "invalido" }).success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { onlyDigits, formatCpf, isValidCpf } from "@/lib/cpf";
import { formatTelefone, formatDate, formatDateTime, calcularIdade, ehMenor } from "@/lib/format";
import { pessoaSchema } from "@/features/pessoas/pessoa-schema";
import { eventoFormSchema } from "@/features/eventos/evento-schema";
import { parseInscricaoQr, encodeInscricaoQr } from "@/features/checkin/qr";
import { toCSV } from "@/lib/csv";

describe("lib/cpf", () => {
  describe("onlyDigits", () => {
    it("removes non-digits", () => {
      expect(onlyDigits("123.456.789-01")).toBe("12345678901");
      expect(onlyDigits("(11) 98888-7777")).toBe("11988887777");
      expect(onlyDigits("abc123")).toBe("123");
      expect(onlyDigits("")).toBe("");
    });
  });

  describe("formatCpf", () => {
    it("formats 11 digits", () => {
      expect(formatCpf("12345678901")).toBe("123.456.789-01");
    });
    it("handles already formatted", () => {
      expect(formatCpf("123.456.789-01")).toBe("123.456.789-01");
    });
    it("handles short input", () => {
      expect(formatCpf("123")).toBe("123");
    });
  });

  describe("isValidCpf", () => {
    it("accepts valid CPFs", () => {
      expect(isValidCpf("529.982.247-25")).toBe(true);
      expect(isValidCpf("111.444.777-35")).toBe(true);
      expect(isValidCpf("52998224725")).toBe(true);
    });
    it("rejects invalid CPFs", () => {
      expect(isValidCpf("111.111.111-11")).toBe(false);
      expect(isValidCpf("123.456.789-00")).toBe(false);
      expect(isValidCpf("123")).toBe(false);
      expect(isValidCpf("")).toBe(false);
    });
  });

  describe("formatTelefone", () => {
    it("formats 11 digits (mobile)", () => {
      expect(formatTelefone("11988887777")).toBe("(11) 98888-7777");
    });
    it("formats 10 digits (landline)", () => {
      expect(formatTelefone("1133334444")).toBe("(11) 3333-4444");
    });
  });
});

describe("lib/format", () => {
  describe("formatDate", () => {
    it("formats ISO date", () => {
      expect(formatDate("2026-07-15")).toBe("15/07/2026");
      expect(formatDate("2026-07-15T10:30:00")).toBe("15/07/2026");
    });
    it("handles null/undefined", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
    });
  });

  describe("formatDateTime", () => {
    it("formats with time", () => {
      const result = formatDateTime("2026-07-15T14:30:00");
      // jsdom locale format: "15/07, 14:30" (year omitted in short format)
      expect(result).toContain("15/07");
      expect(result).toContain("14:30");
    });
  });

  describe("calcularIdade", () => {
    it("calculates correct age", () => {
      const birthYear = new Date().getFullYear() - 25;
      const date = `${birthYear}-06-15`;
      expect(calcularIdade(date)).toBe(25);
    });
    it("handles birthday not yet this year", () => {
      const birthYear = new Date().getFullYear() - 25;
      const date = `${birthYear}-12-31`;
      expect(calcularIdade(date)).toBe(24);
    });
  });

  describe("ehMenor", () => {
    it("returns true for under 18", () => {
      const year = new Date().getFullYear() - 10;
      expect(ehMenor(`${year}-01-01`)).toBe(true);
    });
    it("returns false for 18+", () => {
      const year = new Date().getFullYear() - 25;
      expect(ehMenor(`${year}-01-01`)).toBe(false);
    });
  });
});

describe("schemas", () => {
  describe("pessoaSchema", () => {
    it("validates required nome_completo", () => {
      const result = pessoaSchema.safeParse({ nome_completo: "Ab" });
      expect(result.success).toBe(false);
      expect(result.error.issues.some((i) => i.path[0] === "nome_completo")).toBe(true);
    });

    it("validates CPF format", () => {
      const result = pessoaSchema.safeParse({
        nome_completo: "João Silva",
        cpf: "123.456.789-00",
      });
      expect(result.success).toBe(false);
    });

    it("validates email format", () => {
      const result = pessoaSchema.safeParse({
        nome_completo: "João Silva",
        email: "invalido",
      });
      expect(result.success).toBe(false);
    });

    it("requires consentimento_lgpd", () => {
      const result = pessoaSchema.safeParse({
        nome_completo: "João Silva",
        consentimento_lgpd: false,
      });
      expect(result.success).toBe(false);
    });

    it("requires responsible data for minors", () => {
      const year = new Date().getFullYear() - 10;
      const result = pessoaSchema.safeParse({
        nome_completo: "Criança",
        data_nascimento: `${year}-01-01`,
        consentimento_lgpd: true,
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some((i) => i.path[0] === "responsavel_nome")).toBe(true);
      expect(result.error.issues.some((i) => i.path[0] === "responsavel_cpf")).toBe(true);
    });

    it("accepts valid adult", () => {
      const result = pessoaSchema.safeParse({
        nome_completo: "João Silva",
        cpf: "529.982.247-25",
        rg: "",
        data_nascimento: "1990-01-01",
        telefone: "",
        email: "joao@email.com",
        endereco: "",
        contato_emergencia_nome: "",
        contato_emergencia_telefone: "",
        restricoes_alimentares: "",
        condicoes_saude: "",
        medicacoes: "",
        observacoes: "",
        consentimento_lgpd: true,
        responsavel_nome: "",
        responsavel_cpf: "",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid minor with responsible", () => {
      const year = new Date().getFullYear() - 10;
      const result = pessoaSchema.safeParse({
        nome_completo: "Criança",
        cpf: "",
        rg: "",
        data_nascimento: `${year}-01-01`,
        telefone: "",
        email: "",
        endereco: "",
        contato_emergencia_nome: "",
        contato_emergencia_telefone: "",
        restricoes_alimentares: "",
        condicoes_saude: "",
        medicacoes: "",
        observacoes: "",
        consentimento_lgpd: true,
        responsavel_nome: "Mãe",
        responsavel_cpf: "529.982.247-25",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("eventoFormSchema", () => {
    it("requires nome", () => {
      const result = eventoFormSchema.safeParse({ nome: "Ab" });
      expect(result.success).toBe(false);
    });

    it("requires data_inicio", () => {
      const result = eventoFormSchema.safeParse({ data_inicio: "" });
      expect(result.success).toBe(false);
    });

    it("validates data_fim >= data_inicio", () => {
      const result = eventoFormSchema.safeParse({
        data_inicio: "2026-07-10",
        data_fim: "2026-07-01",
      });
      expect(result.success).toBe(false);
    });

    it("validates capacidade as integer", () => {
      const result = eventoFormSchema.safeParse({
        capacidade: "2,5",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid event", () => {
      const result = eventoFormSchema.safeParse({
        nome: "Retiro",
        descricao: "",
        data_inicio: "2026-07-15",
        data_fim: "2026-07-20",
        local: "Local",
        capacidade: "30",
        status: "planejado",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("checkin/qr", () => {
  describe("encodeInscricaoQr", () => {
    it("adds prefix", () => {
      const id = "123e4567-e89b-12d3-a456-426614174000";
      expect(encodeInscricaoQr(id)).toBe(`PERS1:${id}`);
    });
  });

  describe("parseInscricaoQr", () => {
    it("parses with prefix", () => {
      const id = "123e4567-e89b-12d3-a456-426614174000";
      expect(parseInscricaoQr(`PERS1:${id}`)).toBe(id);
    });
    it("parses raw uuid", () => {
      const id = "123e4567-e89b-12d3-a456-426614174000";
      expect(parseInscricaoQr(id)).toBe(id);
    });
    it("rejects invalid", () => {
      expect(parseInscricaoQr("PERS1:invalid")).toBeNull();
      expect(parseInscricaoQr("not-a-uuid")).toBeNull();
      expect(parseInscricaoQr("")).toBeNull();
    });
  });
});

describe("reports/toCSV", () => {
  it("generates header + rows", () => {
    const csv = toCSV([
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe("a,b");
    expect(lines[1]).toBe("1,x");
    expect(lines[2]).toBe("2,y");
  });

  it("escapes commas and quotes", () => {
    const csv = toCSV([{ a: 'com"virgula', b: 1 }]);
    expect(csv).toContain('"com""virgula"');
  });

  it("handles empty array", () => {
    expect(toCSV([])).toBe("");
  });
});

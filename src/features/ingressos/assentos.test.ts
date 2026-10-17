import { describe, expect, it } from "vitest";
import { agruparPorFileira, rotuloAssento } from "./assentos";
import type { AssentoMapa } from "./assentos";

function assento(
  fileira: string,
  numero: number,
  status: AssentoMapa["status"] = "livre",
): AssentoMapa {
  return { id: `${fileira}${numero}`, fileira, numero, status };
}

describe("agruparPorFileira", () => {
  it("agrupa por fileira em ordem alfabética e números crescentes", () => {
    const grupos = agruparPorFileira([
      assento("B", 2),
      assento("B", 1),
      assento("A", 10),
      assento("A", 2),
    ]);
    expect(grupos.map((g) => g.fileira)).toEqual(["A", "B"]);
    expect(grupos[0].assentos.map((a) => a.numero)).toEqual([2, 10]);
    expect(grupos[1].assentos.map((a) => a.numero)).toEqual([1, 2]);
  });

  it("retorna vazio para lista vazia", () => {
    expect(agruparPorFileira([])).toEqual([]);
  });
});

describe("rotuloAssento", () => {
  it("junta fileira e número", () => {
    expect(rotuloAssento("C", 12)).toBe("C12");
  });
});

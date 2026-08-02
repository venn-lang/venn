import type { ActionContext } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { dataActions } from "../actions/index.js";
import { resetRng } from "../rng/index.js";
import { allFakerSpecs } from "./index.js";
import { pick } from "./primitives.js";

const ctx = {} as ActionContext;
const fakerActions = dataActions.filter((action) => action.name.startsWith("faker."));

function run(name: string, ...args: unknown[]): unknown {
  const action = fakerActions.find((candidate) => candidate.name === `faker.${name}`);
  if (!action) throw new Error(`no faker.${name}`);
  return action.run(ctx, { args, params: {} });
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Luhn, checked independently of the generator that produced the number. */
function passesLuhn(card: string): boolean {
  const digits = onlyDigits(card);
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const scaled = Number(digits[index]) * (double ? 2 : 1);
    sum += scaled > 9 ? scaled - 9 : scaled;
    double = !double;
  }
  return sum % 10 === 0;
}

function passesEan(code: string): boolean {
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(code[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

function passesIban(iban: string): boolean {
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  const expanded = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let rest = 0;
  for (const char of expanded) rest = (rest * 10 + Number(char)) % 97;
  return rest === 1;
}

function passesCpf(formatted: string): boolean {
  const digits = onlyDigits(formatted);
  const digitAt = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digitAt(9) === Number(digits[9]) && digitAt(10) === Number(digits[10]);
}

function passesCnpj(formatted: string): boolean {
  const digits = onlyDigits(formatted);
  const digitAt = (length: number): number => {
    const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2].slice(13 - length);
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (weights[index] ?? 0);
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return digitAt(12) === Number(digits[12]) && digitAt(13) === Number(digits[13]);
}

describe("faker catalogue", () => {
  it("exposes every spec as a data.faker.* verb, with no duplicate names", () => {
    expect(fakerActions).toHaveLength(allFakerSpecs.length);
    expect(new Set(allFakerSpecs.map((spec) => spec.name)).size).toBe(allFakerSpecs.length);
    expect(allFakerSpecs.length).toBeGreaterThan(60);
  });

  it("covers every category a form asks for", () => {
    expect(fakerActions.map((action) => action.name)).toEqual(
      expect.arrayContaining([
        "faker.email",
        "faker.name",
        "faker.uuid",
        "faker.creditCard",
        "faker.ipv4",
        "faker.city",
        "faker.company",
        "faker.price",
        "faker.iban",
        "faker.date",
        "faker.paragraph",
        "faker.int",
        "faker.boolean",
        "faker.br.cpf",
        "faker.br.cnpj",
      ]),
    );
  });

  it("draws every verb without throwing, honouring its declared return type", () => {
    resetRng();
    for (const spec of allFakerSpecs) {
      const value = run(spec.name);
      const declared = spec.result.kind === "prim" ? spec.result.name : "dynamic";
      const expected = declared === "bool" ? "boolean" : declared;
      expect(typeof value, `faker.${spec.name} declares ${declared}`).toBe(expected);
      if (expected === "string") expect(String(value)).not.toBe("");
    }
  });

  it("replays the whole catalogue identically after a reset", () => {
    resetRng();
    const first = allFakerSpecs.map((spec) => run(spec.name));
    resetRng();
    expect(allFakerSpecs.map((spec) => run(spec.name))).toEqual(first);
  });
});

describe("faker shapes", () => {
  it("produces well-formed identity and network values", () => {
    resetRng();
    expect(String(run("email"))).toMatch(/^[a-z-]+\.[a-z-]+@[a-z.]+$/);
    expect(String(run("uuid"))).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(String(run("ipv4"))).toMatch(/^(\d{1,3}\.){3}\d{1,3}$/);
    expect(String(run("mac"))).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
  });

  it("produces well-formed dates and times", () => {
    resetRng();
    expect(String(run("date"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(run("time"))).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(String(run("dateTime"))).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(String(run("pastDate"))).getTime()).toBeLessThan(Date.UTC(2025, 0, 1));
    expect(new Date(String(run("futureDate"))).getTime()).toBeGreaterThan(Date.UTC(2025, 0, 1));
  });

  it("keeps the credit-card grouping callers already depend on", () => {
    resetRng();
    expect(String(run("creditCard"))).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/);
  });

  it("honours positional arguments", () => {
    resetRng();
    expect(String(run("hex", 32))).toHaveLength(32);
    expect(String(run("nanoid", 10))).toHaveLength(10);
    expect(String(run("digits", 4))).toMatch(/^\d{4}$/);
    expect(String(run("words", 5)).split(" ")).toHaveLength(5);
    for (let index = 0; index < 20; index += 1) {
      expect(Number(run("int", 1, 6))).toBeGreaterThanOrEqual(1);
      expect(Number(run("int", 1, 6))).toBeLessThanOrEqual(6);
    }
  });

  it("stays inside geographic bounds", () => {
    resetRng();
    for (let index = 0; index < 20; index += 1) {
      expect(Math.abs(Number(run("latitude")))).toBeLessThanOrEqual(90);
      expect(Math.abs(Number(run("longitude")))).toBeLessThanOrEqual(180);
    }
  });
});

describe("faker check digits", () => {
  it("generates card numbers that pass Luhn", () => {
    resetRng();
    for (let index = 0; index < 30; index += 1) {
      expect(passesLuhn(String(run("creditCard")))).toBe(true);
    }
  });

  it("generates barcodes that pass the EAN-13 check", () => {
    resetRng();
    for (let index = 0; index < 30; index += 1) {
      expect(passesEan(String(run("barcode")))).toBe(true);
    }
  });

  it("generates IBANs that pass mod-97", () => {
    resetRng();
    for (let index = 0; index < 30; index += 1) {
      expect(passesIban(String(run("iban")))).toBe(true);
    }
  });

  it("generates CPFs a Brazilian form would accept", () => {
    resetRng();
    for (let index = 0; index < 30; index += 1) {
      const cpf = String(run("br.cpf"));
      expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
      expect(passesCpf(cpf), cpf).toBe(true);
    }
  });

  it("generates CNPJs a Brazilian form would accept", () => {
    resetRng();
    for (let index = 0; index < 30; index += 1) {
      const cnpj = String(run("br.cnpj"));
      expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      expect(passesCnpj(cnpj), cnpj).toBe(true);
    }
  });

  it("generates Mercosul plates, CEPs and mobile numbers", () => {
    resetRng();
    expect(String(run("br.plate"))).toMatch(/^[A-Z]{3}\d[A-Z]\d{2}$/);
    expect(String(run("br.cep"))).toMatch(/^\d{5}-\d{3}$/);
    expect(String(run("br.phone"))).toMatch(/^\(\d{2}\) 9\d{4}-\d{4}$/);
  });
});

/**
 * Its own guard, which nothing in this package can reach: every list it draws
 * from is a constant with something in it. Kept because the day one is built
 * from data it will be reachable, and refused with a code like everything else.
 */
describe("drawing from a list with nothing in it", () => {
  it("refuses, rather than answering with nothing", () => {
    expect(() => pick([], () => 0)).toThrow(/nothing to pick from/);
  });
});

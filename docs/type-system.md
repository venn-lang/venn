# Tipos da Venn

Como a linguagem sabe o que as coisas são, e como isso conversa com TypeScript sem virar TypeScript.
A spec ([`venn-language.md`](venn-language.md)) diz *o que* a linguagem faz; este arquivo diz *como os tipos chegam lá*.

---

## O problema

```flow
http.on api req => route(req)
```

Qual é o tipo de `req`? Antes deste desenho: nenhum. Toda chamada de verbo produzia `dynamic`, então
`req.url` não completava, `req.qualquerCoisa` passava calado, e o desenvolvedor escrevia às cegas.

Não faltava sistema de tipos — o núcleo já tem inferência Hindley-Milner com unificação, variáveis
frescas e propagação para callbacks. **Faltava fonte**: `checkTypes(document)` recebia o arquivo e mais
nada, e não tinha como saber o que `http.serve` devolve.

---

## As três peças

### 1. `TypeSpec` — a moeda (`@venn-lang/types`)

O vocabulário de tipos como **dado puro**: sem funções, sem `Map`, sem variáveis de inferência.
Sobrevive a `JSON.stringify`, e é por isso que uma assinatura escrita à mão hoje e uma gerada de um
`.d.ts` amanhã são **os mesmos bytes**. Dez formas, e nada além:

`prim` · `literal` · `list` · `map` · `record` · `fn` · `union` · `opaque` · `ref` · `dynamic`

O `Type` interno do compilador é outra coisa (tem variáveis que a unificação escreve). A separação é
deliberada: nada mutável entra num manifesto.

### 2. `TypeCatalog` — o canal (`@venn-lang/core` pergunta, `@venn-lang/runtime` responde)

```ts
interface TypeCatalog {
  typeOf(name: string): Type | undefined;        // http.Request
  signatureOf(target: string): FnType | undefined; // http.on
}
```

O core continua sem saber o que é um plugin — ele **pergunta**. Quem tem o registro (runtime, LSP)
responde. `createTypeCatalog(plugins)` qualifica os nomes uma vez: o plugin diz `Request`, o flow
escreve `http.Request`.

### 3. A projeção TS → Venn

A fonte da verdade é o TypeScript, porque é o que o ecossistema já escreve — inclusive a nossa própria
stdlib. O compilador do TS resolve genéricos, condicionais e mapeados; a projeção lê **a resposta**,
não a maquinaria.

| TypeScript | Venn | Observação |
| --- | --- | --- |
| `Promise<T>` | `T` | a espera implícita da linguagem **é** a regra de projeção |
| `string` `number` `boolean` | `prim` | |
| `"a" \| "b"` | `union` de `literal` | vira enum de verdade no editor |
| `interface { … }` | `record` | daqui saem `req.url`, `req.method` |
| `campo?: T` | campo `T \| null` | ausência dita em voz alta, e escrevível assim também |
| `Record<string, T>` / index signature | `map` | |
| `(req: R) => S` | `fn([R], S)` | **é isto que tipa o `req`** |
| `class` / handle (`Server`, `Socket`) | `opaque` | não vira record de 200 membros |
| `any` `unknown` genérico livre | `dynamic` | total, nunca gera erro |
| JSX, decorators, `this` types, símbolos | fora | overload → primeira assinatura ou união |

**Regra de ouro: a projeção nunca falha — degrada.** Nenhum plugin fica bloqueado esperando fidelidade
total, e um plugin que não diz nada sobre tipos continua sendo um plugin que funciona.

---

## Nada não é alguma coisa

`T | null` não entra onde se pede `T`. Vale em binding, argumento, retorno,
campo e elemento de lista:

```venn
type User = { name: string | null }

const mostrado: string = u.name     # VN3010 · expected string, found string | null
fn grita(s: string) -> string => s.upper
const alto = grita(u.name)          # o mesmo, apontando o argumento
```

A pergunta que a atribuição faz é direcional, e é por isso que precisa de nome
próprio: `unify` pergunta se dois tipos **podem ser iguais**, o que uma união e
um dos seus membros podem, escolhendo o membro que serve. O membro que fica para
trás é exatamente o nada que ninguém tratou.

Três saídas, todas escritas na linguagem:

```venn
const a: string = u.name ?? "anônimo"    # um valor para ficar no lugar

if u.name != null {
  const b: string = u.name               # a guarda, no campo
}

const guardado = u.name
if guardado != null {
  const c: string = guardado             # ou no nome
}
```

A guarda sobre um campo estreita o **registo**, não o campo: um escopo liga
nomes, então o que se escreve é `u` com aquele campo estreitado. Ler o campo
depois lê o registo estreitado, que é a mesma resposta por um caminho que o
escopo já tinha.

## `opaque` é a fronteira

Projetar uma classe do JS como record arrastaria `EventEmitter`, símbolos, herança — o grafo de objetos
de outra linguagem para dentro desta. Um `opaque` tem nome e não tem dentro: segura-se, passa-se para os
verbos do próprio namespace, e nada mais. `api.` num `http.Server` oferece **zero** membros, de propósito.

É o que permite usar libs do Node sem herdar o modelo mental do Node.

---

## O que roda hoje

- `const api = http.serve { port: 0 }` → `api: http.Server` (idem `resource`)
- `http.on api req => …` → `req: { method: string, url: string, headers, body }` **sem anotação**
- `const res = http.get "…"` → `res.status`, `res.json`
- `fn route(req: http.Request)` → anotação qualificada resolve pelo catálogo
- verbo sem assinatura → `dynamic`, como antes

### Zero anotação, inclusive em `fn` nomeada

```flow
http.on api req => route(req)   # o verbo diz o que entrega ao handler
fn route(req) { req.url … }     # e a chamada acima diz o que `route` recebe
```

O verbo tipa o lambda por *contextual typing* (como no TS). A `fn` nomeada é o caso que o TS **não**
resolve — lá `function route(req)` é `any`. Aqui resolvemos, porque anotar por obrigação contradiz a
linguagem.

**Como:** duas passadas ([`seed-params.ts`](../packages/core/src/typecheck/seed-params.ts)). A primeira
roda em silêncio com as `fn` **monomórficas** — é a generalização que impede o chamador de alcançar a
declaração, já que cada uso instancia uma cópia fresca. Lê-se o que ficou decidido, joga-se o resto
fora, e a passada real começa dali, como se estivesse escrito.

**Salvaguardas**, porque um palpite errado é pior que nenhum:

- Nada é aproveitado de arquivo que já tem conflito de tipo — o primeiro chamador teria vencido por
  acidente, e o palpite viraria um erro que o autor não cometeu.
- Só atravessa tipo **totalmente resolvido** ([`solidify.ts`](../packages/core/src/typecheck/solidify.ts));
  variável em aberto pertence ao contexto daquela passada e não sai de lá.
- Anotação escrita sempre vence.
- Helper sem chamador, ou com chamadores que discordam, continua polimórfico.

## O que falta

1. **`@venn-lang/tsgen`** — ler `.d.ts` e emitir `TypeSpec`. A tabela acima vira o TCK do gerador.
   Enquanto não existe, as assinaturas são escritas à mão (ver `std-http/src/types.ts`); quando existir,
   aquele arquivo some e **nenhum consumidor muda**.
2. **Assinar o resto da stdlib** — hoje só `@venn-lang/http` está tipado.
3. **`map` de verdade no checker** — hoje um `map(V)` vira record aberto, então `headers.auth` é
   `dynamic` em vez de `string`.
4. **Inferir `fn` de topo pelo uso** — `fn route(req)` sem anotação continua livre. Anotar é a saída
   honesta; inferência a partir do uso é onde sistemas de tipos viram poço sem fundo.
5. **Uniões estreitando** — `unify` aceita uma união por compatibilidade de membro, sem narrowing por
   `if`.

## O que deliberadamente não faremos

- Portar o sistema de tipos do TS (condicionais, mapeados, variância). É exatamente aí que a
  contaminação mora, e é um projeto sem fim.
- Validar em runtime tudo que o tipo promete. Zod nos params, sim; no retorno de tudo, não — mata a
  velocidade.
- Tornar anotação obrigatória. `dynamic` é cidadão de primeira classe: a linguagem tem que rodar com
  zero tipo escrito.

_Especificação de linguagem_

# Venn

_Uma linguagem para descrever testes end-to-end como fluxos. O kernel é minúsculo e imutável; todo poder real — HTTP, browser, MQTT, WebSocket, GraphQL, e-mail, banco — chega como biblioteca. O texto e o node graph são a mesma coisa vista de dois ângulos._


---

## 00 · Quatro camadas, uma regra

A regra que sustenta tudo: **a gramática não conhece nenhum verbo de teste**. Ela conhece estrutura — blocos, steps, controle de fluxo, expressões. Os verbos (`http.post`, `browser.click`, `mqtt.publish`) vivem num registry em runtime. Adicionar protocolo novo nunca toca no parser.

_[diagrama: Pilha de camadas da Venn]_

**Por que travar o kernel** — Gramática fixa significa parser gerado uma vez, highlight estável, e node graph que nunca quebra. Um plugin novo não invalida arquivos existentes.

**Por que stdlib não é built-in** — Se `browser` fosse embutido, todo arquivo carregaria Playwright. Com o import explícito o runner sabe exatamente quais recursos subir, e o teste de API roda em milissegundos.


---

## 01 · Arquitetura provider-based

O núcleo não sabe o que é HTTP, o que é um arquivo, o que é o relógio ou onde um artefato é gravado. Ele conhece **portas** — contratos tipados — e recebe implementações prontas no arranque. Adicionar recurso vira assinar um contrato existente; remover vira desligar uma implementação.

> **A regra que impede isso de virar sopa de plugin.** "Tudo é provider" levado ao literal produz o modo de falha oposto: dezenas de abstrações com uma implementação só, imposto de indireção em código que nunca vai variar, e um núcleo tão fino que nada funciona sem montar meia dúzia de peças. A disciplina que paga é outra — **duas implementações ou não é porta**. Todo contrato nasce com pelo menos duas implementações no mesmo commit: a real e o dublê usado em teste. Se você não consegue nomear a segunda, não é porta, é módulo com interface boa. E como o dublê é obrigatório, o sistema inteiro fica testável sem I/O de graça.

_[diagrama: Núcleo agnóstico cercado por quatro famílias de portas]_

### O catálogo de portas

Cada linha lista as duas implementações que existem desde o primeiro commit. Se a coluna da direita ficasse vazia, a porta não deveria existir.

| Porta | Responsabilidade | Implementações no dia um |
| --- | --- | --- |
| FileSystem | Ler e escrever bytes | node-fs · memory |
| ProcessProvider | Subir subprocesso (driver, k6) | node-spawn · fake |
| Clock | Agora, dormir, prazos | system · virtual |
| Random | Aleatoriedade determinística | seeded · fixed |
| SecretProvider | Resolver `secrets.*` com marca de redação | env · vault · memory |
| SourceProvider | De onde vem o texto `.vn` | fs · memory (LSP) |
| ModuleResolver | Resolver `@venn-lang/*`, `./`, `#alias` | fs · registry · memory |
| ManifestProvider | Ler `venn.toml` | toml · memory |
| CapabilityProvider | É o que um plugin assina | 16 pacotes stdlib |
| Scheduler | Ordem e concorrência de execução | sequential · worker-pool |
| LockProvider | Semântica de `@lock` e `@serial` | in-process · file · redis |
| EventSink | Destino do fluxo de eventos | memory · ndjson |
| Reporter | Consumidor do fluxo | dot · spec · junit · html · ndjson |
| ArtifactStore | Guardar trace, vídeo, HAR | fs · memory · s3 |
| StateStore | Histórico de runs e de instabilidade | jsonl · sqlite · memory |
| LayoutProvider | Posicionar nós no grafo | elk · manual |

> **A porta `FileSystem` não é preciosismo — é o que faz o compilador rodar nos dois lugares.** O pacote `core/` precisa executar num Web Worker (para o LSP) e no Node (para o CLI). Um único `import fs from "node:fs"` vazando pra dentro dele quebra o editor, e você só descobre tarde. Com a porta, o vazamento é erro de compilação.

### Como as implementações chegam

Sem contêiner de injeção, sem decorator, sem resolução em runtime. Um objeto `Host` montado no ponto de entrada e passado adiante. É verificável pelo compilador, trivial de fabricar em teste, e não falha em produção por chave não registrada.

****packages/contracts/host.ts**o núcleo recebe isto e não importa mais nada**

```ts
export type Host = {
  fs:      FileSystem
  proc:    ProcessProvider
  clock:   Clock
  random:  Random
  secrets: SecretProvider
  log:     Logger
  caps:    HostCapability[]     // ["process", "fs", "net"] — o worker não tem todas
}

// três montagens, nenhuma lógica
export const createHost = {
  node:   ()            => ({ fs: nodeFs(), proc: nodeSpawn(), clock: systemClock(), … }),
  worker: ()            => ({ fs: memoryFs(), proc: unavailable("process"), …, caps: ["fs"] }),
  test:   (o?: Partial<Host>) => ({ …allFakes(), …o }),
};
```

### Negociação de capacidade

Um plugin declara de que portas do host precisa. Se o host não oferece — o Web Worker não tem `process` —, o carregamento falha com diagnóstico legível em vez de estourar no meio de um teste.

****packages/contracts/port.ts**o padrão que toda porta segue**

```ts
export interface Port<T> {
  id:       string                // "venn.port.artifacts"
  version:  number                // contrato, não do pacote
  schema:   ZodType<T>            // valida a implementação no registro
  requires: HostCapability[]
}

export const ArtifactStorePort: Port<ArtifactStore> = {
  id: "venn.port.artifacts", version: 1, requires: ["fs"],
  schema: z.object({
    put:  z.function([z.string(), z.instanceof(Uint8Array)], z.promise(ArtifactRef)),
    get:  z.function([ArtifactRef], z.promise(z.instanceof(Uint8Array))),
    list: z.function([z.string()], z.promise(z.array(ArtifactRef))),
  }),
};
```

### Suíte de conformidade — o que torna a promessa verdadeira

"Assinar o contrato garante o funcionamento" só é verdade se o contrato for executável. Cada porta publica uma suíte parametrizada que **toda** implementação roda, inclusive os dublês. É o mesmo mecanismo de um TCK: a suíte é a especificação, a prosa é comentário.

****packages/contracts/conformance/artifacts.suite.ts****

```ts
export function artifactStoreConformance(
  name: string,
  factory: () => Promise<ArtifactStore>,
) {
  describe(`ArtifactStore · ${name}`, () => {

    it("devolve exatamente os bytes gravados", async () => {
      const s = await factory();
      const ref = await s.put("trace.zip", bytes);
      expect(await s.get(ref)).toEqual(bytes);
    });

    // leis algébricas viram propriedade, não exemplo
    it("put é idempotente por conteúdo", () =>
      fc.assert(fc.asyncProperty(fc.uint8Array(), async (b) => {
        const s = await factory();
        expect(await s.put("a", b)).toEqual(await s.put("a", b));
      })));

    it("erro de referência ausente é VN8xxx, nunca exceção crua", async () => {
      const s = await factory();
      await expect(s.get(missing)).rejects.toMatchObject({ code: /^VN8/ });
    });
  });
}

// todas as implementações rodam a mesma suíte — inclusive o dublê
artifactStoreConformance("fs",     () => fsStore(tmp()));
artifactStoreConformance("memory", () => memoryStore());
artifactStoreConformance("s3",     () => s3Store(minio()));
```

Plugin de terceiro roda a mesma coisa por linha de comando, e o resultado é publicável:

****verificação de plugin**shell**

```bash
$ venn verify-plugin ./dist/index.js

✓ CapabilityProvider v1        14 asserções
✓ ActionProvider               38 asserções · 6 ações
✓ ResourceProvider             12 asserções · abertura e fecho ordenados
✓ MatcherProvider              9 asserções · mensagens não vazias
✓ NodeSpec                     7 asserções · portas e ícone válidos
✗ Redação de segredos          1 falha
    stripe.charge emitiu params.card sem marca de redação
    → envolva com ctx.redact() antes de retornar

80/81 · assinatura não emitida
```

### Versão e remoção

Você pediu que **remover** fosse tão trivial quanto adicionar. Isso exige que remoção seja um processo definido, não um `git rm`:

| Fase | O que acontece | Quem percebe |
| --- | --- | --- |
| 1 · Marcar | Ação ou porta recebe `deprecated` no registry, com substituto apontado | Hover no editor, tachado |
| 2 · Avisar | Diagnóstico `VN5001` com correção rápida automática | Aviso amarelo, um clique resolve |
| 3 · Migrar | `venn fix --deprecations` reescreve os arquivos | Diff no controle de versão |
| 4 · Remover | Sai no próximo major; `version` da porta incrementa | Erro `VN2xxx` com link para o guia |

O núcleo suporta a versão corrente e a anterior de cada porta. Plugin declara `apiVersion`; incompatibilidade é recusada no carregamento com mensagem clara, nunca com falha em runtime no meio de uma suíte.

### O que deliberadamente não é provider

Estas peças têm interface boa e implementação única, e transformá-las em porta só adicionaria indireção sem nunca ganhar uma segunda implementação:

| Peça | Por que fica fixa |
| --- | --- |
| Parser e gramática | Uma linguagem, uma gramática. Segunda implementação seria divergência, não recurso. |
| Esquema da IR | É o contrato central. Torná-lo trocável destrói a garantia que ele existe para dar. |
| Avaliador de expressões | Semântica da linguagem. Precedência trocável significa que o mesmo arquivo tem dois sentidos. |
| A palavra `expect` | Os matchers são providers; o mecanismo de asserção é kernel. |
| Modelo `Problem` | Uma forma de erro, muitos renderizadores. O renderizador é que é porta. |

> **O teste que resolve a dúvida em qualquer caso novo.** Escreva o nome da segunda implementação antes de escrever a interface. Se o nome sair fácil — `memory`, `fake`, `s3`, `redis`, `sequential` — é porta. Se você precisar inventar um cenário hipotético para justificar, é módulo. Essa única pergunta mantém o núcleo pequeno sem sacrificar nada do desacoplamento que você quer.


---

## 02 · Kernel — a gramática fixa

Estas são todas as palavras reservadas. Nada além disto entra na gramática, nunca.

| Grupo | Palavras | Papel |
| --- | --- | --- |
| Módulo | module use import from as pub | Identidade e fronteiras do arquivo |
| Declaração | const let type fn fragment deco | Valores, formas e helpers |
| Configuração | config env matrix report | Ambiente e saída da suíte |
| Estrutura | flow step group | Unidades executáveis |
| Ciclo de vida | setup teardown beforeEach afterEach on defer | Ganchos determinísticos |
| Controle | if else forEach in repeat loop parallel race try catch finally break continue return run | Composição de execução |
| Asserção | expect capture | Verificação e extração |
| Literal | true false null | Constantes da linguagem |

Tudo o mais é chamada de ação, e chamada de ação tem uma forma só:

****forma canônica da chamada**o registry valida namespace, nome e parâmetros**

```venn
namespace.acao arg_posicional_1 arg_posicional_2 { opcao: valor, outra: valor }

# exemplos reais
http.post "/api/auth/login" { json: { email: user.email, password: secrets.pw } }
browser.click "[data-add=sku-42]" { timeout: 5s }
mqtt.publish "inventory/sku-42" { json: { delta: -1 }, qos: 1 }
db.exec "TRUNCATE orders CASCADE"
```

> **Mudança em relação ao protótipo.** Caminhos deixam de ser bare tokens (`POST /api/auth/login`) e passam a ser strings. Isso remove a ambiguidade fatal entre caminho e regex — `/success` versus `/Order #(\d+)/` — que impediria o lexer de decidir sem lookahead semântico. O açúcar `POST "/x"` continua disponível como alias do `http`.


---

## 03 · Literais e tipos

****todos os literais da linguagem****

```venn
# texto
"simples"
"interpolado: ${user.email} — total ${order.total}"
r"C:\raw\sem\escape"
"""
  bloco multilinha
  preserva quebras
"""

# números com unidade — unidade faz parte do tipo, não é sufixo decorativo
42          2.5         -7
300ms       1.5s        2m        1h        24h
512b        2kb         8mb       1gb
0.1%        99.9%

# outros
true   false   null
[1, 2, 3]
{ chave: "valor", aninhado: { a: 1 } }
2026-07-23T12:00:00Z          # instante ISO-8601 é literal de primeira classe
```

**Padrão não tem literal próprio, tem tipo.** `regex(…)` compila um, e `regex` é
o tipo dele. A string crua é como o padrão se escreve, porque preserva cada barra
invertida; as flags vão dentro dele ou como segundo argumento:

```venn
const pedido = regex(r"Order #(\d+)")

expect (corpo ~= pedido)         # o operador
expect pedido.test(corpo)        # a mesma pergunta, como membro
let n = pedido.match(corpo)[1]   # o grupo, que é a razão de capturar

print pedido.source              # Order #(\d+)
```

Compilar onde se escreve tem duas consequências: um `~=` dentro de um loop
compila uma vez em vez de a cada passada, e um padrão que não compila é recusado
por `venn check`, na linha que o escreveu, e não na que o usou.

`~=` continua aceitando texto, então `corpo ~= r"Order #\d+"` vale o mesmo. O
padrão compilado é a forma melhor quando o mesmo padrão é usado mais de uma vez.

O literal `/padrão/i` foi descartado pela mesma razão que caminho deixou de ser
bare token (§02): `/` é divisão, e distinguir os dois exigiria do lexer um
lookahead semântico. A string crua não custa nada disso e diz a mesma coisa.

### Tirando um valor de dentro de outro

Onde cabe um nome, cabe um padrão. Ele espelha o literal que lê: `{ … }` um mapa,
`[ … ]` uma lista, e um nome sozinho o valor inteiro, que é o que faz os três se
aninharem.

```venn
const { id, total } = pedido            # dois nomes, dois campos
const { id: referencia } = pedido       # o campo sob outro nome
const { cliente: { cidade } } = pedido  # e mais fundo
const [primeiro, segundo] = par         # lista, por posição

forEach { nome, idade } in pessoas { … }
fn rotulo({ nome, idade }) => "${nome}/${idade}"
fragment mostra({ total }: Pedido) { … }
```

Do outro lado do sinal de igual, `...` despeja em vez de guardar:

```venn
const ys = [0, ...xs, 5]              # lista dentro de lista
const c = { ...padroes, timeout: 5s } # mapa dentro de mapa, o último ganha
```

O tipo acompanha: lista continua homogênea, e o mapa fica com os campos dos dois,
com o que veio depois ganhando de quem veio antes. Despejar algo cuja forma
ninguém sabe deixa o literal inteiro desconhecido, porque qualquer campo pode ter
sido o sobrescrito.

`a.merge(b)` responde a mesma pergunta que `{ ...a, ...b }`, e agora responde com
o mesmo tipo; `a.mergeDeep(b)` desce nos mapas aninhados em vez de trocar o galho.

`...nome` no fim leva o que o padrão não nomeou: os outros campos como um mapa,
ou os itens depois do último, como lista.

```venn
const { id, ...corpo } = pedido     # corpo é o Pedido sem o `id`
const [primeiro, ...resto] = xs     # resto é uma lista do mesmo
```

O tipo acompanha: o resto de uma forma é a forma sem os campos que saíram, então
`corpo.id` é erro; o resto de um `map<V>` continua `map<V>`, porque tirar chaves
muda quantas são e não o que elas guardam.

Vale em binding, parâmetro (de `fn` e de `fragment`) e variável de loop. Um `deco`
é a exceção: ele recebe os argumentos por nome, na ordem em que `@nome(…)` os
preenche, então um padrão ali não teria o que separar e é recusado.

**Campo que a forma não tem é erro onde está escrito**, e é isso que o padrão
ganha da anotação:

```venn
type Pedido { id: string, total: number }
const { totl } = pedido    # VN3010: Pedido não tem campo "totl"
```

Sem anotação nenhuma o checker não inventa: um valor cuja forma ninguém sabe se
deixa separar em silêncio, como qualquer outro acesso a campo.

### Arquivos não podem se importar em círculo

Dois arquivos que se importam são recusados, com o caminho da volta nomeado:

```
VN2021 · Importing "./a.vn" here closes a circle.
  see   a.vn:1:1  imports b.vn
  see   b.vn:1:1  imports a.vn
```

Não é preciosismo. Um `const` no topo de um arquivo é avaliado quando o arquivo
é, e um `pub fn` fecha sobre o arquivo onde foi escrito, então não há içamento
onde se esconder: um dos lados lê o que o outro ainda não preencheu, e qual dos
dois depende de por qual arquivo a execução entrou primeiro.

A saída é sempre a mesma: o que os dois precisam vai para um terceiro arquivo,
que os dois importam. Costuma ser o desenho que se queria desde o começo.

### Uma única ausência

`null` é a ausência da linguagem, e é a única. Ler um membro que ninguém pôs,
passar do fim de uma lista, ou nomear o que nada ligou dá `null`, nunca outra
coisa:

```venn
const dados = json.parse(texto)

dados.faltando == null      # true
lista[999] == null          # true
dados.faltando ?? "padrão"  # "padrão"
```

Isso importa porque a igualdade é estrita e não converte nada: se a ausência
tivesse duas formas, `== null` responderia sobre uma e não sobre a outra, e a
guarda mais comum que existe pegaria o ramo errado sem avisar.

### Tipos nominais

Declarar tipo não é burocracia: é o que dá autocomplete em `user.` dentro do editor e o que gera o formulário de propriedades do nó no grafo.

****type****

```venn
type Plan = "free" | "pro" | "enterprise"

type User {
  email:    string
  name:     string
  plan:     Plan
  credits?: int          # `?` marca opcional
  address:  { city: string, zip?: string }   # forma escrita onde é usada
}

Uma forma pode ser escrita no lugar de um nome, em qualquer posição onde um tipo
cabe: campo, parâmetro, retorno, binding, e dentro de um genérico.

```venn
fn onde(u: { city: string }) -> string => u.city
const pedido: { id: number, itens: list<{ sku: string }> } = { id: 1, itens: [] }
```

As duas grafias são o mesmo tipo: um valor de um `type Address { city: string }`
serve onde se espera `{ city: string }`, e o contrário também. Nomear vale quando
a forma se repete ou merece um nome; escrever inline vale quando ela é usada uma
vez só.

const BASE_TIMEOUT = 30s
```

| Tipo | Origem | Notas |
| --- | --- | --- |
| string int float bool | kernel | Primitivos |
| null | kernel | A ausência de valor. `T \| null` é o que `campo?: T` já constrói, agora escrevível |
| duration size percent | kernel | Aritmética com unidade é verificada: `300ms + 1s` vale, `300ms + 2mb` é erro |
| regex instant json | kernel | `json` é o tipo dinâmico de escape. Um `instant` responde `.year`, `.date`, `.plus(2h)`, `.until(outro)` |
| list<T> map<V> | kernel | Genéricos só nestes dois. `map<string, V>` é a mesma coisa: a chave é um nome de qualquer jeito |
| Response Page Message Row | stdlib | Plugins registram tipos próprios |

Um plugin publica assinatura polimórfica, e o editor infere através dela:

```venn
import { data } from "venn/data"

const escolhido = data.oneOf("a", "b")     # string, não `dynamic`
const baralho = data.shuffle([1, 2, 3])    # list<number>, ainda
```

Do lado do plugin, `t.param("T")` é o que diz isso: o mesmo nome é o mesmo tipo
dentro de uma assinatura, e cada chamada recebe os seus, então duas chamadas do
mesmo verbo no mesmo arquivo não decidem uma pela outra.

****União discriminada****

Uma união de formas com um campo que as separa é decidível: dentro do `if`, o
valor é uma delas e só ela, e o campo daquela forma está lá para ser lido.

```venn
type Ping { kind: "ping", at: number }
type Text { kind: "text", body: string }
type Close { kind: "close", why: string }
type Message = Ping | Text | Close

fn descreve(m: Message) -> string => (
  m.kind == "ping" ? "ping em ${m.at}"
  : m.kind == "text" ? "texto: ${m.body}"
  : "fechou: ${m.why}"
)
```

`T | null` é a união mais comum de todas, e estreita igual: depois de
`if achado != null`, o valor está lá.

```venn
fn nomeDe(u: User | null) -> string => u == null ? "ninguém" : u.name
```

Fora do estreitamento, `m.body` é erro: a mensagem pode ser uma das outras duas.
`if`, `else`, `!=` e `&&` estreitam do mesmo jeito, e o `else` de uma cadeia
carrega o que nenhum ramo levou.

Uma cadeia que lista os casos precisa listar todos. Sem `else`, o que ficou de
fora é **VN3019**; um ramo que testa um valor que a união nunca carrega, ou que
um ramo anterior já levou, é **VN3020**.

```venn
if m.kind == "ping" { … }
else if m.kind == "text" { … }
# VN3019: nada aqui diz o que fazer quando m.kind é "close"
```

Um `if` sozinho faz uma pergunta e não é cobrado por isso. A cobrança é da
cadeia, que se propõe a enumerar.


---

## 04 · Expressões

Mini-linguagem completa, com precedência definida. É a parte que todo projeto de DSL subestima e depois reescreve.

| Nível | Operadores | Assoc. |
| --- | --- | --- |
| 1 | a.b a?.b a[i] f(x) | esquerda |
| 2 | ! - (unário) | direita |
| 3 | * / % | esquerda |
| 4 | + - | esquerda |
| 5 | < <= > >= in | esquerda |
| 6 | == != ~= (regex match) | esquerda |
| 7 | && | esquerda |
| 8 | \|\| | esquerda |
| 9 | ?? (coalescência) | direita |
| 10 | cond ? a : b | direita |

****expressões em uso****

```venn
let elegivel = user.plan != "free" && (user.credits ?? 0) > 10
let saudacao = "Olá, ${user.name ?? "visitante"}"
let numero   = mail.body ~= r"Order #(\d+)"
let dentro   = res.time < 300ms && res.size < 2mb
let membro   = user.plan in ["pro", "enterprise"]
```


---

## 05 · Flow, step e grupo

`flow` é a única unidade executável. `step` é a unidade de relatório e de nó no grafo. `group` agrupa steps sem criar escopo novo — vira um nó-container colapsável.

****estrutura e ciclo de vida****

```venn
setup      { db.seed baseline; mock.start "payments" from "./mocks/stripe.yaml" }
teardown   { mock.stop; db.exec "DELETE FROM orders WHERE is_test" }
beforeEach { http.reset; browser.clearCookies }
afterEach  { artifacts.flush }

@tags(smoke, critical)
@timeout(90s)
flow "Checkout" {

  group "Autenticação" {
    step "Login via API" {
      http.post "/api/auth/login" { json: { email: user.email, password: secrets.pw } }
      expect res.status == 200
      capture token = res.json.token
    }
  }

  step "Abrir dashboard" {
    browser.visit "/dashboard" { headers: { Authorization: "Bearer ${token}" } }
    browser.waitFor { text: "Welcome back" }
  }

  on failure { browser.screenshot "falha"; artifacts.save trace, video, har }
  defer      { db.exec "DELETE FROM carts WHERE user = ${user.email}" }
}
```

> **`defer` versus `teardown`.** `defer` roda ao sair do bloco onde foi declarado, na ordem inversa, mesmo em falha — é limpeza local e composta. `teardown` é global da suíte. O protótipo só tinha o segundo, e é aí que nascem os testes que sujam o banco quando quebram no meio.

### Eventos de `on`

`on failure` · `on success` · `on retry` · `on timeout` · `on skip` · `on step(name)`

> **`on` reage a um evento da *execução*, não da máquina.** Um programa sendo parado é o que `teardown` já significa — dar a isso uma grafia própria fazia uma palavra querer dizer duas coisas.

```flow
const api = http.serve { port: 0 }
defer { api.close() }                # desfaz, aconteça o que acontecer
setup    { print "subindo" }
teardown { print "fim" }             # roda antes do que foi diferido
```

Na saída — última instrução, `Ctrl+C`, `SIGTERM` ou falha não tratada — vêm primeiro os `teardown`, e depois os `defer`, na ordem inversa da abertura. O host dá um prazo (5s no CLI) e um segundo sinal corta a espera: um programa que ignora o segundo `Ctrl+C` é um programa do qual não se sai.


---

## 06 · Controle de fluxo

****todas as formas de controle****

```venn
# condicional
if user.plan == "pro" {
  step "Recursos pro" { http.get "/api/pro/features"; expect res.status == 200 }
} else if user.plan == "free" {
  skip "sem recursos pro no plano free"
} else {
  fail "plano desconhecido: ${user.plan}"
}

# iteração sobre uma lista, com grau de paralelismo explícito
forEach user in users { concurrency: 4 } {
  run checkoutCompleto(user)
}

# repetição contada, e o loop aberto para tudo o mais
repeat 3 as tentativa { log "tentativa ${tentativa}" }
loop {
  const job = http.get "/api/job/${jobId}"
  if job.json.status == "done" { break }
  wait 2s
}

### match

A única construção que se propõe a enumerar, e por isso a única a quem se cobra
cobertura. `if` faz uma pergunta; `match` diz que estes são os casos.

```venn
fn descreve(m: Message) -> string => match m {
  { kind: "ping", at }   => "ping em ${at}"
  { kind: "text", body } => "texto: ${body}"
  { kind: "close", why } => "fechou: ${why}"
}
```

O padrão é o mesmo de qualquer binding, com uma leitura a mais: **nome liga,
literal testa**. `{ kind: "ping", at }` pergunta pelo `kind` e liga o `at`, na
mesma escrita. Um nome sozinho não pergunta nada, então é ele quem pega o resto,
e `_` é só um nome como outro qualquer.

`=>` devolve um valor e `{ … }` roda passos, que é a divisão que `fn` e `flow` já
fazem. Um ramo escrito em passos não tem valor, e por isso não pode estar onde um
valor é esperado:

```venn
match res.status {
  200 { step "criado" { expect res.json.id != null } }
  404 { fail "não encontrado" }
  _   { fail "status inesperado: ${res.status}" }
}
```

Um ramo pode ser alcançado de mais de um jeito, escrito com `|`, como uma união
de tipos:

```venn
match res.status {
  200 | 201 | 204 => "ok"
  400 | 404       => "pedido"
  _               => "servidor"
}
```

A cobertura conta todos os caminhos, então dois deles juntos completam a união.
Cada caminho liga para si, e o checker cobra que **todos liguem os mesmos nomes**:
qual deles casou não é sabível ali, então um nome que só alguns ligam não poderia
ser lido pelo corpo.

```venn
{ kind: "ping", at } | { kind: "pong", at } => "batida em ${at}"
```

Um ramo pode pedir mais do que a forma, com `if` depois do padrão. O que separa
os dois é o que acontece quando a condição falha: **o próximo ramo é tentado**, e
é por isso que a condição não podia ficar só no corpo.

```venn
match msg {
  { kind: "text", body } if body.len > 100 => "longo"
  { kind: "text", body }                   => body
  _                                        => "outra"
}
```

Guard lê o que o padrão ligou, e **ramo com guard não cobre nada**: a condição
pode falhar, então o caso continua sendo de ninguém. Um `match` cujo único ramo
para um branch é guardado ainda está incompleto, e o checker diz isso.

Primeiro ramo que casa ganha, sem cair para o de baixo. Caso que ninguém escreveu
é **VN3019**, ramo que nada pode alcançar é **VN3020**. Sujeito que não é um
conjunto de ramos (um `number`, por exemplo) não é cobrado: não há lista de casos
que alguém pudesse escrever.

Dentro de `( )` o lexer tira as quebras de linha, então lá os ramos se separam
por vírgula, como mapa e lista.

### loop

Uma palavra para todo loop cujo fim não se sabe de antemão, em três formas:

```venn
loop { … }                     # até `break` ou `return`
loop fila.len > 0 { … }        # enquanto a condição valer
loop total = 0 {               # carregando um valor
  if total >= 6 { break }
  continue total + 2
}
print total                    # 6: o nome guarda o que a última passada deixou
```

`continue valor` começa a passada seguinte com o valor ligado ao nome, então um
estado atravessa a fronteira sem que nada seja atribuído: cada passada liga o
nome uma vez, e a garantia de que um nome vale um valor continua de pé. `continue`
sozinho repete com o mesmo valor.

Nada limita um `loop`: um programa que pretende rodar para sempre, um jogo entre
eles, pode. O que encerra um que devia ter encerrado é o timeout do step ou do
flow em volta, que é o que a linguagem já promete.

> **Por que não há `while`.** Ele respondia à mesma pergunta que `loop` e numa
> linguagem sem atribuição sua condição nunca podia ser movida pelo próprio
> corpo: todo `while` que alguém escrevia precisava de um `break` para não
> pendurar, inclusive o do tutorial. Uma construção que parece funcionar e não
> funciona custa mais do que uma palavra a menos no vocabulário.

Qual escrever tem uma resposta só: `repeat` quando o número de vezes é conhecido,
`forEach` quando há uma coleção, `loop` quando é nenhum dos dois.

# blocos concorrentes — nomes distintos, semânticas distintas
parallel {
  step "Perfil GraphQL" { gql.query "{ me { id plan } }" { auth: bearer(token) } }
  step "Estoque gRPC"   { grpc.call "Inventory/Check" { sku: "sku-42" } }
}

# race: primeiro a completar vence, os outros são cancelados
race { timeout: 10s } {
  step "Via websocket" { ws.expect { type: "stock.updated" } }
  step "Via polling"   { repeat 10 { http.get "/api/stock"; wait 1s } }
}

# erro estruturado
try {
  step "Pagamento" { stripe.charge { amount: 9900 } }
} catch err {
  log "falhou: ${err.message}"
  step "Fallback boleto" { http.post "/api/pay/boleto" }
} finally {
  mock.reset
}

# invocar fragmento
run loginViaApi(user) as sessao
capture token = sessao.token
```

> **Correção sobre o protótipo.** Lá `parallel` tinha dois sentidos: `parallel=4` (grau de fan-out) e `parallel { }` (bloco concorrente). Aqui o primeiro virou `{ concurrency: 4 }` no `forEach` e o segundo continua `parallel`. Sobrecarga de palavra-chave é dívida que vence no dia em que você escreve o node graph.


---

## 07 · Asserções

`expect` é kernel. Os **matchers** não são — vêm do registry, exatamente como as ações. Por isso `noViolations` e `matchesBaseline` só existem depois de `import { assert } from "venn/assert"`.

****formas de asserção****

```venn
# expressão booleana pura
expect res.status == 200
expect res.time < 300ms

# matcher aplicado a um valor
expect res.json          matches schema "./schemas/session.json"
expect mail.body         contains "Total: $99.00"
expect row.total         closeTo 99.00 { within: 0.01 }
expect user.plan         oneOf ["free", "pro"]
expect page              matchesBaseline { threshold: 0.1% }
expect page.a11y         noViolations { level: "AA" }
expect res.headers       hasKey "x-request-id"
expect orders            empty

# negação
expect not res.json.error

# suave: registra falha e continua
expect.soft res.time < 200ms

# agrupada: relata todas antes de abortar
expect.all {
  res.status == 200
  res.json.id != null
  res.time < 500ms
}

# extração — captura é tipada e escopada ao bloco
capture token   = res.json.token
capture orderId = mail.body ~= r"Order #(\d+)" { group: 1 }
```

> **Escopo de `capture`.** Uma captura é visível do ponto de declaração até o fim do bloco. Dentro de `parallel`, cada ramo tem escopo próprio — capturar num ramo e ler no irmão é erro de compilação, não corrida silenciosa em runtime.


---

## 08 · Anotações

Substituem os modificadores inline do protótipo (`retries=2 timeout=90s tags=[...]`). Uniformes, extensíveis por plugin, e triviais de renderizar como painel de propriedades no grafo.

| Anotação | Aplica em | Efeito |
| --- | --- | --- |
| @id("a1b2c3") | flow, step, group | Identidade estável para o node graph e o layout |
| @tags(smoke, critical) | flow, step | Filtro de execução |
| @timeout(90s) | flow, step | Limite; herda do pai se ausente |
| @retry(2, { backoff: 500ms, factor: 2 }) | flow, step | Reexecução com backoff |
| @skip / @skip(if: env.name == "prod") | flow, step | Pula, condicional ou não |
| @only | flow, step | Foco durante desenvolvimento |
| @serial | flow | Proíbe execução concorrente com irmãos |
| @lock("orders") | flow, step | Mutex nomeado entre workers |
| @flaky(ratio: 0.05) | flow, step | Tolerância declarada; falha se ultrapassar |
| @doc("...") | qualquer | Aparece no hover do editor e no tooltip do nó |
| @load({...}) | flow | Do plugin `@venn-lang/load` — roda o flow como teste de carga |


---

## 09 · Isolamento e recursos

O buraco mais perigoso do protótipo: `clock.freeze`, `TRUNCATE orders` e `parallel=4` juntos são estado global mutável sob concorrência. Flaky garantido. A linguagem precisa deixar o escopo explícito.

****recursos: quem abre, desfaz****

Não há forma de declaração para isso. Um recurso é uma ligação como outra qualquer, e `defer` diz como ela se desfaz — na linha seguinte à abertura, onde já existe algo a fechar e ainda não pode dar errado no meio. O tempo de vida é o do bloco em que está escrito: no topo do arquivo dura a execução inteira; dentro de um `step`, dura o step.

```venn
const navegador = browser.launch { engine: "chromium", headless: true }
defer { navegador.close() }

const conexao = db.connect env.DATABASE_URL
defer { conexao.close() }

# estado global precisa de exclusão mútua explícita
@lock("relogio")
step "Congelar relógio" { mock.clock.freeze 2026-07-23T12:00:00Z }

@serial
flow "Reconciliação noturna" {
  step "Truncar" { db.exec "TRUNCATE orders CASCADE" }
}
```

O runner recusa executar se um valor de escopo de suíte for mutado dentro de um flow sem `@lock` ou `@serial`. É verificação estática, não convenção de documentação.


---

## 10 · Módulos e imports

Uma palavra só. Tudo que um arquivo alcança e não veio no prelúdio chega por um
nome que **ele** escreveu, e o topo do arquivo é a resposta para "de onde veio
isto".

O que muda é a **forma**, não a palavra:

| escrito | traz |
| --- | --- |
| `import { http } from "venn/http"` | o namespace, com os verbos pendurados nele |
| `import { http as h } from "venn/http"` | o mesmo, sob outro nome |
| `import { contains } from "venn/assert"` | um matcher, por nome |
| `import { Request } from "venn/http"` | um tipo, para anotar |
| `import { retry } from "venn/http"` | um decorator, para `@retry` |
| `import { User } from "./models.vn"` | valores de outro arquivo |

Verbo não se importa sozinho: ele pende do namespace, então
`import { get } from "venn/http"` é recusado dizendo o que escrever no lugar. É a
mesma razão pela qual verbo não é valor: ele emite evento, participa de timeout e
de escopo de recurso, e nada disso cabe numa função solta.

****cabeçalho de um arquivo .vn****

```venn
module acme.checkout

# o que o arquivo pode fazer
import { http } from "venn/http"
import { browser as web } from "venn/browser"
import { mqtt } from "venn/mqtt"
import { stripe } from "@acme/stripe"

# o que o arquivo conhece
import { User, Cart }        from "./models.vn"
import { loginViaApi }       from "./lib/auth.vn"
import { checkoutRapido }    from "@acme/fluxos-comuns"
import baseline              from "./fixtures/orders.json"
import * as helpers          from "./lib/helpers.vn"

# reexportar para quem importar este módulo
pub import { loginViaApi }
```

### Resolução

| Especificador | Resolve para |
| --- | --- |
| "@venn-lang/http" | Stdlib, embutida no runtime. Nunca vai à rede. |
| "@acme/stripe" | Registry → `~/.venn/pkgs/@acme/stripe@1.2.0/`, travado no `venn.lock` |
| "./lib/auth.vn" | Relativo ao arquivo atual |
| "#shared/auth.vn" | Alias de caminho definido no `venn.toml` |
| "./fixtures/orders.json" | Dado estático; vira valor tipado se houver `.d.vn` ao lado |

### Visibilidade

****lib/auth.vn — privado por padrão****

```venn
module acme.lib.auth

import { http } from "venn/http"
import { auth } from "venn/auth"

# público: quem importar este módulo pode nomear esta forma
pub type Sessao { token: string, refresh: string, expira: instant }

# público: uma constante compartilhada, para não haver duas verdades
pub const TIMEOUT_LOGIN = 10s

# privado: só este módulo enxerga
fn cabecalhoBasico(u: User) -> map {
  return { Authorization: "Basic ${auth.base64("${u.email}:${secrets.pw}")}" }
}

# público: exportado
pub fragment loginViaApi(u: User) -> Sessao {
  step "Login (API)" {
    http.post "/api/auth/login" { headers: cabecalhoBasico(u) }
    expect res.status == 200
    expect res.json matches schema "./schemas/session.json"
    return { token: res.json.token, refresh: res.json.refresh, expira: res.json.exp }
  }
}

pub fragment loginViaUI(u: User) {
  step "Login (UI)" {
    web.visit "/login"
    web.fill "#email" u.email
    web.fill "#password" secrets.pw
    web.click "Entrar"
    web.waitForUrl "/dashboard"
  }
}
```

`pub` vale para `fn`, `fragment`, `deco`, `type` e binding (`let`/`const`), e só
no topo do arquivo: um `pub` dentro de um step ou de uma função não publica nada,
e é recusado em vez de ser ignorado.

Um `pub type` publica um nome que o checker resolve, não um valor: importe-o e
uma forma errada é recusada onde ela é escrita, do outro lado da fronteira. Um
`pub const` é calculado no arquivo onde está, então um módulo que lê a constante
de outro é preenchido depois dele.

> **Regras duras.** Ciclos entre módulos são erro de compilação. Um arquivo tem exatamente um `module`. Colisão de namespace no import exige `as`, nada de resolução implícita por ordem.

### fn versus fragment

|   | fn | fragment |
| --- | --- | --- |
| Contém | expressões | steps e controle de fluxo |
| Efeitos | puro | executa ações |
| Chamada | dentro de expressão | `run nome(args)` |
| No grafo | invisível | nó-container colapsável |

### O que o editor conta enquanto você escreve

Um verbo declara seus **argumentos posicionais** com nome, tipo e uma linha de explicação — e o editor os mostra no momento em que estão sendo digitados, sem que se peça nada:

```venn
http.on ▮
#       └─ http.on server: http.Server handler: fn(http.Request) -> dynamic
#          server — The handle `http.serve` gave back.
```

A lista de sugestões nessa posição oferece **o que o programa já tem**, o do tipo certo primeiro, e só depois os namespaces. Depois de `http.on ` o `api` declarado acima vem em primeiro; depois de `http.get `, vem a string com a URL.

Um plugin que não nomeia nada ainda diz quanto e de quê (`http.get string`), porque o tipo sozinho já era conhecido. Nomear é o que transforma isso em explicação.

### Quando os parênteses são obrigatórios

Uma regra, que vale igual para um verbo de plugin e para um método de um valor:

| onde | sem `()` | com `()` |
| --- | --- | --- |
| **statement** | chama | chama |
| **expressão** | é o valor da função | chama |

```venn
api.close                 # statement: fecha
api.close()               # statement: fecha, igual

const fechar = api.close  # expressão: a função, ainda não chamada
const _ = api.close()     # expressão: fecha
```

É a mesma razão pela qual `http.get "url"` é uma chamada sem parêntese nenhum: **em posição de statement, um verbo é uma chamada** — não haveria sentido em ler um valor e jogá-lo fora. Em expressão, um nome é um valor, e `()` é o que o invoca.

Na dúvida, escreva os parênteses. Eles nunca estão errados.

****Um argumento é um valor, e um valor pode ser negativo****

Argumentos são separados por espaço, então um argumento não carrega operador:
`print total + 1` para no `+` e diz o que escrever no lugar. O `-` é o único que
também nega, e como ele foi escrito é o que decide qual dos dois é:

```venn
print total -1        # dois argumentos, o segundo negativo
print total - 1       # a subtração que faltou parêntese: `print (total - 1)`
print total-1         # a mesma subtração, e o mesmo recado
```

Grudado no valor, com ar antes: nega. Espaçado dos dois lados, ou de nenhum: é o
operador. É a regra do Swift, e existe porque parêntese depois de um valor é
sempre chamada, então `print total (-1)` chamaria `total`. A regra vale igual num
matcher: `expect xs contains -1`.

### Função sem nome

Uma função também pode ser escrita no meio de uma expressão, para passar adiante. Um parâmetro dispensa os parênteses; mais de um exige. `fn (x) => …` continua valendo e diz exatamente a mesma coisa.

```venn
const seniores = pessoas.filter(p => p.idade > 35)
const pares    = pessoas.map((p, i) => "${i}: ${p.nome}")
const somar    = (a, b) => a + b
const dobrar   = fn (x) => x * 2          # a forma longa, idêntica
```

O corpo é **uma expressão**. Um corpo em bloco se leria como literal de mapa, então `{ … }` fica com a forma `fn`, onde as chaves não deixam dúvida.

Um parâmetro sem parênteses não leva tipo: `f(x: number => …)` já significa um **argumento nomeado** chamado `x`, e argumento nomeado ganha. Quer anotar o tipo, use os parênteses: `(x: number) -> number => x + 1`.

**Toda callback de lista recebe o índice junto do item** — e é livre para ignorá-lo. `pessoas.map(p => p.idade)` e `pessoas.map((p, i) => …)` são ambas corretas; pedir um terceiro parâmetro é erro de tipo.

---

## 11 · venn.toml

Um projeto é uma pasta com manifesto. O manifesto é o que o LSP lê para saber quais capacidades oferecer no autocomplete.

****venn.toml**TOML**

```toml
[package]
name    = "acme-checkout"
version = "1.4.0"
flowlang = "^0.1"          # versão da linguagem — habilita migrações automáticas

[dependencies]
"@venn-lang/http"    = "0.1"
"@venn-lang/browser" = "0.1"
"@venn-lang/mqtt"    = "0.1"
"@acme/stripe"   = "1.2"

[paths]
"#shared" = "./src/shared"
"#fixtures" = "./test/fixtures"

[env.staging]
BASE_URL     = "https://staging.acme.dev"
DATABASE_URL = "${env:STAGING_DB}"
MQTT_BROKER  = "mqtt://staging.acme.dev:1883"

[env.local]
BASE_URL     = "http://localhost:3000"
DATABASE_URL = "postgres://localhost/acme_test"

[secrets]
provider = "vault"
path     = "kv/acme/test"
redact   = "always"          # nunca aparece em log, trace ou HAR

[runner]
workers  = 4
retries  = 1
reporters = ["junit", "html", "trace"]
```


---

## 12 · Prelude

Disponível sem importar nada. Deliberadamente minúsculo: tudo aqui é independente de protocolo, e a lista inteira vive em `@venn-lang/prelude`.

| Símbolo | Assinatura | Uso |
| --- | --- | --- |
| log | log(msg, level?) | Anota o relatório |
| wait | wait(duration) | Pausa explícita — o linter avisa quando há `waitFor` melhor |
| fail | fail(msg) | Aborta com mensagem |
| skip | skip(msg) | Marca como pulado em runtime |
| env | env.NOME, env.name | Ambiente resolvido do manifesto |
| secrets | secrets.chave | Redigido automaticamente em toda saída |
| now uuid | now() -> instant | Fontes não determinísticas, controláveis por `mock.clock` |
| json file | json.parse, file.read | Manipulação básica |


---

## 13 · Stdlib

Cada pacote registra um namespace, matchers e tipos. Todos usam a mesma API pública de plugin — não há atalho interno.

| Pacote | Namespace | Ações principais | Registra também |
| --- | --- | --- | --- |
| @venn-lang/http | http | get post put patch delete head request reset | tipo `Response`; matchers `status`, `header` |
| @venn-lang/browser | browser | launch visit click fill select hover press upload download screenshot waitFor waitForUrl evaluate frame newContext | recurso `Browser`, `Page`; matchers `visible`, `text` |
| @venn-lang/graphql | gql | query mutate subscribe | matcher `noGraphqlErrors` |
| @venn-lang/grpc | grpc | call stream reflect | carrega `.proto`, tipa a resposta |
| @venn-lang/ws | ws | connect send expect close | tipo `Message` |
| @venn-lang/mqtt | mqtt | connect publish subscribe expect | QoS, retain, last-will |
| @venn-lang/mail | mail | inbox waitFor read attachments clear | backends mailpit, mailhog, IMAP |
| @venn-lang/db | db | connect query exec seed snapshot restore | tipo `Row`; recurso transacional |
| @venn-lang/mock | mock | start stop intercept respond clock.freeze clock.advance flag reset | controle de tempo e feature flags |
| @venn-lang/auth | auth | oauth2 bearer basic apikey hmac totp jwt | refresh automático de token |
| @venn-lang/data | data | csv json faker.* oneOf range shuffle | seed determinístico por worker |
| @venn-lang/assert | — | (só matchers) | `schema`, `contract`, `closeTo`, `noViolations`, `matchesBaseline` |
| @venn-lang/load | load | ramp constant spike | anotação `@load`; métricas p50/p95/p99 |
| @venn-lang/artifacts | artifacts | save flush attach | trace, video, HAR, screenshot |
| @venn-lang/notify | notify | slack webhook email | reporter de saída |


---

## 14 · Plugins — como uma lib aumenta os poderes

Um plugin é um módulo TypeScript que exporta uma definição. Ele pode contribuir com seis coisas, e cada uma alimenta simultaneamente o runtime, o autocomplete e o node graph.

**1 · Ações** — Novos verbos no namespace. Schema de parâmetros com Zod vira validação, hover e formulário do nó.

**2 · Matchers** — Novas palavras utilizáveis depois de `expect`, com mensagem de falha própria.

**3 · Recursos** — Handles com ciclo de vida gerenciado — conexões, browsers, brokers. O runner cuida de abrir e fechar por escopo.

**4 · Tipos** — Formas nominais que o LSP usa para dar autocomplete em `res.`, `row.`, `msg.`

**5 · Anotações** — Modificadores próprios, como `@load`. Não mudam a gramática — `@nome(args)` já é kernel.

**6 · Reporters e hooks** — Saída customizada e middleware que envolve toda ação — ideal para tracing e redação de segredos.

****plugins/stripe/index.ts**TypeScript**

```ts
import { definePlugin, defineAction, defineMatcher, defineResource, z, Duration } from "@venn-lang/sdk";

export default definePlugin({
  name: "@acme/stripe",
  version: "1.2.0",
  namespace: "stripe",
  requires: ["@venn-lang/http"],

  // 3 · recurso com ciclo de vida gerenciado pelo runner
  resources: [
    defineResource({
      name: "client",
      scope: "worker",
      open:  async (ctx) => new Stripe(ctx.secrets.STRIPE_KEY),
      close: async (c) => c.dispose(),
    }),
  ],

  // 1 · ações — uma definição alimenta runtime, LSP e node graph
  actions: [
    defineAction({
      name:  "charge",
      doc:   "Cria uma cobrança no Stripe.",
      params: z.object({
        amount:   z.int().describe("Valor em centavos"),
        currency: z.enum(["brl", "usd"]).default("brl"),
        card:     z.string().optional(),
        timeout:  Duration.default("30s"),
      }),
      returns: "Charge",
      node: { category: "payment", color: "violet", icon: "credit-card", ports: { in: 1, out: 1 } },
      run: async (ctx, p) => ctx.res(await ctx.resource("client").charges.create(p)),
    }),
  ],

  // 4 · tipos que o autocomplete passa a conhecer
  types: {
    Charge: z.object({ id: z.string(), status: z.enum(["paid", "failed"]), amount: z.int() }),
  },

  // 2 · matchers usáveis depois de `expect`
  matchers: [
    defineMatcher({
      name: "settled",
      appliesTo: "Charge",
      params: z.object({ within: Duration.default("10s") }),
      test: async (charge, p, ctx) => ctx.poll(() => charge.refresh(), (c) => c.status === "paid", p.within),
      message: (c) => `esperava cobrança liquidada, veio "${c.status}"`,
    }),
  ],

  // 6 · middleware em volta de toda ação do plugin
  middleware: [
    async (next, ctx, call) => {
      ctx.redact(call.params.card);
      return ctx.span(`stripe.${call.name}`, () => next());
    },
  ],
});
```

****e o uso no .vn fica indistinguível da stdlib****

```venn
import { stripe } from "@acme/stripe"

step "Cobrar" {
  stripe.charge { amount: 9900, currency: "brl", card: data.faker.creditCard }
  expect res settled { within: 10s }
  capture chargeId = res.id
}
```

> **É isto que faz a linguagem escalar.** WebSocket, MQTT, GraphQL, REST e browser são exatamente esse mesmo objeto — nenhum deles tem tratamento especial no compilador. Se amanhã você precisar de Kafka, AMQP, Redis ou SAP, é um arquivo como o de cima e mais nada.


---

## 15 · Protocolo de eventos em tempo real

A UI nunca faz polling e nunca lê arquivo de resultado. O runner empurra um fluxo ordenado de eventos, e **tudo o mais é derivado dele**: a árvore de execução, a barra de progresso, o badge do nó no grafo, o histórico de runs, o painel de erro. Uma fonte, muitas vistas.

_[diagrama: Caminho de um evento do runner até a interface]_

### O envelope

****core/events.ts**contrato único entre runner, Rust e UI**

```ts
type Envelope = {
  seq:     number       // monotônico por run — a UI detecta lacuna e pede resync
  ts:      string       // ISO-8601 com milissegundos, relógio do runner
  run:     RunId        // ULID; ordena o histórico sem consultar timestamp
  kind:    EventKind
  node?:   NodePath     // "checkout/flow-checkout/step-cart"  ← chave de junção
  parent?: NodePath
  worker?: number       // qual worker emitiu — essencial sob concorrência
  data:    EventData[EventKind]
}
```

> **A chave de junção é o `@id`.** O mesmo identificador que ancora o layout do nó no grafo ancora o marcador na margem do editor e a linha na árvore de execução. Uma identidade, três superfícies. Se você emitir índice numérico em vez de `NodePath` derivado do `@id`, qualquer edição no arquivo desalinha silenciosamente todo o histórico — e você só descobre semanas depois.

### Taxonomia

| Evento | Carga útil | O que a UI faz |
| --- | --- | --- |
| run.started | plano completo: pipelines, flows, steps previstos | Desenha a árvore inteira em cinza antes de qualquer execução |
| run.finished | totais, duração, taxa de aprovação | Fecha a run, move para o histórico |
| pipeline.started / finished | nome, contagem de flows, status | Cabeçalho e agregado do container |
| flow.started / finished | título, tags, matriz aplicada | Linha da árvore, badge de tag |
| flow.retrying | tentativa, motivo, atraso | Badge de retentativa, sem duplicar a linha |
| step.started / finished | status, duração | Ícone, cronômetro, cor do nó no grafo |
| action.started / finished | namespace, ação, args redigidos, duração | As sublinhas `POST /auth/login · 0.2s` |
| expect.passed / failed / soft_failed | `Problem` completo, com diff | Check verde ou abre o painel de erro |
| capture.set | nome, tipo, valor redigido | Inspetor de variáveis do step |
| log | nível, mensagem, origem | Console lateral |
| artifact.ready | tipo, caminho, tamanho, miniatura | Aba de artefatos, preview de screenshot |
| resource.opened / closed | nome, worker | Painel de recursos — mostra o que está de pé |
| browser.frame | JPEG base64, ~8fps | O preview ao vivo do navegador |
| load.sample | janela de 1s: vus, rps, p50/p95/p99, erros | Gráficos de carga |
| runner.heartbeat | vivo, uso de memória, workers ativos | Status `runner: executing` no rodapé |

### Volume e contrapressão

Uma run de 16 steps emite cerca de 200 eventos — irrelevante. Dois casos escapam disso e precisam de tratamento explícito:

| Caso | Volume ingênuo | Estratégia |
| --- | --- | --- |
| Flow com `@load` | 200 VUs × 5min ≈ 3M eventos | O runner agrega em `load.sample` a cada 1s. Iterações individuais nunca cruzam a fronteira; ficam no `.jsonl` para autópsia. |
| Preview do navegador | 60fps × JPEG | Limitado a 8fps, descartado quando a aba não está visível, e cortado assim que `Headless` é ligado. |

No lado Rust, eventos são acumulados e entregues em lotes de 16ms — um `requestAnimationFrame`. Sem isso, um `forEach` com 4 workers faz o React re-renderizar centenas de vezes por segundo e a UI trava justamente quando você mais precisa dela.

### Reconexão e histórico

****core/src/events.rs**Rust**

```rust
// O ring buffer permite que a UI reconecte sem perder contexto:
// a webview pode recarregar (F5, hot reload) no meio de uma run.
pub struct RunSession {
    id:      RunId,
    ring:    VecDeque<Envelope>,   // últimos 10 000
    journal: BufWriter<File>,      // ~/.venn/runs/<run>.jsonl — append-only
    last:    u64,
}

#[tauri::command]
async fn subscribe_run(
    state: State<'_, Runs>,
    run:   RunId,
    from:  Option<u64>,          // último seq que a UI viu
    sink:  Channel<Vec<Envelope>>,
) -> Result<Resume> {
    let s = state.get(&run)?;
    match from {
        // lacuna pequena: replay do buffer, a UI continua de onde parou
        Some(seq) if s.has(seq) => { sink.send(s.since(seq))?; Ok(Resume::Replayed) }
        // lacuna grande ou primeira conexão: snapshot derivado do journal
        _ => { sink.send(vec![s.snapshot()?])?; Ok(Resume::Snapshot) }
    }
}
```

> **O histórico é o mesmo fluxo, lido do disco.** Abrir uma run de 3 horas atrás no painel lateral não usa código diferente: é o mesmo `.jsonl` passando pelo mesmo redutor, só que sem `runner.heartbeat`. Um renderizador, dois modos. Isso elimina a classe inteira de bugs em que o vivo e o histórico divergem.

****ui/useRun.ts**o redutor é puro — mesma função para vivo e histórico**

```ts
export function useRun(run: RunId) {
  const [tree, dispatch] = useReducer(reduceRun, emptyRun);
  const lastSeq = useRef(0);

  useEffect(() => {
    const sink = new Channel<Envelope[]>();
    sink.onmessage = (lote) => {
      for (const e of lote) {
        if (e.seq > lastSeq.current + 1) return resync(lastSeq.current);
        lastSeq.current = e.seq;
      }
      dispatch({ type: "lote", lote });   // um render por lote, não por evento
    };
    invoke("subscribe_run", { run, from: lastSeq.current, sink });
  }, [run]);

  return tree;
}
```

### Canal reverso

`run.start(pipeline, filtro)` · `run.pause` · `run.resume` · `run.stop` · `run.rerun(node)` · `run.focus(node)` · `run.headless(bool)` · `step.stepOver` · `breakpoint.set(node)`

Comandos são idempotentes e carregam o `seq` observado pela UI, para que o runner recuse ordens baseadas em estado obsoleto — o clássico "cliquei em pausar mas ele já tinha terminado".


---

## 16 · Modelo de erros

Erro de teste é o produto. É o que a pessoa lê às duas da manhã. Duas famílias — diagnóstico de compilação e falha de execução — compartilham **uma única forma**, para que exista um renderizador só.

****core/problem.ts**a forma comum**

```ts
type Problem = {
  code:     string            // "VN3012" — estável, googlável, documentado
  severity: "error" | "warning" | "hint"
  title:    string            // uma linha, linguagem humana, sem jargão de compilador
  span:     Span              // arquivo, linha, coluna, comprimento — o local exato
  related?: { span: Span; label: string }[]   // "aqui foi declarado como..."
  diff?:    Diff              // esperado vs recebido, estruturado
  trace?:   Frame[]           // pilha em termos do .vn, não do Node
  cause?:   { runtime: string; message: string; stack?: string }
  help?:    string            // o que fazer, imperativo
  fixes?:   QuickFix[]        // aplicáveis com um clique no editor
  note?:    string            // por que a regra existe
  docs?:    string            // venn.dev/e/VN3012
  artifacts?: Artifact[]     // screenshot, diff de imagem, HAR, vídeo
}
```

### Anatomia

Todo erro bem formado responde sete perguntas, nesta ordem. Se faltar uma, a pessoa vai ter que abrir o código para descobrir — e aí o erro falhou.

| # | Pergunta | Elemento |
| --- | --- | --- |
| 1 | Quão grave é? | Severidade e código |
| 2 | O que houve, em uma frase? | Título |
| 3 | Onde exatamente? | Recorte de código com acento circunflexo no span |
| 4 | Comparado a quê? | Spans relacionados ou diff esperado/recebido |
| 5 | Como cheguei aqui? | Pilha de flow |
| 6 | O que eu faço agora? | Ajuda e correções rápidas |
| 7 | Por que isso é regra? | Nota e link |

### Códigos

| Faixa | Família | Quando |
| --- | --- | --- |
| VN1xxx | Léxico e sintático | Parse — o Langium reporta com recuperação de erro |
| VN2xxx | Resolução de nomes | Namespace não importado, símbolo inexistente, ciclo de módulo |
| VN3xxx | Tipos | Incompatibilidade, unidade errada, argumento faltando |
| VN4xxx | Concorrência e isolamento | Recurso compartilhado mutado sem lock, captura vazando entre ramos |
| VN5xxx | Lint | Avisos: espera fixa, seletor frágil, asserção ausente |
| VN6xxx | Asserção | Runtime — `expect` falhou |
| VN7xxx | Ação e protocolo | Runtime — HTTP recusou, seletor não encontrado, broker caiu |
| VN8xxx | Timeout e recursos | Runtime — estouro de prazo, recurso não abriu |

### Diff estruturado, nunca `toString`

| Tipo | Renderização |
| --- | --- |
| scalar | Lado a lado, com o tipo anotado — `99.00 (float)` vs `"99.00" (string)` |
| json | Diff por caminho: só os campos divergentes, com contexto colapsado |
| text | Diferença por caractere, com espaço e quebra de linha visíveis |
| duration / size | Unidade normalizada e delta — `excedeu em 412ms` |
| image | Três painéis: base, atual, máscara de diferença com percentual |
| http | Par requisição/resposta, cabeçalhos e corpo, segredos redigidos |
| element | HTML do elemento encontrado versus seletor esperado, com candidatos próximos |

> **Redação é obrigatória no produtor, não no consumidor.** Qualquer valor originado de `secrets.*` carrega uma marca que o acompanha por expressões, capturas e chamadas. O runner substitui por `‹redigido›` antes de serializar o evento. Redigir na UI é tarde demais — o valor já está no `.jsonl`, no HAR e no trace.

### Pilha de flow, não pilha de implementação

O usuário escreveu um `.vn`. Mostrar a ele um stack trace do Playwright com trinta quadros de `node_modules` é transferir o seu problema para ele. A pilha primária é sempre em termos da linguagem; a pilha do runtime subjacente existe, mas vem colapsada, e serve para quando o bug é do plugin.


---

## 17 · Galeria de erros

Como cada família aparece de fato. Estes são componentes reais, não maquete — a mesma estrutura `Problem` renderizada.

#### VN2004 · namespace não importado

**erro · VN2004** — O namespace `web` não está disponível neste arquivo.

`src/checkout.vn:142:5`

```
    3 │ import { http } from "venn/http"
      │ --- aqui você importou capacidades, mas não a de browser
    ⋮
  141 │   step "Adicionar ao carrinho" {
  142 │     web.click "[data-add=sku-42]"
      │     ^^^ namespace desconhecido
  143 │   }
```

- **ajuda** — O pacote `@venn-lang/browser` registra o namespace `browser`. Você usou o apelido `web`, então importe com `as web`.
- **similar** — `http` · `ws` — disponíveis neste arquivo

- ⌘. adicionar import { browser as web } from "venn/browser"
- ⌘. trocar por http

> Namespaces nunca são globais: o runner só sobe o Playwright se algum arquivo declarar que precisa dele.

#### VN3012 · incompatibilidade de unidade

**erro · VN3012** — Não dá para comparar uma duração com um tamanho.

`src/checkout.vn:58:19`

```
   58 │   expect res.time < 2mb
      │          --------   ^^^ size
      │          duration
```

- **esperado** — `duration` — algo como `300ms`, `1.5s`, `2m`
- **recebido** — `size` — `2mb`
- **ajuda** — Você provavelmente quis `res.size < 2mb` ou `res.time < 2s`.

- ⌘. trocar para res.size
- ⌘. trocar para 2s

> Unidade faz parte do tipo justamente para pegar isto na digitação, e não às três da manhã num pipeline vermelho.

#### VN4002 · recurso compartilhado sem exclusão mútua

**erro · VN4002** — Este flow muta um recurso de escopo `suite` enquanto roda em paralelo.

`src/checkout.vn:96:7`

```
   31 │ const banco = db.connect env.DATABASE_URL
   32 │ defer { banco.close() }
      │          ----- declarado aqui, compartilhado por todos os workers
    ⋮
   94 │   forEach cliente in clientes { concurrency: 4 } {
      │                                --------------- quatro workers simultâneos
   95 │     step "Conciliar" {
   96 │       db.exec "TRUNCATE orders CASCADE"
      │       ^^^^^^^ mutação destrutiva sem lock
   97 │     }
```

- **ajuda** — Anote o step com `@lock("orders")`, ou marque o flow com `@serial`, ou abra a conexão dentro do flow com um schema próprio.

- ⌘. adicionar @lock("orders")
- ⌘. adicionar @serial ao flow

> Sem esta verificação, o sintoma não seria um erro — seria um teste que passa 95% das vezes. Essa é a categoria de bug mais cara que existe numa suíte.

#### VN6001 · asserção falhou, com diff estrutural

**erro · VN6001** — O pedido não foi conciliado como pago.

`src/checkout.vn:231:7 · flow Checkout · worker 2 · 1.42s`

```
  230 │       db.query "SELECT status, total FROM orders WHERE id = ${orderId}"
  231 │       expect row.status == "paid"
      │       ^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

- **contexto** — `orderId = "ord_8812"` capturado em `step "E-mail de confirmação"` · linha 219
- **ajuda** — O webhook do provedor de pagamento costuma chegar depois da resposta HTTP. O `repeat` desta etapa esgotou 10 tentativas em 5s — considere `within: 15s` ou aguarde o evento em vez do banco.

```
row
├ .status  esperado  "paid"
│          recebido  "pending"
├ .total   igual     99.00
└ .id      igual     "ord_8812"
```

```
em expect row.status          src/checkout.vn:231:7
em step "Conciliar no banco"  src/checkout.vn:228:5
em forEach cliente           src/checkout.vn:94:3  (iteração 2 de 8)
em flow "Checkout"           src/checkout.vn:88:1  (tentativa 2 de 3)
```

- ▸ reexecutar só este step
- ▸ abrir trace
- ▸ ver query e resultado

#### VN7031 · ação falhou, com causa do runtime colapsada

**erro · VN7031** — O elemento `#card` nunca ficou pronto para receber texto.

`src/checkout.vn:198:7 · flow Checkout · worker 1 · 30.0s (timeout)`

```
  197 │       mock.intercept "POST" "**/charge" { respond: mock.payments.success }
  198 │       web.fill "#card" data.faker.creditCard
      │       ^^^^^^^^^^^^^^^^ esperou 30s por um elemento editável
```

- **encontrado** — 1 elemento correspondente, mas dentro de um `<iframe src="https://js.stripe.com/…">` e coberto por `div.overlay-loading`
- **ajuda** — Campos de pagamento hospedados vivem em iframe. Entre nele antes: `web.frame "stripe-card" { web.fill "#card" … }`
- **causa** — `playwright · TimeoutError: locator.fill: Timeout 30000ms exceeded` — 24 quadros ocultos ▸

- ⌘. envolver com web.frame
- ▸ screenshot no instante da falha
- ▸ vídeo · HAR · console

> A pilha do Playwright existe e está a um clique, mas ela não é a resposta — a resposta é que o campo está num iframe.

#### VN5007 · lint, o aviso que evita a suíte instável

**aviso · VN5007** — Espera de tempo fixo onde existe uma condição observável.

`src/checkout.vn:167:7`

```
  166 │       web.click "Pagar agora"
  167 │       wait 3s
      │       ^^^^^^^ lenta quando passa, instável quando falha
  168 │       expect element("#recibo").visible
```

- **ajuda** — A linha seguinte já descreve a condição real. Use `web.waitFor { selector: "#recibo" }` e remova a espera fixa.

- ⌘. substituir por web.waitFor
- ⌘. silenciar nesta linha

#### VN1008 · sintaxe, com recuperação de erro

**erro · VN1008** — Faltou fechar o bloco aberto em `step "Pagar"`.

`src/checkout.vn:205:1`

```
  195 │     step "Pagar" {
      │                  - bloco aberto aqui
    ⋮
  204 │       }
  205 │ flow "Carga do checkout" {
      │ ^^^^ esperava `}`, encontrou `flow`
```

- **ajuda** — Declarações de topo não podem aparecer dentro de um `flow`. Feche o bloco na linha 204.

- ⌘. inserir } na linha 205

> O parser continua depois deste ponto em vez de desistir — por isso o resto do arquivo ainda recebe autocomplete e realce enquanto você digita.

### O mesmo problema, três superfícies

Um único `Problem` alimenta os três destinos. Nenhum deles reformata texto do outro; cada um lê os campos estruturados.

**Terminal** — ANSI, largura adaptativa, recorte de código com circunflexo. Sem cor quando não há TTY, para o log de CI ficar legível.

**Editor** — Diagnóstico LSP no span exato, sublinhado ondulado, `relatedInformation` nos spans secundários, `codeAction` para cada `QuickFix`.

**Painel da UI** — Cartão completo com diff, artefatos, vídeo e o botão de reexecutar só aquele nó. É este o formato mostrado acima.

> **Regra de escrita para toda mensagem.** Título em uma linha, na voz do produto, descrevendo o que aconteceu no domínio do usuário — não no do compilador. `"O elemento #card nunca ficou pronto"`, não `"TimeoutError in locator.fill"`. A ajuda é imperativa e diz o próximo passo. A nota explica a regra. Nada pede desculpas e nada é vago.


---

## 18 · Integrar a linguagem em outro software

A linguagem roda sozinha. Um software que queira embuti-la — o seu estúdio em Tauri, um runner de CI, um serviço interno — acopla por um de três níveis, e escolher o nível errado custa caro.

| Nível | Superfície | Executa onde | Para quem |
| --- | --- | --- | --- |
| 1 · Processo | venn run --reporter ndjson | subprocesso | App desktop, CI, qualquer linguagem |
| 2 · Biblioteca | createRunner() · @venn-lang/runtime | dentro do Node do hospedeiro | Serviço Node que já é o dono do processo |
| 3 · Compilador | parse · check · toGraph · @venn-lang/core | Node **ou** Web Worker | Editor, LSP, canvas do grafo |

> **Um app desktop usa o 1 e o 3, nunca o 2.** Nível 1 para executar, porque a fronteira de processo dá isolamento de crash, `kill` de verdade no botão Parar e teto de memória observável. Nível 3 para editar, porque roda no worker do webview sem tocar em `node:*`. Usar o nível 2 num app desktop significa que um plugin de terceiro mal comportado derruba a janela do usuário junto.

### O contrato do nível 1 é a API inteira

Eventos NDJSON saindo pelo stdout, comandos JSON entrando pelo stdin. Não há mais nada. Um hospedeiro em Rust, Go ou Python integra idêntico.

****modo persistente**preferível a um processo por execução**

```venn
$ venn serve --stdio --project ./tests

# entra (stdin, uma linha por mensagem)
{"id":1,"method":"project.open","params":{"root":"./tests"}}
{"id":2,"method":"run.start","params":{"pipeline":"Checkout E2E","env":"staging","preview":true}}
{"id":3,"method":"run.pause","params":{"run":"01J8...","seq":418}}

# sai (stdout, uma linha por evento — o envelope da §15)
{"seq":1,"kind":"run.started","run":"01J8...","data":{"plan":{…}}}
{"seq":2,"kind":"step.started","node":"checkout/flow-checkout/step-login"}
{"seq":3,"kind":"expect.failed","node":"…/step-db","data":{"problem":{…}}}
```

Processo longevo em vez de um por execução paga o arranque do Node uma única vez, mantém o registry de plugins carregado e o browser aquecido entre rodadas. O botão Executar vira uma mensagem, não um `spawn`.

****src-tauri/src/runner.rs**o lado hospedeiro inteiro**

```rust
pub fn spawn_venn(app: &AppHandle) -> Result<VennHandle> {
    let (mut rx, child) = app.shell()
        .sidecar("venn")?
        .args(["serve", "--stdio", "--project", project])
        .spawn()?;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut lote = Vec::with_capacity(64);
        let mut tick = interval(Duration::from_millis(16));
        loop { select! {
            Some(ev) = rx.recv() => match ev {
                CommandEvent::Stdout(l) => lote.push(parse_envelope(&l)?),
                CommandEvent::Stderr(l) => tracing::debug!("venn: {l}"),
                _ => {}
            },
            // um render por quadro, nunca um por evento
            _ = tick.tick() => if !lote.is_empty() {
                handle.emit("venn://events", &lote)?;
                journal.append(&lote)?;   // mesmo .jsonl que o histórico lê
                lote.clear();
            },
        }}
    });
    Ok(VennHandle { child })
}
```

### O compilador no editor

O nível 3 não passa por processo nenhum. O pacote `core` é importado direto pelo bundle do frontend e roda num worker, alimentando LSP e canvas com o mesmo código que o CLI usa.

****ui/lang.worker.ts****

```ts
import { createHost, parse, check, toGraph, applyGraphEdit } from "@venn-lang/core";

const host = createHost.worker();      // fs em memória, sem process, sem node:*

// texto → IR → grafo
const ir    = check(parse(texto), host);
const grafo = toGraph(ir);

// grafo → edição cirúrgica de texto, preservando comentários
const edits = applyGraphEdit(ir, { kind: "moveStep", node: "step-cart", after: "step-login" });
```

### O que é instalado, e quando

Um plugin não tem instalador próprio: **é um pacote npm que implementa `CapabilityProvider`**. O import declara, não baixa. Resolução é `node_modules` mais `venn.lock`; pacote ausente vira diagnóstico `VN2001` com correção rápida.

| Camada | Contém | Peso | Quando chega |
| --- | --- | --- | --- |
| @venn-lang/cli | Compilador e runtime. Nenhum browser. | poucos MB | Sempre |
| @venn-lang/browser | `playwright-core`, sem binários | poucos MB | Se algum `.vn` declarar |
| Binários de motor | Chromium, Firefox, WebKit | centenas de MB | Sob demanda, com barra de progresso |

> **Nem o CLI nem o app empacotam Chromium.** `venn run api-tests.vn` numa máquina sem browser algum roda e não baixa nada. O instalador do estúdio sai pequeno; na primeira execução de um flow com browser, aparece um download guiado. É a mesma coerência do import explícito na linguagem: o manifesto declara, o runner busca só o declarado, nada é baixado por especulação.


---

## 19 · Acoplar o browser num app Tauri

A premissa que precisa ser desfeita primeiro: **você não embute o browser no app — embute os pixels dele.** O motor roda em processo separado, fora da tela, e o app recebe um fluxo de quadros mais um canal de entrada de volta.

### Por que não a webview nativa

| Caminho | Por que não serve como principal |
| --- | --- |
| Webview do próprio Tauri | É WKWebView, WebView2 ou WebKitGTK. O teste rodaria no motor do sistema do _desenvolvedor_, não no do usuário final dele. E não dá para isolar quatro em paralelo. |
| CDP do WebView2 | Funciona de verdade, com `--remote-debugging-port`. Mas só no Windows. |
| WebDriver embutido | Existe plugin de comunidade cobrindo os três sistemas por ponte JS. Sem interceptação de rede, sem trace, sem screencast. |
| Empacotar CEF ou Chromium | CEF **é** Chromium: mesmo consumo de memória, mais buffers de textura. Custa o tamanho do instalador e três toolchains nativas, e ainda não dá Firefox nem WebKit. |

_[diagrama: Caminho dos quadros do Chromium até a interface e a volta da entrada]_

### 1 · Capturar, com contrapressão de graça

****plugins/browser/preview/cdp.ts****

```ts
const cdp = await context.newCDPSession(page);

await cdp.send("Page.startScreencast", {
  format: "jpeg", quality: 60,
  maxWidth: 1280, maxHeight: 800,
  everyNthFrame: 2,
});

cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  // plano de dados: bytes vão pelo socket binário
  frameSocket.write(frameHeader(worker, seq++, metadata), Buffer.from(data, "base64"));
  // plano de controle: NDJSON leva só o ponteiro
  emit({ kind: "browser.frame", worker, data: { seq, w: metadata.deviceWidth } });

  // ★ o Chromium não manda o próximo antes deste ack
  await cdp.send("Page.screencastFrameAck", { sessionId });
});
```

> **Nunca mande quadro pelo canal de eventos.** Quatro workers a 8fps com quadros de ~60KB, em base64 dentro de NDJSON, dão cerca de 2,5 MB/s de texto para parsear a cada segundo. A UI engasga exatamente quando você mais precisa dela. Separe os planos: controle em NDJSON, dados em binário.

### 2 · Guardar: um slot, não uma fila

****src-tauri/src/frames.rs****

```rust
pub struct Frames(DashMap<(RunId, u32), Frame>);

pub struct Frame { pub seq: u64, pub meta: FrameMeta, pub jpeg: Bytes }

impl Frames {
    // último vence: se a UI atrasar, ela pula quadros — comportamento correto
    pub fn put(&self, run: RunId, worker: u32, f: Frame) { self.0.insert((run, worker), f); }
    pub fn latest(&self, run: RunId, worker: u32) -> Option<Frame> { … }
}
```

### 3 · Exibir: protocolo customizado, zero base64

****src-tauri/src/lib.rs** e **ui/Preview.tsx****

```ts
Builder::default()
  .register_uri_scheme_protocol("venn-frame", |ctx, req| {
      let (run, worker) = parse_path(req.uri());
      match ctx.app_handle().state::<Frames>().latest(run, worker) {
          Some(f) => Response::builder()
              .header("Content-Type", "image/jpeg")
              .header("Cache-Control", "no-store")
              .body(f.jpeg.to_vec()),
          None => Response::builder().status(404).body(vec![]),
      }
  })

// o evento browser.frame só dispara o re-render; ?v= invalida o cache
<img ref={imgRef} src={`venn-frame://${run}/${worker}?v=${seq}`}
     onPointerDown={enviarClique} onKeyDown={enviarTecla} tabIndex={0} />
```

### 4 · Entrada de volta: a conversão de coordenadas

O `<img>` está escalado para caber no painel, e a página tem escala e rolagem próprias. Errar essa conta faz o clique cair no lugar errado — e o sintoma parece bug do teste, não da UI.

****ui/Preview.tsx**os três espaços de coordenada**

```ts
function paraPagina(e: PointerEvent, img: HTMLImageElement, m: FrameMeta) {
  const r = img.getBoundingClientRect();
  // 1. CSS do painel → 2. pixels do dispositivo → 3. coordenada de página
  const dx = (e.clientX - r.left) / r.width  * m.deviceWidth;
  const dy = (e.clientY - r.top)  / r.height * m.deviceHeight;
  return {
    x: dx / m.pageScaleFactor + m.scrollOffsetX,
    y: dy / m.pageScaleFactor + m.scrollOffsetY,
  };
}

async function enviarClique(e) {
  const { x, y } = paraPagina(e, imgRef.current!, meta);
  await invoke("venn_command", { method: "input.mouse", params: {
    run, worker, type: "mousePressed", x, y, button: "left", clickCount: 1,
  }});
}
```

No runner, o comando vira CDP direto — `Input.dispatchMouseEvent` e `Input.dispatchKeyEvent`. Note que `metadata` chega junto de cada quadro, então a conversão sempre usa a escala e a rolagem daquele instante, não uma cópia velha.

### 5 · Focus, Parallel e Headless são orçamento de quadros

> **O botão Headless não pode alterar como o teste roda.** Se ele alternar `headless: true/false` no lançamento, você cria a categoria clássica "passa com janela, falha sem". Rode **sempre** headless — o headless novo do Chromium renderiza igual ao headed — e deixe o botão controlar apenas se a UI assina o fluxo de quadros. A execução é bit a bit idêntica nos três modos.

| Modo | O que muda |
| --- | --- |
| Focus | Um worker a 8fps, resolução cheia |
| Parallel | Grade; o worker sob o cursor a 8fps, os demais a 1fps e meia resolução |
| Headless | `Page.stopScreencast` em todos. Nada mais. |
| Aba oculta | Screencast suspenso automaticamente — é o maior ganho de CPU disponível |

### 6 · A porta PreviewProvider

`Page.startScreencast` é CDP, ou seja, só Chromium. Os outros motores usam captura em laço. Pela regra das duas implementações, isto é porta legítima:

| Implementação | Motores | Custo |
| --- | --- | --- |
| cdp-screencast | Chromium | Baixo; contrapressão nativa |
| screenshot-poll | Firefox, WebKit | Alto; 2–3fps, só com painel visível |
| cef-osr | Chromium embutido | Futuro; textura GPU sem round-trip, ao preço de empacotar Chromium |
| none | Todos | Zero; padrão em CI |

### 7 · Memória: contexts, não browsers

Quatro workers **não** precisam de quatro browsers. Precisam de um browser e quatro `BrowserContext` — isolamento de cookies, storage e cache sem uma pilha completa por worker. É a maior economia disponível e depende só de como o seu scheduler abre as coisas.

| Alavanca | Efeito |
| --- | --- |
| Um browser, N contexts | O maior de todos |
| Bloquear imagem, fonte e mídia por rota em flow sem pixel | Grande |
| `chrome-headless-shell` no lugar do Chrome completo | Médio |
| `--disable-gpu` quando headless | Médio |
| `@browser(lightpanda)` em flow que não olha pixel | Enorme, com as limitações do motor |

****venn.toml**o scheduler respeita a máquina**

```toml
[runner]
workers      = "auto"       # lê a RAM livre e limita a concorrência
memoryBudget = "60%"        # degrada para 2 workers num notebook de 8GB
contexts     = "shared"     # um browser por worker-pool, não por worker
```

### 8 · O bônus: take-over e Record saem de graça

O canal de entrada já existe, então duas funcionalidades grandes vêm quase sem código novo:

**Assumir o controle** — Pausar a execução e deixar o usuário clicar no preview. Os eventos já viajam por `Input.dispatch*` — só falta suspender o scheduler.

**Gravar** — Enquanto o usuário interage, o runner observa os eventos reais do DOM e emite steps `.vn`. É exatamente a aba Record: uma infraestrutura, três produtos.


---

## 20 · Exemplo completo

Um arquivo que exercita toda a linguagem: módulos, tipos, dados, recursos escopados, autenticação, controle de fluxo, os seis protocolos, asserções, artefatos, carga e relatório.

****src/checkout.vn**cobre 100% das construções**

```venn
# ═══ checkout.vn — pipeline "Checkout E2E" ════════════════════
module acme.checkout

# ---------- capacidades ----------
import { http } from "venn/http"
import { browser as web } from "venn/browser"
import { graphql as gql } from "venn/graphql"
import { grpc } from "venn/grpc"
import { ws } from "venn/ws"
import { mqtt } from "venn/mqtt"
import { mail } from "venn/mail"
import { db } from "venn/db"
import { mock } from "venn/mock"
import { auth } from "venn/auth"
import { data } from "venn/data"
import { assert } from "venn/assert"
import { load } from "venn/load"
import { artifacts } from "venn/artifacts"
import { notify } from "venn/notify"
import { stripe } from "@acme/stripe"

# ---------- valores ----------
import { User, Cart }  from "#shared/models.vn"
import { loginViaApi } from "#shared/auth.vn"
import baseline        from "#fixtures/orders.json"

# ---------- configuração ----------
config {
  baseUrl: env.BASE_URL
  timeout: 60s
  retries: 1
}

matrix {
  browser: ["chromium", "webkit"]
  locale:  ["pt-BR", "en-US"]
}

# ---------- dados ----------
type Plan = "free" | "pro"

const clientes = data.csv("#fixtures/users.csv")

# ---------- recursos ----------
const banco = db.connect env.DATABASE_URL
defer { banco.close() }

const navegador = web.launch { engine: matrix.browser, headless: true }
defer { navegador.close() }

const pagina = navegador.newContext { locale: matrix.locale, viewport: { width: 1280, height: 800 } }
defer { pagina.close() }

# ---------- autenticação ----------
auth.oauth2 "principal" {
  grant:   "password"
  tokenUrl: "/oauth/token"
  scope:   ["orders:write", "profile:read"]
  refresh: "auto"
  totp:    secrets.totpSeed
}

# ---------- ciclo de vida ----------
setup {
  db.seed baseline
  db.exec "TRUNCATE orders CASCADE"
  mock.start "payments" { from: "./mocks/stripe.yaml" }
  mock.flag "new-checkout" = true
}

@lock("relogio")
beforeEach {
  http.reset
  web.clearCookies
  mock.clock.freeze 2026-07-23T12:00:00Z
}

afterEach { artifacts.flush }

teardown {
  mock.stop
  mock.clock.reset
  db.exec "DELETE FROM orders WHERE is_test = true"
}

# ---------- fluxo principal ----------
@id("flow-checkout")
@tags(smoke, critical, e2e)
@timeout(120s)
@retry(2, { backoff: 1s, factor: 2 })
@doc("Jornada completa: login, carrinho, estoque em tempo real, pagamento, e-mail e conciliação.")
flow "Checkout" {

  forEach cliente in clientes { concurrency: 4 } {

    # ── autenticação via fragmento importado ──
    run loginViaApi(cliente) as sessao
    capture token = sessao.token

    # ── leituras independentes em paralelo ──
    parallel {
      @id("step-gql")
      step "Perfil (GraphQL)" {
        gql.query "{ me { id plan credits } }" { auth: auth.bearer(token) }
        expect res.json noGraphqlErrors
        expect res.json.me.plan == cliente.plan
      }

      @id("step-grpc")
      step "Estoque (gRPC)" {
        grpc.call "Inventory/Check" { sku: "sku-42" }
        expect res.available == true
        capture disponivel = res.quantity
      }
    }

    # ── ramificação por plano ──
    if cliente.plan == "pro" {
      step "Benefícios pro" {
        http.get "/api/pro/benefits" { auth: auth.bearer(token) }
        expect res.status == 200
        expect res.json.discount closeTo 0.10 { within: 0.001 }
      }
    } else {
      log "cliente free — sem desconto"
    }

    # ── UI ──
    @id("step-dashboard")
    step "Abrir dashboard" {
      web.visit "/dashboard" { headers: { Authorization: "Bearer ${token}" } }
      web.waitFor { text: "Welcome back", timeout: 10s }
      expect pagina.a11y noViolations { level: "AA" }
      web.screenshot "dashboard"
      expect pagina matchesBaseline { threshold: 0.1% }
    }

    @id("step-cart")
    step "Adicionar ao carrinho e anexar comprovante" {
      web.click "[data-add=sku-42]"
      web.upload "#receipt" { file: "./assets/receipt.pdf" }
      expect element("#cart-badge").text == "1"
      defer { web.click "[data-clear-cart]" }
    }

    # ── tempo real: quem responder primeiro vence ──
    @id("step-realtime")
    step "Estoque em tempo real" {
      ws.connect "wss://${env.WS_HOST}/stream" { auth: auth.bearer(token) }
      mqtt.connect env.MQTT_BROKER
      mqtt.publish "inventory/sku-42" { json: { delta: -1 }, qos: 1 }

      race { timeout: 5s } {
        step "Via WebSocket" { ws.expect { where: msg.type == "stock.updated" } }
        step "Via MQTT"      { mqtt.expect "inventory/ack" }
      }

      expect disponivel - 1 == res.quantity
    }

    # ── pagamento com fallback ──
    @id("step-pay")
    step "Pagar" {
      try {
        mock.intercept "POST" "**/charge" { respond: mock.payments.success }
        web.fill "#card" data.faker.creditCard
        web.click "Pagar agora"
        web.waitForUrl "/success"
      } catch erro {
        log "cartão falhou (${erro.code}) — caindo para boleto"
        http.post "/api/pay/boleto" { auth: auth.bearer(token) }
        expect res.status == 201
      } finally {
        mock.reset
      }
    }

    # ── e-mail ──
    @id("step-mail")
    step "E-mail de confirmação" {
      mail.inbox "mailpit"
      mail.waitFor { to: cliente.email, subject: ~"Order confirmed", within: 30s }
      expect mail.body contains "Total: $99.00"
      expect mail.attachments hasLength 1
      capture orderId = mail.body ~= r"Order #(\d+)" { group: 1 }
    }

    # ── conciliação em banco, com espera ativa ──
    @id("step-db")
    @lock("orders")
    step "Conciliar no banco" {
      repeat 10 as tentativa {
        db.query "SELECT status, total FROM orders WHERE id = ${orderId}"
        if row.status == "paid" { break }
        wait 500ms
      }
      expect row.status == "paid"
      expect row.total closeTo 99.00 { within: 0.01 }
      expect.soft row.updated_at > row.created_at
    }
  }

  on failure {
    web.screenshot "falha"
    artifacts.save trace, video, har, console
  }
  on retry { log "retentativa do flow Checkout" }
}

# ---------- não funcional ----------
@id("flow-load")
@tags(perf)
@load({
  target:  "/api/checkout"
  profile: load.ramp(0 -> 200, { over: 2m, hold: 5m })
  thresholds: {
    p95:       "< 800ms"
    p99:       "< 1500ms"
    errorRate: "< 1%"
  }
})
flow "Carga do checkout" {
  step "Criar pedido" {
    http.post "/api/checkout" { json: { sku: "sku-42", qty: 1 } }
    expect res.status == 201
  }
}

# ---------- saída ----------
on failure { notify.slack "#qa" { mention: "@oncall" } }
```


---

## 21 · Gramática Langium — esqueleto

Isto é o arquivo inteiro. Repare que não existe uma única palavra de protocolo aqui: `ActionCall` absorve tudo.

****venn.langium**~70 regras, congela na v1.0**

```langium
grammar Venn

entry Document:
  ('module' name=QualifiedName)?
  imports+=ImportDecl*
  decls+=Declaration*;

ImportDecl: ValueImport;
ValueImport: export?='pub'? 'import'
  ( '{' names+=ImportName (',' names+=ImportName)* '}'
  | '*' 'as' ns=ID
  | default=ID ) 'from' path=STRING;
ImportName: name=ID ('as' alias=ID)?;

Declaration:
  annotations+=Annotation*
  ( FlowDecl | FragmentDecl | FnDecl | TypeDecl | FactoryDecl
  | DatasetDecl | ResourceDecl | ConstDecl | ConfigDecl
  | MatrixDecl | LifecycleDecl | ReportDecl | ActionCall );

Annotation: '@' name=ID ('(' args=ArgList ')')?;

FlowDecl:     'flow'     title=STRING body=Block;
FragmentDecl: export?='pub'? 'fragment' name=ID '(' params=ParamList? ')'
                ('->' returns=TypeRef)? body=Block;
StepDecl:     'step'     title=STRING body=Block;
GroupDecl:    'group'    title=STRING body=Block;
LifecycleDecl: kind=('setup'|'teardown'|'beforeEach'|'afterEach'|'defer') body=Block
  | 'on' event=ID ('(' arg=Expr ')')? body=Block;

Block: '{' stmts+=Statement* '}';

Statement:
  annotations+=Annotation*
  ( StepDecl | GroupDecl | IfStmt | ForEachStmt | RepeatStmt
  | WhileStmt | ParallelStmt | RaceStmt | TryStmt | LifecycleDecl
  | LetStmt | CaptureStmt | ExpectStmt | RunStmt | ReturnStmt
  | BreakStmt | ContinueStmt | ActionCall );

IfStmt:       'if' cond=Expr then=Block ('else' else=(IfStmt|Block))?;
ForEachStmt:  'forEach' item=ID 'in' src=Expr opts=MapLit? body=Block;
RepeatStmt:   'repeat' count=Expr ('as' idx=ID)? body=Block;
LoopStmt:     'loop' (state=LoopState | cond=Expr)? body=Block;
LoopState:    name=ID '=' initial=Expr;
ParallelStmt: 'parallel' opts=MapLit? body=Block;
RaceStmt:     'race'     opts=MapLit? body=Block;
TryStmt:      'try' body=Block ('catch' err=ID? handler=Block)?
                            ('finally' final=Block)?;

LetStmt:     'let'     name=ID '=' value=Expr;
CaptureStmt: 'capture' name=ID '=' value=Expr opts=MapLit?;
RunStmt:     'run' ref=[FragmentDecl:QualifiedName] '(' args=ArgList? ')' ('as' bind=ID)?;

// asserção: `expect` é kernel, o matcher é resolvido no registry
ExpectStmt: 'expect' (soft?='.soft' | all?='.all')?
  ( body=Block | negate?='not'? subject=Expr (matcher=ID args=ArgList? opts=MapLit?)? );

// ★ a regra que absorve todo protocolo, presente e futuro
ActionCall: target=QualifiedName args+=Expr* opts=MapLit?;

QualifiedName: ID ('.' ID)*;
```

> **Sobre o highlight.** A gramática não distingue `http.post` de `meuHelper.foo` — ambos são `ActionCall`. Quem colore corretamente é o **semantic token provider** do LSP, consultando o registry. Uma gramática TextMate serve só de fallback enquanto o servidor não respondeu. Não mantenha duas descrições da linguagem.


---

## 22 · Mapa AST ↔ node graph

Toda construção precisa de representação visual definida _antes_ de você escrever o editor gráfico. Onde não houver, o round-trip quebra.

| Construção | Nó no grafo | Edição no grafo |
| --- | --- | --- |
| flow | Canvas raiz com nó Start e End | renomear, anotações via painel |
| step | Nó simples, 1 entrada / 1 saída | total |
| group / fragment | Container colapsável (subflow) | total, expansível |
| ActionCall | Nó tipado; formulário gerado do schema Zod | total |
| expect | Nó losango de asserção | total |
| capture / let | Porta de saída nomeada no nó anterior | renomear |
| if / else | Nó de decisão, N saídas rotuladas | total |
| forEach | Container de laço com badge de concorrência | total |
| parallel / race | Fork-join com raias paralelas | total |
| try / catch / finally | Container com borda de erro e saída alternativa | total |
| repeat / loop | Container com aresta de retorno | editar condição |
| on / defer | Nó ancorado na borda do container | total |
| setup / teardown | Faixas fixas acima e abaixo do canvas | total |
| fn, type, expressão complexa | Nó "código" somente leitura | abre o editor de texto naquele trecho |

> **Onde guardar o layout.** Posição de nó não pertence à linguagem. Guarde em `checkout.vn.layout.json` indexado pelo `@id`. Nós sem `@id` recebem um ID derivado do caminho da AST; ao arrastar um nó pela primeira vez, o editor materializa a anotação `@id` no texto. Assim o layout sobrevive a refatorações sem poluir arquivos que ninguém abriu no grafo.


---

## 23 · Tokens do tema

Estes são os `semanticTokenTypes` que o LSP deve emitir. As cores abaixo são as usadas neste documento — servem como tema inicial do editor.

| Token | Cor | Aplica em |
| --- | --- | --- |
| keyword | #9A8CF0 | controle de fluxo, estrutura, ciclo de vida |
| keyword.declaration | #E28AB8 | module, import, fn, fragment, type |
| namespace | #E0A33E | segmento inicial resolvido no registry |
| function.action | #5FA8E8 | ação após o namespace |
| function.matcher | #84C654 | matcher após expect |
| decorator | #84C654 | anotações |
| string | #45C4A8 | literais de texto |
| number | #E8705A | números, durações, tamanhos, percentuais |
| regexp | #E28AB8 | literais de expressão regular |
| type | #E0A33E | tipos nominais |
| comment | #5D6577 | comentários |

### Modificadores

`declaration` · `readonly — const, capture` · `async — ação com await` · `deprecated — do registry` · `defaultLibrary — prelude e stdlib`


---

### O que ficou de fora de propósito

Coisas que parecem faltar mas não faltam: **classes e herança** (composição por `fragment` basta e mantém o grafo desenhável), **loops que se explicam sozinhos** (`loop` roda até `break`, e o que encerra um que devia ter encerrado é o timeout do step ou do flow, não um contador de iterações), **chamada arbitrária de shell** (isso é plugin, com sandbox), e **expressões lambda** (empurram a linguagem para Turing-completa e destroem a garantia de que todo código tem representação visual).

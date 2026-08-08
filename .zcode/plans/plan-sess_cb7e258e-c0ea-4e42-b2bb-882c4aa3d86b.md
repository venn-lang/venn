# Plano: Sistema de Tipos + Macros + Prelude em Rust

## Decisões travadas

- **Checker em Rust** — type checker vive em `crates/`, junto do parser
- **Hindley-Milner completo** — unify/fits, generalize/instantiate, Scheme para generics, two-pass seeding, contextual typing
- **Macros compile-time estilo Zig comptime** — interpretador Venn embedado no compilador; `deco` recebe a AST como valor Venn, modifica tudo, gera nós arbitrários
- **Fundação completa** — type system inteiro + macros + prelude numa fase

## Arquitetura do crate Rust

O crate `venn-parser` vira `venn-compiler` com módulos:

```
crates/venn-compiler/
  Cargo.toml
  src/
    lib.rs                    # NAPI exports: parse, check, expand
    lexer/                    # (já existe: tokens, tokenizer, newline)
    parser.rs                 # (já existe: AST recursivo-descendente)
    ast/                      # (já existe: tipos AST + serde)
      mod.rs                  # AST nodes
      span.rs                 # Span, Location
    types/                    # NOVO: sistema de tipos
      mod.rs                  # Type, TypeVar, Declared, union()
      spec.rs                 # TypeSpec (wire format JSON-able)
      build.rs                # t.* builders (t.string, t.fn, t.list...)
      show.rs                 # type → texto para hover
      scheme.rs               # Scheme { quantified, type }, generalize, instantiate, applyTo
      catalog.rs              # TypeCatalog trait (plugin types)
      spec_to_type.rs         # TypeSpec → Type (one-way bridge)
      builtin.rs              # primitives, kind types, prelude types
    check/                    # NOVO: type checker (HM)
      mod.rs                  # check_types(doc, catalog) → CheckResult
      infer.rs                # inferExpr, inferStmt (core engine)
      unify.rs                # unify(a, b) — can these be made equal?
      fits.rs                 # fits(actual, expected) — is assignable?
      narrow.rs               # narrowing (if x != null, discriminated unions)
      lambda_params.rs        # contextual typing (xs.map(x => ...) → x inferred)
      seed_params.rs          # two-pass seeding for unannotated fn params
      named_types.rs          # collect user type declarations
      type_ref.rs             # resolve TypeRef annotations
      imported.rs             # cross-module type resolution
      errors.rs               # CheckError, error codes VNxxxx
    expand/                   # NOVO: macro/decorator expansion
      mod.rs                  # expand(doc, decos) → Document (com AST reescrita)
      context.rs              # ExpandContext: replace, remove, meta, reject
      handle.rs               # handle value: wraps AST node, exposes verbs
      macro_env.rs            # environment for comptime Venn execution
    comptime/                 # NOVO: interpretador Venn embedado
      mod.rs                  # ComptimeEngine: roda Venn em compile-time
      value.rs                # ComptimeValue: AST node, list, map, fn, string, number
      eval.rs                 # avalia expressões Venn no comptime
      builtins.rs             # funções builtins do comptime (ast.kind, ast.fields, etc.)
    prelude.rs                # NOVO: nomes disponíveis sem import
```

## Sistema de tipos — design

### As 11 formas (TypeSpec — wire format)

| kind | o que é |
|---|---|
| `prim` | string, number, bool, null, void, duration, size, percent, instant |
| `literal` | valor exato: "GET", 200, true |
| `list` | homogênea: list<T> |
| `map` | chaves desconhecidas, valores uniformes: map<V> |
| `record` | campos conhecidos, optional?, open? |
| `fn` | params, result, takes? (callback ignora trailing), variadic? |
| `union` | membros: T \| U |
| `opaque` | nome + members opcionais (boundary com JS) |
| `ref` | nome resolvido via catalog: http.Request |
| `param` | parâmetro de tipo T (só dentro de assinatura) |
| `dynamic` | unknown; unifica com tudo, nunca erro |

### Type interno (para HM)

```
Type = TypeVar (id, ref mut Option<Type>)
     | Prim(name)
     | Literal(value)
     | List(element)
     | Map(value)
     | Record { fields: Map<String,Type>, optional: Set<String>, open: bool, rest: Option<Type> }
     | Fn { params: Vec<Type>, result: Type, ignorable_from: Option<usize>, variadic: bool }
     | Union(members: Vec<Type>)
     | Opaque { name: String, members: Option<Map<String,Type>> }
     | Dynamic

Todo Type carrega `named: Option<String>` ao lado (tag nominal).
```

### Regras chave (portadas do projeto antigo)

1. **Structural por padrão, nominal quando ambos nomeados.** `{id: string}` flui para `Pedido`, mas `Pedido` não flui para `Order` (mesmo shape, nomes diferentes).
2. **Unify vs Fits separados.** `unify(a,b)` = podem ser iguais (bidirectional, infere). `fits(actual,expected)` = é atribuível (directional). Uniões são assimétricas: `string|null` unifica com `string` mas não fits.
3. **Opcional = T | null.** `campo?: int` é `int | null`. Ausência === null.
4. **Dynamic unifica com tudo.** A linguagem roda com zero anotações.
5. **Generics via Scheme.** `fn id(x) => x` vira `∀t. t -> t` por generalização. `type Box<T> = {held: T}` declara params.
6. **Two-pass seeding.** `fn route(req) { req.url }` — Pass 1 monomórfico infere `req` dos callers. Pass 2 usa o seed. Se conflito, descarta (fica polymorphic).
7. **Narrowing.** `if x != null` estreita. Discriminated unions em `match`/`if` chains. Chains devem ser exaustivas (VN3019/VN3020).
8. **Contextual typing.** `xs.map(x => ...)` — o callback já sabe o tipo de `x` da assinatura de `map`.

## Macros compile-time (estilo Zig comptime)

### O `deco` declaration

```venn
deco memoize(target: Fn) {
  # `target` é um valor Venn que envolve o AST node da fn decorada
  let name = target.name
  let params = target.params
  
  # Pode ler e modificar tudo:
  target.wrap { (args) =>
    cache.get(args) ?? target.call(args)
  }
}

@memoize
fn fib(n: number) -> number {
  if n < 2 { return n }
  return fib(n - 1) + fib(n - 2)
}
```

### Como funciona

1. **Fase de expansão** roda entre parse e check. Para cada `@name(args)` annotation, procura o `deco name`.
2. O `deco` body é executado no **interpretador Venn embedado** (`comptime/`). Este interpretador roda Venn puro, mas com primitivas extras para manipular AST.
3. `target` é um `ComptimeValue::Node(AstNode)` — a AST envolvida como valor Venn. O macro pode:
   - Ler: `target.name`, `target.params`, `target.body`, `target.kind`
   - Modificar: `target.name = "novo"`, `target.addParam("x")`, `target.removeParam("y")`
   - Gerar: `target.wrap(callback)` envolve a fn original
   - Substituir: `target.replace(novoNode)` troca o nó inteiro
   - Remover: `target.remove()` deleta a declaração
   - Anexar metadata: `target.meta("retry", 3)` para o runtime ler
   - Rejeitar: `reject("code", "message")` emite erro de compilação
4. A AST modificada é o que o checker e o emitter veem. É real: a árvore mudou.

### O interpretador comptime

Não é o interpretador tree-walking do runtime (que não existe mais — temos emitter). É um interpretador **minimalista** que roda subset de Venn em compile-time:
- Literais, refs, binary, unary, ternary
- `let`/`const`, `if`/`else`, `forEach`, `match`
- `fn` expressions (closures)
- Chamadas de função
- Member access e index
- **Primitivas de AST**: `ast.kind`, `ast.name`, `ast.fields`, `ast.addParam()`, etc.

Implementado em Rust, no módulo `comptime/`. É pequeno (~500 linhas) porque só precisa do subset que faz sentido em compile-time (sem I/O, sem async, sem verbos).

### O que pode ser decorado

Tudo: `fn`, `type`, `let`/`const`, declarações de namespace, statements, parâmetros, fields de type. A annotation `@name(args)` aparece em qualquer posição de declaração.

## Prelude

Nomes disponíveis sem import:

**Valores** (em expressões): `regex`, `spawn`, `range`, `str`, `typeOf`, `pretty`
**Verbos** (statements): `print`, `log`, `wait`, `skip`, `fail`, `exit`
**Tipos**: `string`, `number`, `bool`, `null`, `void`, `dynamic`, `duration`, `size`, `percent`, `instant`, `regex`, `task`, `error`, `list`, `map`, `fn`

## Plano de execução (fases dentro desta etapa)

### Fase A: Reestruturar crate
- Renomear `crates/venn-parser` → `crates/venn-compiler`
- Criar módulos `types/`, `check/`, `expand/`, `comptime/`, `prelude.rs`
- Atualizar Cargo.toml, NAPI bindings

### Fase B: Sistema de tipos (types/)
- `Type` interno com `named` tag, `TypeVar`, todas as formas
- `TypeSpec` wire format + `t.*` builders + serde
- `Scheme` para generics (generalize, instantiate, applyTo)
- `union()` construtor com normalização
- `show()` para renderizar tipos em texto
- `TypeCatalog` trait

### Fase C: Type checker (check/)
- `unify` e `fits` (algoritmo HM central)
- `inferExpr` para cada nó de expressão
- `checkStmts` para statements
- `collectNamedTypes` para `type` declarations
- `typeRefToType` para resolver anotações
- Contextual typing (lambda params)
- Two-pass seeding
- Narrowing (if, match, discriminated unions)
- Cross-module imports
- Error codes VNxxxx

### Fase D: Comptime engine (comptime/)
- `ComptimeValue` (Node, List, Map, Fn, String, Number, Bool, Null)
- Interpretador do subset Venn
- Primitivas de AST (read/write/generate)
- Pré-builtins (ast.kind, ast.name, target.wrap, target.replace, etc.)

### Fase E: Macro expansion (expand/)
- `ExpandContext` (replace, remove, meta, reject)
- Handle wrapping AST node
- Fase de expansão entre parse e check
- Aplicação innermost-first, innermost-first para decorators stacked

### Fase F: Prelude e integração
- `prelude.rs` com todos os nomes
- Integração: parse → expand (macros) → check (tipos) → emit (JS)
- Atualizar emitter para usar type info (ex: método conhecido vs field access)
- Testes ponta-a-ponta

### Gates por fase
- Fase A: crate reestruturado, NAPI ainda funciona, hello.vn ainda roda
- Fase B: testes de tipos passam (TypeSpec round-trip, union normalização, show)
- Fase C: programa tipado passa no checker sem erros; programa com erro de tipo é rejeitado
- Fase D: macro simples (`deco noop(target: Fn) { }`) executa sem erro
- Fase E: macro que modifica AST (`deco rename(target: Fn) { target.name = "novo" }`) muda a árvore
- Fase F: programa com types + decorators + prelude funciona ponta-a-ponta
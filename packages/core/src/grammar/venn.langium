grammar Venn

// Statements and declarations are separated by `NL` (a newline or `;`).
// `NL` is suppressed inside `( )` and `[ ]` by the lexer, so calls, arg lists
// and list literals may still span multiple physical lines.
// Newlines follow each item rather than preceding it, so there is a single
// leading `NL*` and no two unbounded newline consumers meet at a decision
// point, which Chevrotain reports as ambiguous.
entry Document:
    NL*
    ('module' name=QualifiedName NL*)?
    (imports+=ImportDecl NL*)*
    (decls+=Declaration NL*)*;

// One way in. Everything a file reaches that did not come with the language is
// named here, by the name the file gives it.
ImportDecl: ValueImport;

// Everything a file reaches by name arrives here, whether it was written in
// another `.vn` or published by a package: `import { http } from "venn/http"`
// brings the namespace, and `as` names it something else where two would clash.
ValueImport:
    (export?='pub')? 'import'
    ( '{' names+=ImportName (',' names+=ImportName)* '}'
    | '*' 'as' wildcard=ID
    // Only a package has one of these: a `.vn` module publishes by name with
    // `pub` and has no default to bind. Written against a module, it is the
    // diagnostic in #178, not a name that quietly holds nothing.
    | default=ID )
    'from' path=STRING;

ImportName: name=ID ('as' alias=ID)?;

// The top level of a file. In test mode the runner picks out the `flow`s; in
// script mode it executes the statements top to bottom, the file itself being
// the program. Declarations (flow/fn/type/…) only run when called.
Declaration:
    (annotations+=Annotation NL*)*
    ( FlowDecl | FragmentDecl | FnDecl | DecoDecl | TypeDecl
    | ConfigDecl | MatrixDecl | LifecycleDecl
    | IfStmt | ForEachStmt | RepeatStmt | LoopStmt | ParallelStmt | RaceStmt
    | TryStmt | RunStmt | LetStmt | AssignStmt | ExpectStmt | MatchExpr | ActionCall );

Annotation: '@' name=ID ('(' (args=ArgList)? ')')?;

FlowDecl: 'flow' title=STRING body=Block;

FragmentDecl:
    (export?='pub')? 'fragment' name=ID '(' (params=ParamList)? ')'
    ('->' returns=TypeRef)? body=Block;

// A pure function (§08: no steps, no I/O). Its body is one expression after
// `=>`, or a block of local bindings ending in the expression it returns.
// The last expression is the return value; `return` is optional and explicit.
FnDecl:
    (export?='pub')? 'fn' name=ID '(' (params=ParamList)? ')'
    ('->' returns=TypeRef)? body=FnBody;

// One expression after `=>`, or a block: statements, then the value.
//
// The statements are named rather than taken from `Statement`, and that is what
// keeps "the last expression is the value" a rule. A bare expression is not one
// of them, so the last line of a block can only be the value, whether or not a
// newline follows it. It is also where a function's purity lives: a step, an
// `expect` and a plugin verb are absent because a `fn` cannot reach the world,
// and saying so here is shorter than saying it in a check.
FnBody:
    '=>' result=Expr
  | '{' NL* (stmts+=FnStmt NL+)* ('return'? result=Expr NL*)? '}';

/** What a pure function may do: bind, decide, loop, and give a value back. */
FnStmt infers Statement:
    LetStmt | AssignStmt | IfStmt | ForEachStmt | RepeatStmt | LoopStmt
  | ReturnStmt | BreakStmt | ContinueStmt;

// A decorator written in the language itself. The first parameter *is* the
// target, and the type on it (`Fn`, `Flow`, `Step`, `Binding`, `Type`,
// `Resource`, `Node`) is what this decorates, so nothing written here names a
// node of the compiler's own tree. The parameters after it are the decorator's
// own arguments: `@retry(3)` binds the second one. The body runs at expansion
// time, before the program exists, so it is pure the way `fn` is. The checker
// enforces that, not the grammar.
DecoDecl:
    (export?='pub')? 'deco' name=ID '(' (params=ParamList)? ')' body=Block;

ConfigDecl: 'config' body=MapLit;
MatrixDecl: 'matrix' body=MapLit;

// `type Box<T> = { held: T }`: the parameters stand for types the user of the
// name fills in. A `fn` needs none, because inference generalises one already:
// `fn first(xs) => xs[0]` is used at two element types without saying so.
TypeDecl:
    (export?='pub')? 'type' name=ID ('<' params+=ID (',' params+=ID)* '>')?
    ('=' alias=TypeRef | body=TypeBody);
TypeBody: '{' (',' | NL)* fields+=FieldDecl ((',' | NL)+ fields+=FieldDecl)* (',' | NL)* '}';
// A field carries decorators like anything else. The `NL*` is what lets the
// annotation sit on its own line, which is where everyone writes it, and it
// cannot be mistaken for the separator between fields: a field starts with `@`
// or a name, never with a newline.
FieldDecl: (annotations+=Annotation NL*)* name=ID (optional?='?')? ':' fieldType=TypeRef;

ParamList: params+=Param (',' params+=Param)*;
// A parameter carries decorators too. No `NL*` here: a parameter list lives
// inside `( )`, where the lexer already dropped the newlines.
Param: (annotations+=Annotation)* (name=ID | pattern=ShapePattern) (':' paramType=TypeRef)?;

TypeRef: members+=SingleType ('|' members+=SingleType)*;
SingleType:
    {infer NamedType} name=QualifiedName ('<' args+=TypeRef (',' args+=TypeRef)* '>')?
  | {infer LiteralType} value=STRING
  // `null` is a keyword rather than a name, so it needs saying here or the most
  // common union there is, `T | null`, cannot be written at all.
  | {infer NullType} 'null'
  // A shape written where it is used, for the one that is not worth a name of
  // its own. The same `{ … }` a `type` declares, so the two read alike and the
  // checker builds the same record from either.
  | {infer ShapeType} body=TypeBody;

Block: '{' NL* (stmts+=Statement (NL+ stmts+=Statement)* NL*)? '}';

Statement:
    (annotations+=Annotation NL*)*
    ( StepDecl | GroupDecl | IfStmt | ForEachStmt | RepeatStmt | LoopStmt
    | ParallelStmt | RaceStmt | TryStmt | LifecycleDecl | LetStmt | CaptureStmt
    | ExpectStmt | RunStmt | ReturnStmt | BreakStmt | ContinueStmt | MatchExpr
    | AssignStmt | ActionCall );

StepDecl: 'step' title=STRING body=Block;
GroupDecl: 'group' title=STRING body=Block;

IfStmt: 'if' cond=Expr then=Block ('else' otherwise=ElseBranch)?;
ElseBranch: IfStmt | Block;

ForEachStmt: 'forEach' (item=ID | pattern=ShapePattern) 'in' source=Expr (opts=MapLit)? body=Block;
RepeatStmt: 'repeat' count=Expr ('as' index=ID)? body=Block;
// The open loop: one word, three shapes.
//
//   loop { … }                 forever, until `break` or `return`
//   loop count > 0 { … }       while the condition holds
//   loop total = 0 { … }       carrying a value, advanced by `continue`
//
// One word rather than four, because "which loop do I write" should have one
// answer per intent: `repeat` when the count is known, `forEach` when there is a
// collection, `loop` when neither. `while` was the fourth, it answered the same
// question as this one, and in a language with no assignment its condition could
// never be moved by its own body: every `while` anybody wrote needed a `break` to
// avoid hanging, including the one in the tutorial.
//
// The state is bound once per pass, so a name still means one value: `continue
// next` starts the following pass with a fresh binding, and after the loop the
// name holds whatever the last pass left.
LoopStmt: 'loop' (state=LoopState | cond=Expr)? body=Block;
LoopState: name=ID '=' initial=Expr;

ParallelStmt: 'parallel' (opts=MapLit)? body=Block;
RaceStmt: 'race' (opts=MapLit)? body=Block;
TryStmt:
    'try' body=Block
    ('catch' (error=ID)? handler=Block)?
    ('finally' finalizer=Block)?;

// What runs around the body rather than in it. `defer` is the lexical one: it
// belongs to the block it is written in; the named hooks belong to the run.
//
// `on` reacts to an event of the *run*: `on failure`, `on success`. Not to one
// of the machine, because a program being stopped is what `teardown` already
// means, and a second spelling for it would make one word mean two things.
LifecycleDecl:
    hook=('setup' | 'teardown' | 'beforeEach' | 'afterEach' | 'defer') body=Block
  | 'on' event=ID ('(' arg=Expr ')')? body=Block;

// `let plan = "pro"` binds a value; `let auth = http.post url { … }` binds what
// an action returned. Both are one rule: `Expr` stops before a bare argument
// (same shape as `expect subject matcher`), so trailing args and opts, and only
// those, mark this as a call.
// `pub` is on the same rule rather than a second one, so a binding reads the
// same wherever it is written. A `pub` on one that is not at the top of a file
// is refused by the checker, not by the grammar: the message it can give names
// the file and the line, and a parse error at that point would name a token.
LetStmt:
    (export?='pub')? kind=('let' | 'const') (name=ID | pattern=ShapePattern) (':' declaredType=TypeRef)? '='
    value=Expr (args+=ActionArg)* (opts=MapLit)?;

// A pattern takes a value apart where a name would have taken all of it. Each
// shape mirrors the literal it reads: `{ … }` a map, `[ … ]` a list, and a bare
// name the whole thing, which is what makes the three nest in each other.
// A pattern is a name, a value to compare against, or a shape to go into. The
// shapes are their own rule because that is what a binding takes: `let x = …`
// binds a name, so reading `x` as a pattern that happens to be a name would be
// two ways to parse one line.
Pattern:
    ShapePattern
  | {infer NamePattern} name=ID
  // A name binds what is there, a literal asks whether that is what is there.
  // One rule, and it is what lets a pattern both test and take apart at once.
  | {infer LiteralPattern} value=LiteralValue;

ShapePattern:
  // `...rest` takes whatever the pattern did not name: the other fields as a map,
  // or the items after the last one, as a list. It comes last, because what is
  // left is only known once the rest of the pattern has had its say.
    {infer MapPattern} '{' NL*
      ( fields+=FieldPattern ((',' | NL)+ fields+=FieldPattern)* ((',' | NL)+ '...' rest=ID)?
      | '...' rest=ID )?
      (',' | NL)* '}'
  | {infer ListPattern} '[' NL*
      ( items+=Pattern ((',' | NL)+ items+=Pattern)* ((',' | NL)+ '...' rest=ID)?
      | '...' rest=ID )?
      (',' | NL)* ']';

// The literals a pattern may ask about, which are the ones a value can be equal
// to. The same nodes an expression is made of, so what they mean is decided once.
LiteralValue infers Expr:
    {infer StringLit} value=STRING
  | {infer NumberLit} raw=NUMBER
  | {infer BoolLit} value=('true' | 'false')
  | {infer NullLit} 'null';

// `{ id }` binds the field to its own name, `{ id: orderId }` to another one,
// and `{ user: { name } }` goes on taking it apart.
FieldPattern: name=ID (':' value=Pattern)?;

// Removed from the language: `capture` and `let` mean the same thing. Still
// parsed so the editor can say so and offer the one-word fix, instead of
// failing with a syntax error that explains nothing.
// `total = total + 1`, `user.name = "a"`, `items[0] = x`.
//
// The target is a name and the way into it, never an arbitrary expression: what
// can be written to is what has a place to write. Which of this and an action
// call a line is only becomes clear at the `=`, which is why the parser looks
// past the whole path before deciding.
AssignStmt: target=AssignTarget '=' value=Expr;

AssignTarget infers Expr:
    {infer Ref} name=RefName
    ( {infer Member.receiver=current} '.' member=Word
    | {infer Index.receiver=current} '[' index=Expr ']' )*;

CaptureStmt: 'capture' name=ID '=' value=Expr (opts=MapLit)?;
RunStmt: 'run' target=QualifiedName '(' (args=ArgList)? ')' ('as' bind=ID)?;
ReturnStmt: {infer ReturnStmt} 'return' (value=Expr)?;
BreakStmt: {infer BreakStmt} 'break';
ContinueStmt: {infer ContinueStmt} 'continue' (value=Expr)?;

// `expect` is boolean-expression based, or a bareword matcher clause. A newline
// (or `;`) after the subject terminates the statement, so a trailing matcher
// word is unambiguous with the next statement's leading identifier. `.all { … }`
// groups checks (one per line); `.soft` records without aborting.
ExpectStmt:
    'expect' ('.' modifier=('soft' | 'all'))?
    ( '{' NL* (checks+=Expr (NL+ checks+=Expr)* NL*)? '}'
    | (negate?='not')? subject=Expr (matcher=MatcherClause)? );

// A registry matcher applied to the subject: `contains "x"`, `oneOf [a, b]`,
// `closeTo 99.00 { within: 0.01 }`, `empty`. Args reuse ActionArg, never a bare
// map: the trailing `{ … }` is always `opts`.
MatcherClause: name=ID (args+=ActionArg)* (opts=MapLit)?;

// The rule that absorbs every protocol, present and future.
//
// The brackets are what make a method callable for its effect alone:
// `conn.close()` is a statement, not a value nobody reads. Which of the two a
// dotted target means, a plugin's verb or a method on something in scope, is
// decided by what the name resolves to, not by how the call is written.
ActionCall:
    target=QualifiedName (called?='(' (call=ArgList)? ')')?
    (args+=ActionArg)* (opts=MapLit)?;

// A positional argument: postfix over an Atom (member/index/call), but NEVER a
// bare map literal, since that trailing `{ … }` is always `opts`.
//
// A leading `-` negates it, which is the only way to write a negative argument:
// brackets after a value are always a call, so `print a (-1)` calls `a`. Read as
// the negation only when it is written as one, tight against the value it
// negates; with a space after it, it is a subtraction nobody bracketed, and the
// check that follows the parse says so.
ActionArg infers Expr:
    {infer Unary} operator='-' operand=ArgValue | ArgValue;

ArgValue infers Expr:
    Atom (
        {infer Member.receiver=current} (optional?='?.' | '.') member=Word
      | {infer Index.receiver=current} '[' index=Expr ']'
      | {infer Call.callee=current} '(' (args=ArgList)? ')'
    )*;

Expr: Ternary;

Ternary infers Expr:
    Coalesce ({infer Ternary.condition=current} '?' then=Expr ':' otherwise=Expr)?;

Coalesce infers Expr:
    LogicalOr ({infer Binary.left=current} operator='??' right=LogicalOr)*;

LogicalOr infers Expr:
    LogicalAnd ({infer Binary.left=current} operator='||' right=LogicalAnd)*;

LogicalAnd infers Expr:
    Equality ({infer Binary.left=current} operator='&&' right=Equality)*;

Equality infers Expr:
    Relational ({infer Binary.left=current} operator=('==' | '!=' | '~=') right=Relational)*;

Relational infers Expr:
    Additive ({infer Binary.left=current} operator=('<=' | '>=' | '<' | '>' | 'in') right=Additive)*;

Additive infers Expr:
    Multiplicative ({infer Binary.left=current} operator=('+' | '-') right=Multiplicative)*;

Multiplicative infers Expr:
    Unary ({infer Binary.left=current} operator=('*' | '/' | '%') right=Unary)*;

Unary infers Expr:
    {infer Unary} operator=('!' | '-') operand=Unary
  | Postfix;

Postfix infers Expr:
    Primary (
        {infer Member.receiver=current} (optional?='?.' | '.') member=Word
      | {infer Index.receiver=current} '[' index=Expr ']'
      | {infer Call.callee=current} '(' (args=ArgList)? ')'
    )*;

Primary infers Expr:
    Atom | MapLit | MatchExpr;

// The one construction that claims to enumerate. `if` asks a question and is not
// asked to cover anything; `match` says these are the cases, so a case nobody
// wrote is reported rather than falling through in silence.
//
// `=>` gives a value back and `{ … }` runs steps, which is the split `fn` and
// `flow` already make: an arm written as steps has no value, and cannot stand
// where one is wanted.
// Arms are separated by a newline, or by a comma where the newlines were taken
// away: inside `( )` the lexer drops them, the way it does for a map or a list,
// and those separate with commas there too.
MatchExpr infers MatchExpr:
    'match' subject=Expr '{' NL*
    (arms+=MatchArm ((',' | NL)+ arms+=MatchArm)* (',' | NL)*)? '}';

// An arm may be reached more than one way, written with `|`, the way a union of
// types is: `200 | 201 | 204` is one arm and three answers. Each way binds for
// itself, and the checker asks that they all bind the same names.
//
// A guard asks about anything the shape cannot. What separates it from a pattern
// is what a failure does: the arm is passed over and the next one is tried,
// which is why the condition cannot just live in the body.
MatchArm:
    patterns+=Pattern ('|' patterns+=Pattern)*
    ('if' guard=Expr)? ('=>' value=Expr | body=Block);

Atom infers Expr:
    {infer NumberLit} raw=NUMBER
  | {infer InstantLit} value=INSTANT
  | {infer StringLit} value=STRING
  | {infer StringLit} value=BLOCK_STRING
  | {infer StringLit} value=RAW_STRING
  | {infer BoolLit} value=('true' | 'false')
  | {infer NullLit} 'null'
  | {infer FnExpr} 'fn' '(' (params=ParamList)? ')' ('->' returns=TypeRef)? body=FnBody
  // The same function, written the way most people's fingers already type it:
  // one parameter needs no brackets, more than one does. `(a) => b` and `(a)`
  // differ only at their fourth token, which is why the parser looks that far.
  | {infer FnExpr} params=BareParam '=>' body=ArrowBody
  | {infer FnExpr} '(' (params=ParamList)? ')' ('->' returns=TypeRef)? '=>' body=ArrowBody
  | {infer Ref} name=RefName
  | ListLit
  | '(' Expr ')';

// The unbracketed parameter carries no type: `f(x: number => …)` already means
// a named argument called `x`, and named arguments win. Annotate it and you get
// the brackets back, which is the rule TypeScript settled on.
BareParam infers ParamList: params+=BareParamName;
BareParamName infers Param: name=ID;

// An arrow's body is one expression. A block would read as a map literal, so
// `{ … }` bodies keep the `fn` spelling, where the braces can't be mistaken.
ArrowBody infers FnBody:
    result=Expr;

// `...` in a literal is the other side of `...` in a pattern: there it keeps
// what was left, here it pours what is there into what is being written.
ListLit infers ListLit:
    '[' (items+=ListItem (',' items+=ListItem)* ','?)? ']';

ListItem: (spread?='...')? value=Expr;

MapLit infers MapLit:
    '{' (',' | NL)*
    (entries+=MapEntry ((',' | NL)+ entries+=MapEntry)* (',' | NL)*)?
    '}';

// A key and its value, or a map poured in whole. Later wins over earlier, which
// is what makes `{ ...defaults, timeout: 5s }` read the way it looks.
MapEntry: key=MapKey ':' value=Expr | spread?='...' value=Expr;
MapKey returns string: Word | STRING;

ArgList: args+=Arg (',' args+=Arg)*;
Arg: (name=ID ':')? value=Expr;

// A qualified name: first segment is a bare ID (never a keyword, so it can't
// clash with a statement keyword), later segments may be keywords (ws.expect).
QualifiedName returns string: ID ('.' Word)*;

// A variable reference: a bare ID, or a keyword that is also used as a value in
// expression position: `matrix.browser`, and the `@scope(flow|step)` lifetimes.
// Safe: no statement starts with a bare expression, so these can't shadow a decl.
RefName returns string: ID | 'matrix' | 'flow' | 'step';

// A name in member / map-key / qualified-tail position: ID or ANY keyword.
// Safe because none of these positions can start a statement.
Word returns string:
    ID | 'module' | 'as' | 'pub' | 'import' | 'from' | 'flow'
  | 'fragment' | 'fn' | 'deco' | 'return' | 'const' | 'let' | 'config'
  | 'matrix' | 'type' | 'setup' | 'teardown'
  | 'beforeEach' | 'afterEach' | 'defer' | 'on' | 'step' | 'group' | 'if'
  | 'else' | 'forEach' | 'in' | 'repeat' | 'while' | 'parallel' | 'race' | 'try'
  | 'catch' | 'finally' | 'capture' | 'run' | 'break' | 'continue' | 'expect'
  | 'all' | 'soft' | 'not' | 'match';

// A statement terminator: one or more newlines or `;`, plus adjacent blanks.
// Not hidden, because the parser consumes it. The lexer drops it inside ( ) and [ ].
terminal NL: /([ \t]*(\r?\n|;)[ \t]*)+/;
hidden terminal WS: /[ \t]+/;
hidden terminal COMMENT: /#[^\n\r]*/;

// ISO-8601 instant is a first-class literal (matched before NUMBER by maximal munch).
terminal INSTANT: /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z/;
// Double- or single-quoted. Single quotes let a string appear inside a `${…}`
// that is itself inside a double-quoted string, without escaping.
// Three quotes, and the order matters: a `"""` would otherwise lex as two
// empty strings. A block keeps the newlines inside it, so a long body reads as
// itself rather than as one line with escapes in it.
terminal BLOCK_STRING: /"""[\s\S]*?"""/;
// `r"C:\path"`: a backslash is a backslash. For Windows paths and for
// patterns, which are the two places where escaping every one of them is the
// whole cost. Interpolation still works in all three forms.
terminal RAW_STRING: /r"[^"]*"/;
// Double- or single-quoted. Single quotes let a string appear inside a `${…}`
// that is itself inside a double-quoted string, without escaping.
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
// A number with an optional unit suffix, parsed in TS (units/): "200","300ms","2mb","0.1%".
// `_` may group digits (`1_000_000`, `9_999.999_9`) but only between them, so
// `_1`, `1_` and `1__0` are not numbers.
terminal NUMBER: /[0-9]+(_[0-9]+)*(\.[0-9]+(_[0-9]+)*)?(ms|kb|mb|gb|b|s|m|h|%)?/;
terminal ID: /[_a-zA-Z]\w*/;

# @venn-lang/crypto

> The `crypto` namespace: digests, HMACs, base64, PBKDF2 password hashing and JSON Web Tokens.

Auth flows need to mint a token, check a signature, or prove that a stored password is not the
password. This package gives thirteen verbs for that. All of them run over the `CryptoEngine`
port, whose real implementation is the platform's WebCrypto, so the package stays
`platform: neutral` and needs no native module.

## Install

The package is part of the stdlib the `venn` CLI loads, so nothing to install. Reach it from a
flow with an `import` line:

```ruby
import { crypto } from "venn/crypto"
```

The plugin requires no host capability: cryptography here is computation, not I/O.

## Usage

```ruby
module demo.session

import { contains } from "venn/assert"
import { crypto } from "venn/crypto"

flow "A session token round-trips" {
  const secret = "s3cret"

  step "the password is stored hashed, never in the clear" {
    const stored = crypto.password.hash "correct horse" { iterations: 1000 }
    expect stored contains "pbkdf2$sha256$1000$"

    let ok = crypto.password.verify "correct horse" { hash: stored }
    expect ok == true

    let wrong = crypto.password.verify "wrong horse" { hash: stored }
    expect wrong == false
  }

  step "the token verifies, and its claims read back" {
    const token = crypto.jwt.sign { payload: { sub: "alice" }, secret: secret }

    let ok = crypto.jwt.verify token { secret: secret }
    expect ok == true

    const decoded = crypto.jwt.decode token
    expect decoded.header.alg == "HS256"
    expect decoded.payload.sub == "alice"
  }
}
```

## Verbs

| Verb | Options | Gives back |
| --- | --- | --- |
| `crypto.hash data` | `algorithm` (`sha1`, `sha256`, `sha384`, `sha512`; default `sha256`) | The digest, lowercase hex. |
| `crypto.hmac data` | `key` (required), `algorithm` | The keyed digest, lowercase hex. |
| `crypto.randomBytes` | `size` (default 16) | Random bytes, hex-encoded. |
| `crypto.uuid` | none | A random v4 UUID. |
| `crypto.base64.encode text` | none | Base64. |
| `crypto.base64.decode text` | none | The original string. |
| `crypto.base64url.encode text` | none | Base64url, the flavour JWT uses. |
| `crypto.base64url.decode text` | none | The original string. |
| `crypto.jwt.sign` | `payload` (required), `secret` (required), `algorithm` (`HS256`, `HS384`, `HS512`; default `HS256`) | The signed token. |
| `crypto.jwt.verify token` | `secret` (required) | `true` when the signature matches. |
| `crypto.jwt.decode token` | none | `crypto.Jwt`: `header`, `payload`, `signature`, `signingInput`. |
| `crypto.password.hash password` | `iterations` (default 100000), `algorithm` (`sha256` or `sha512`) | The encoded hash. |
| `crypto.password.verify password` | `hash` (required) | `true` when the password produced that hash. |

`crypto.jwt.sign` reads everything from options, so nothing goes in argument position. The rest
take their subject positionally.

### Passwords

`crypto.password.hash` uses PBKDF2, not bcrypt: WebCrypto offers PBKDF2, which keeps this package
free of a native dependency. The result is self-describing, so verifying needs nothing but the
string itself:

```
pbkdf2$sha256$100000$<salt>$<derived>
```

A fresh 16-byte salt is drawn per call, so hashing the same password twice gives two different
strings and both verify. Comparison is constant-time.

### Tokens

`crypto.jwt.decode` splits and decodes a token **without verifying it**. Reading a token's claims
and trusting them are two different acts, and `crypto.jwt.verify` is the second one. A token that
is not base64url-encoded JSON raises `VN7003`. Verification recomputes the HMAC over the token's
own `signingInput` and compares in constant time, so a payload edited after signing fails.

## The CryptoEngine port

`venn.port.crypto-engine`, contract version 2, requires no capability, four methods: `digest`,
`hmac`, `derive`, `randomBytes`. Everything returns lowercase hex, which is the one shape the
verbs convert from. `hmac` takes bytes as well as text, because a TOTP counter is eight raw bytes
and byte `0x80` is not a character; version 1 took text only.

| Implementation | Behaviour |
| --- | --- |
| `createWebCryptoEngine()` | The real one, backed by `crypto.subtle`. Available in Node 24 and in browsers. |
| `createFakeCryptoEngine()` | Deterministic FNV-1a stand-in. Same input, same output, never secure; it exists so a flow's assertions replay. |

Both run the same conformance suite. The stdlib binds the **real** engine by default, even though
it binds fakes for everything else: hashing is pure computation, not a side effect, so there is
nothing to isolate a test from.

The descriptor, the two engines, the suite and the byte encoders below are **declared in
[`@venn-lang/sdk`](../sdk)** and passed on from here. `@venn-lang/auth` needs the same port and the
same encoders, and a plugin may not depend on another plugin, so the one package both already
depend on holds them. `auth` used to reach the global `crypto.subtle` instead, which meant binding
the fake engine changed what `crypto.hmac` answered and left `auth.hmac` on real WebCrypto. Every
name in the table below still imports from `@venn-lang/crypto` exactly as it did.

## API

| Export | What it is |
| --- | --- |
| `cryptoPlugin` | The `PluginDefinition` for the `crypto` namespace. |
| `CryptoEnginePort` | The port descriptor. |
| `CryptoEngine`, `DeriveArgs`, `HashAlgorithm` | The interface an engine satisfies, its `derive` arguments, and the four digests. |
| `createWebCryptoEngine`, `createFakeCryptoEngine` | The two implementations. |
| `decodeJwt(token)`, `DecodedJwt` | The splitter behind `crypto.jwt.decode`, usable directly. |
| `toBytes`, `fromBytes` | String to `Uint8Array` and back, UTF-8. |
| `toHex`, `fromHex` | Bytes to lowercase hex and back. |
| `toBase64`, `fromBase64` | Bytes to base64 and back. Written out rather than using `btoa`, which is latin-1 only, stack-unsafe when fed a spread, and absent on some targets. |
| `toBase64Url`, `fromBase64Url` | The same, with `+/` as `-_` and no padding. |
| `equals(left, right)` | Constant-time string comparison, so a verification cannot be timed. |

Decoding raises `VN7003` on text that is not base64, where `atob` raised a `DOMException` that
carried no `VNxxxx` code and so reached the reporter with no line under it.

The plugin publishes one named type, `crypto.Jwt`. Every other verb answers with a string or a
boolean, which the signature says inline.

## See also

- [`@venn-lang/data`](../std-data) for the passwords and identities to hash.
- [`@venn-lang/auth`](../std-auth) for building the headers a token goes into.
- [`@venn-lang/contracts`](../contracts) for `Port`, `Host` and capability negotiation.

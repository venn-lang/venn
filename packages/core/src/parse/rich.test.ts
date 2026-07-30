import { describe, expect, it } from "vitest";
import { parse } from "./parse.js";

const RICH = `module acme.checkout

use "venn/http"
use "venn/browser" as web
import { User } from "#shared/models.vn"

config { baseUrl: env.BASE_URL, timeout: 60s }
matrix { browser: ["chromium", "webkit"], locale: ["pt-BR"] }

type Plan = "free" | "pro"
type User { email: string, name: string, credits?: int }

factory User { email: data.faker.email, plan: data.oneOf("free", "pro") }
dataset clientes: User = data.csv("#fixtures/users.csv")

const BASE = 30s

@scope(suite)
const banco = db.connect env.DATABASE_URL

fn header(u: User) -> map { return { Authorization: "Basic x" } }

pub fragment login(u: User) -> User {
  step "Login" { http.post "/auth" { json: { email: u.email } } }
}

setup { db.seed baseline }
beforeEach { http.reset }
teardown { mock.stop }

@tags(smoke, critical)
@retry(2, { backoff: 500ms })
flow "Checkout" {
  forEach cliente in clientes { concurrency: 4 } {
    run login(cliente) as sessao
    capture token = sessao.token

    if cliente.plan == "pro" {
      step "Pro" { http.get "/pro" }
    } else {
      skip "sem pro"
    }

    parallel {
      step "A" { http.get "/a" }
      step "B" { http.get "/b" }
    }

    race { timeout: 5s } {
      step "ws" { ws.expect { type: "x" } }
    }

    repeat 3 as n { wait 1s }
    loop res.pending == true { wait 2s }

    try {
      step "Pay" { stripe.charge { amount: 9900 } }
    } catch err {
      log "falhou"
    } finally {
      mock.reset
    }

    expect.all {
      res.status == 200
      res.time < 500ms
    }
    expect.soft res.time < 200ms
    mock.clock.freeze 2026-07-23T12:00:00Z
  }

  on failure { web.screenshot "falha" }
  defer { db.exec "cleanup" }
}

report junit("./out"), html("./out")`;

describe("parse · rich constructs", () => {
  it("parses fragments, bindings, matrix, control flow, parallel/race/try, instant", () => {
    const { problems } = parse(RICH);
    expect(problems).toEqual([]);
  });
});

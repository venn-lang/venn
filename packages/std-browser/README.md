# @venn-lang/browser

> The `browser` namespace: sixteen verbs that drive a page, plus two element matchers and the ports the driving actually goes through.

Venn's grammar knows nothing about browsers. This package adds the vocabulary: `browser.visit`, `browser.click`, `browser.fill` and the rest arrive as a plugin, exactly the way a third-party package would add them. None of them touch a browser directly. Every verb calls a `BrowserDriver`, a port with two implementations, so a flow can run against a real engine or against a deterministic in-memory model with the same source unchanged.

## Install

Nothing to install: the plugin ships inside the CLI's stdlib. Declare it in the file that needs it, and the runner loads it.

```ruby
use "venn/browser"
use "venn/browser" as web   # or under an alias
```

## Usage

```ruby
module demo.signin

use "venn/browser"
use "venn/assert"

flow "Sign in" {
  step "open the app" {
    const page = browser.newContext { viewport: { width: 1280, height: 800 } }
    browser.visit "/login"
    browser.fill "#email" "ada@example.test"
    browser.fill "#password" "hunter2"
    browser.click "button[type=submit]"
    browser.waitFor { text: "Welcome back" }
    browser.waitForUrl "/dashboard"

    const shot = browser.screenshot "after-login"
    expect shot.name == "after-login"
    expect page.url != null
  }
}
```

`venn test` runs this offline against the fake driver the stdlib binds by default.

## Verbs

The namespace is `browser`. Positional arguments come first, the options map last.

| Verb | Gives back |
| --- | --- |
| `browser.launch { engine, headless }` | `browser.Browser` |
| `browser.newContext { locale, viewport }` | `browser.Page` |
| `browser.visit "url" { headers }` | nothing |
| `browser.click "selector"` | nothing |
| `browser.fill "selector" "value"` | nothing |
| `browser.select "selector" "value"` | nothing |
| `browser.hover "selector"` | nothing |
| `browser.press "key"` | nothing |
| `browser.upload "selector" { file }` | nothing |
| `browser.download "selector"` | `browser.Download` |
| `browser.screenshot "name"` | `browser.Screenshot` |
| `browser.waitFor { text, selector, timeout }` | nothing |
| `browser.waitForUrl "url"` | nothing |
| `browser.evaluate "script"` | whatever the script returned |
| `browser.frame "name"` | nothing |
| `browser.clearCookies` | nothing |

`press` takes one argument or two. With one, it is the key and the page has focus. With two, the first is the selector to focus and the second is the key: `browser.press "#email" "Control+A"`.

`select` matches the option's value, not its label. `waitFor` takes its condition as options, so the wait is `browser.waitFor { text: "Welcome back" }`, never a bare argument. Its `timeout` is written as a string or as a number of milliseconds (`{ timeout: "5s" }`, `{ timeout: 5000 }`); a bare duration literal is not accepted there in this build.

## Types and matchers

The plugin publishes five names under `browser.`:

| Type | Shape |
| --- | --- |
| `browser.Browser` | opaque handle carrying `id` and `engine` |
| `browser.Page` | opaque handle carrying `id` and `url` |
| `browser.Element` | `{ visible, text, value }`, open |
| `browser.Download` | `{ path, bytes }` |
| `browser.Screenshot` | `{ name, path }` |

`Browser` and `Page` stay opaque because they are live things owned by the driver. `Download` and `Screenshot` are plain data the verbs hand back, so a flow reads their fields.

Two matchers apply to an `Element` subject: `visible` passes when the element model says it is visible, and `text` passes when the element's text equals or contains the argument.

The plugin also declares two resources, `Browser` (worker scope) and `Page` (flow scope). The runtime does not execute `resource` declarations yet, so they describe the surface rather than open anything.

## Ports

Two ports, both with a real implementation and a double, which is the condition for being a port at all.

### `BrowserDriverPort`

`venn.port.browser-driver`, contract version 1, requires the `net` capability. Sixteen methods, one per verb. Every action reaches it through `ctx.port(BrowserDriverPort)`, so a verb never knows which engine is underneath.

| Implementation | What it is |
| --- | --- |
| `createFakeBrowserDriver(options?)` | A deterministic, offline driver over an in-memory DOM model. Preload elements and a starting URL; read back `state` and `element(selector)`. |
| `createRealBrowserDriver()` | The real-engine stub. Every method throws `VN8090`, because engine automation is out of scope for the language repository. |

```ts
import { createFakeBrowserDriver } from "@venn-lang/browser";

const driver = createFakeBrowserDriver({ elements: { "#email": { visible: true } } });
await driver.visit({ url: "/dashboard" });
await driver.fill({ selector: "#email", value: "a@b.test" });

driver.state.url;            // "/dashboard"
driver.state.history;        // ["/dashboard"]
driver.element("#email");    // { visible: true, text: "", value: "a@b.test" }
```

The fake records `url`, `history`, `clicks`, `fills`, `frame` and `cookiesCleared`, which is what a test asserts against.

### `PreviewProviderPort`

`venn.port.preview-provider`, contract version 1, requires nothing. Three methods, `start`, `stop` and `latestFrame`, for the live frame stream a studio UI renders. Frame streaming is CDP-only on some engines and polled on others, which is why it is a port and not a method on the driver. A frame is the control-plane pointer (`seq`, `width`, `height`, `mime`, `data`), not a pixel buffer.

| Implementation | What it is |
| --- | --- |
| `createNonePreviewProvider()` | The zero-cost default for CI. Starts nothing, never yields a frame. |
| `createFakePreviewProvider()` | Returns a canned JPEG frame for any worker that has been started. |

## API

| Export | What it is |
| --- | --- |
| `browserPlugin` (also the default export) | The `PluginDefinition`: namespace `browser`, requires `net`, carrying the actions, matchers, resources and types. |
| `BrowserDriverPort`, `BrowserDriver` | The port descriptor and its interface. |
| `PreviewProviderPort`, `PreviewProvider` | The frame-stream port descriptor and its interface. |
| `createFakeBrowserDriver`, `createRealBrowserDriver` | The two driver implementations. |
| `createNonePreviewProvider`, `createFakePreviewProvider` | The two preview implementations. |
| `FakeBrowserDriver`, `FakeBrowserState`, `FakeDriverOptions`, `FakeElement`, `FillRecord` | The fake driver's inspection surface. |
| `LaunchOptions`, `ContextOptions`, `Viewport`, `VisitArgs`, `FillArgs`, `PressArgs`, `UploadArgs`, `DownloadArgs`, `WaitForArgs`, `EvaluateArgs`, `FrameArgs` | The driver's argument types. |
| `BrowserHandle`, `PageHandle`, `DownloadResult`, `ScreenshotResult` | What the driver returns. |
| `PreviewTarget`, `PreviewFrame` | The preview port's argument and result types. |

## Binding a driver

A host chooses the implementation once, at startup. `@venn-lang/stdlib` binds the fake for both ports; pass your own binding to override it.

```ts
import { BrowserDriverPort, createRealBrowserDriver } from "@venn-lang/browser";
import { createRunner } from "@venn-lang/runtime";

const runner = createRunner({
  host,
  plugins,
  sink,
  ports: [{ port: BrowserDriverPort, impl: createRealBrowserDriver() }],
});
```

`BrowserDriverPort` requires `net`. A host that does not offer it fails at bind time with a readable problem, rather than with a `TypeError` in the middle of a flow.

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin`, `defineAction` and `defineMatcher`, the API this package is built on.
- [`@venn-lang/contracts`](../contracts) for `Port`, `Host` and capability negotiation.
- [`@venn-lang/stdlib`](../stdlib) for the plugin list and the default port bindings the CLI runs with.
- [`@venn-lang/mail`](../std-mail) for the sibling plugin that checks the email a browser flow triggered.

/** How an engine is launched. Both fields fall back to the driver's default. */
export interface LaunchOptions {
  engine?: string;
  headless?: boolean;
}

/** A viewport size, in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** How an isolated context is opened. */
export interface ContextOptions {
  locale?: string;
  viewport?: Viewport;
}

/** Where to navigate, and what to send with the request. */
export interface VisitArgs {
  url: string;
  headers?: Record<string, string>;
}

/** A selector paired with the value to write. Shared by `fill` and `select`. */
export interface FillArgs {
  selector: string;
  value: string;
}

/** A key press. Without a `selector`, the page holds focus. */
export interface PressArgs {
  key: string;
  selector?: string;
}

/** A file input, and the path of the file to hand it. */
export interface UploadArgs {
  selector: string;
  file: string;
}

/** What to click to start a download. */
export interface DownloadArgs {
  selector: string;
}

/** A page condition to wait on. Every field is optional; `timeout` is in milliseconds. */
export interface WaitForArgs {
  text?: string;
  selector?: string;
  timeout?: number;
}

/** JavaScript to run inside the page. */
export interface EvaluateArgs {
  script: string;
}

/** An iframe to enter, named or selected. */
export interface FrameArgs {
  name: string;
}

/** A live engine. The nominal `browser.Browser`. */
export interface BrowserHandle {
  id: string;
  engine: string;
}

/** A live isolated context. The nominal `browser.Page`. */
export interface PageHandle {
  id: string;
  /** Where the context points at the moment the handle is taken. */
  url: string;
}

/** Where a downloaded file landed, and how big it is. */
export interface DownloadResult {
  path: string;
  bytes: number;
}

/** Where a screenshot landed, under the name it was asked for. */
export interface ScreenshotResult {
  name: string;
  path: string;
}

/** The contract every `browser` verb goes through. */
export interface BrowserDriver {
  launch(opts: LaunchOptions): Promise<BrowserHandle>;
  newContext(opts: ContextOptions): Promise<PageHandle>;
  visit(args: VisitArgs): Promise<void>;
  click(selector: string): Promise<void>;
  fill(args: FillArgs): Promise<void>;
  select(args: FillArgs): Promise<void>;
  hover(selector: string): Promise<void>;
  press(args: PressArgs): Promise<void>;
  upload(args: UploadArgs): Promise<void>;
  download(args: DownloadArgs): Promise<DownloadResult>;
  screenshot(name: string): Promise<ScreenshotResult>;
  waitFor(args: WaitForArgs): Promise<void>;
  waitForUrl(url: string): Promise<void>;
  evaluate(args: EvaluateArgs): Promise<unknown>;
  frame(args: FrameArgs): Promise<void>;
  clearCookies(): Promise<void>;
}

import { VennError } from "@venn-lang/contracts";
import type { MailClient, MailQuery } from "../port/index.js";
import type { Attachment, Email } from "../types/index.js";

interface MailState {
  inbox: Email[];
  /** The last email `waitFor` matched; what `read` and `attachments` answer about. */
  current: Email | undefined;
}

/**
 * The in-memory `MailClient`. Deterministic: `waitFor` scans the preloaded
 * inbox once and rejects rather than waiting, so a test never hangs.
 *
 * Emails are copied out, so a flow that mutates what it read cannot corrupt the
 * inbox behind it.
 *
 * @param args.inbox the emails to preload. Copied, not held by reference.
 * @returns a fresh client; nothing is shared between calls.
 */
export function createFakeMailClient(args: { inbox?: Email[] } = {}): MailClient {
  const state: MailState = { inbox: [...(args.inbox ?? [])], current: undefined };
  return {
    selectInbox: () => Promise.resolve(),
    waitFor: (query) => findEmail(state, query),
    read: () => readBody(state),
    attachments: () => readAttachments(state),
    clear: () => clearInbox(state),
  };
}

function findEmail(state: MailState, query: MailQuery): Promise<Email> {
  const found = state.inbox.find((email) => matchesQuery(email, query));
  if (!found) return Promise.reject(noMatchError(query));
  state.current = found;
  return Promise.resolve(cloneEmail(found));
}

function readBody(state: MailState): Promise<string> {
  if (!state.current) return Promise.reject(noCurrentError());
  return Promise.resolve(state.current.body);
}

function readAttachments(state: MailState): Promise<Attachment[]> {
  if (!state.current) return Promise.reject(noCurrentError());
  return Promise.resolve(state.current.attachments.map((file) => ({ ...file })));
}

function clearInbox(state: MailState): Promise<void> {
  state.inbox = [];
  state.current = undefined;
  return Promise.resolve();
}

function matchesQuery(email: Email, query: MailQuery): boolean {
  const toOk = query.to === undefined || email.to === query.to;
  const subjectOk = query.subject === undefined || email.subject.includes(query.subject);
  return toOk && subjectOk;
}

function cloneEmail(email: Email): Email {
  return { ...email, attachments: email.attachments.map((file) => ({ ...file })) };
}

function noMatchError(query: MailQuery): VennError {
  const to = query.to ? ` to=${query.to}` : "";
  const subject = query.subject ? ` subject~="${query.subject}"` : "";
  return new VennError({
    code: "VN8091",
    message: `No email arrived matching${to}${subject}.`,
    detail: { ...query },
  });
}

function noCurrentError(): VennError {
  return new VennError({
    code: "VN7090",
    message: "No email is selected; call mail.waitFor first.",
  });
}

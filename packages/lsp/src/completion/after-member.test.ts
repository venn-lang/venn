import { describe, expect, it } from "vitest";
import { fixture } from "../testing/lsp-fixture.js";

const HEAD = `type Preco { id: number, price: number }
type Corpo { data: list<Preco> }

const corpo: Corpo = { data: [] }
const texto = "abc"
const nums = [1, 2, 3]
const um = 1
const dois = 2
fn primeiro() => nums
`;

/** The labels offered at `▮`, in the order the editor shows them. */
async function offeredAt(body: string): Promise<string[]> {
  const whole = HEAD + body;
  const { services, document, uri } = await fixture(whole.replace("▮", ""));
  const list = await services.lsp.CompletionProvider?.getCompletion(document, {
    textDocument: { uri },
    position: document.textDocument.positionAt(whole.indexOf("▮")),
  });
  return [...(list?.items ?? [])]
    .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
    .map((each) => each.label);
}

/**
 * What follows a member that is already written.
 *
 * `xs[0].entries.▮` must not offer `id` and `price`: `entries` gave back a
 * list, so nobody holds that record any more. A path of plain names resolves
 * from its text and takes another route, which is why only an index is at risk.
 */
describe("what follows a member already written", () => {
  it("offers what that member gives back, not what it came from", async () => {
    const labels = await offeredAt("print corpo.data[0].entries.▮\n");

    expect(labels).not.toContain("id");
    expect(labels).toContain("chunk");
  });

  it("does the same for a member that gives back a number", async () => {
    const labels = await offeredAt("print corpo.data[0].len.▮\n");

    expect(labels).not.toContain("id");
    expect(labels).toContain("isEven");
  });

  /** Half a member is not a member: there, the receiver is still the value. */
  it("still offers the receiver's members while one is being typed", async () => {
    expect(await offeredAt("print corpo.data[0].pr▮\n")).toContain("price");
  });

  it("leaves the paths that never broke alone", async () => {
    expect(await offeredAt("print corpo.data.▮\n")).toContain("chunk");
    expect(await offeredAt("print texto.upper.▮\n")).toContain("capitalize");
    expect(await offeredAt("print nums.first.▮\n")).toContain("isEven");
  });
});

/**
 * What a dot finds when no name can precede it.
 *
 * A call and a grouping both end in `)`, and only one of them has a node of its
 * own: brackets that merely group belong to whatever statement encloses them,
 * so the cursor lands on something with no type of its own.
 */
describe("a dot after brackets", () => {
  it("offers what a call gives back", async () => {
    expect(await offeredAt("print primeiro().▮\n")).toContain("chunk");
    expect(await offeredAt("print primeiro().len.▮\n")).toContain("isEven");
  });

  it("offers what a grouping holds", async () => {
    expect(await offeredAt("const c = (um + dois).▮\n")).toContain("isEven");
    expect(await offeredAt("const c = ((um + dois)).▮\n")).toContain("isEven");
  });

  /** The whole sum, not its last word: the widest expression the brackets close. */
  it("reads the grouping's whole expression", async () => {
    expect(await offeredAt("const c = (um + dois ).▮\n")).toContain("isEven");
  });
});

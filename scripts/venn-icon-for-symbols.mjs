import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Teach the Symbols file icon theme what a `.vn` file is.
 *
 * VS Code's own answer, `contributes.languages[].icon`, is already in the
 * extension manifest, but a theme only honours it when it declares
 * `showLanguageModeIcons`. Symbols does not: it maps every unknown file to its
 * generic `document`, so the language icon never gets a chance. The theme is
 * plain JSON on disk, so the mark goes in beside the others.
 *
 * Written into the *source* theme (and its backup), not the generated one, so
 * a later change to any Symbols setting regenerates from a file that already
 * knows about Venn, and nothing has to be added to the user's settings.json.
 *
 * A Symbols update replaces these files. Re-run this then.
 */
const ICON_NAME = "venn";
const EXTENSION = "vn";

// 24×24 with a transparent ground, matching the other file glyphs. The lens is
// the overlap at partial opacity, exactly as in the extension icon.
const SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<title>Venn source file</title>
<circle cx="8.35" cy="12" r="6.9" fill="#4AA6DD" fill-opacity="0.68"/>
<circle cx="15.65" cy="12" r="6.9" fill="#4AA6DD" fill-opacity="0.68"/>
</svg>
`;

const THEMES = [
  "symbol-icon-theme.json",
  "symbol-icon-theme.bkp.json",
  "symbol-icon-theme.modified.json",
];

function findSymbols() {
  const root = join(homedir(), ".vscode", "extensions");
  const found = readdirSync(root).find((name) => name.startsWith("miguelsolorio.symbols-"));
  if (!found) throw new Error(`Symbols icon theme not found under ${root}`);
  return join(root, found);
}

/** Register the glyph and point the extension at it. */
function teach(theme) {
  theme.iconDefinitions[ICON_NAME] = { iconPath: `./icons/files/${ICON_NAME}.svg` };
  theme.fileExtensions[EXTENSION] = ICON_NAME;
  return theme;
}

function rewrite(path) {
  if (!existsSync(path)) return false;
  const theme = teach(JSON.parse(readFileSync(path, "utf8")));
  writeFileSync(path, `${JSON.stringify(theme, null, 2)}\n`);
  return true;
}

const symbols = findSymbols();
const svgPath = join(symbols, "src", "icons", "files", `${ICON_NAME}.svg`);
writeFileSync(svgPath, SVG);

// Keep the packaged copy identical, so the two never drift.
copyFileSync(svgPath, resolve(import.meta.dirname, "../packages/vscode/icons/venn-symbols.svg"));

const touched = THEMES.filter((name) => rewrite(join(symbols, "src", name)));
process.stdout.write(
  `${svgPath}\n${touched.length} theme file(s) updated: ${touched.join(", ")}\n`,
);
process.stdout.write("Reload the VS Code window to see it.\n");

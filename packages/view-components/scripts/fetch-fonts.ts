/**
 * Regenerate src/fonts-data.ts — the embedded webfaces behind the `./fonts` entry.
 *
 * A viewer ships as one self-contained HTML file inside an MCP host iframe,
 * where neither the network nor a permissive CSP is a given. So the three
 * families the theme names are fetched once, at authoring time, and inlined as
 * base64 rather than linked at runtime.
 *
 * Variable faces (a weight *range* in the css2 query) are deliberate: one file
 * per family covers every weight the theme uses, for ~104 KB raw instead of
 * ~240 KB across seven static faces.
 *
 * Usage: deno run --allow-net=fonts.googleapis.com,fonts.gstatic.com \
 *          --allow-read --allow-write scripts/fetch-fonts.ts [--check]
 *   --check  verify src/fonts-data.ts matches what would be generated and exit
 *            non-zero if it drifted. Writes nothing.
 *
 * Both modes fetch Google Fonts live: the committed module is the pin, and
 * --check is an upstream radar (a re-subset upstream drifts it), not a proof
 * that the module reproduces offline. Keep it out of the release gate.
 */

import { MCP_VIEW_FONT_FAMILIES } from "../src/font-families.ts";

const OUTPUT = new URL("../src/fonts-data.ts", import.meta.url);

/**
 * Latin subset only. Covers French (accents, œ/Œ), the euro sign, the
 * typographic dashes and the ‹ › chevrons pagination controls use.
 */
const UNICODE_RANGE = [
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,",
  "U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,",
  "U+2212, U+2215, U+FEFF, U+FFFD",
];

/** Google serves woff2 only to a browser-shaped UA; a bare fetch gets ttf. */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const HEADER = `/**
 * Embedded webfaces for the shared theme: three variable families, latin
 * subset, base64-inlined so a viewer stays self-contained inside a host iframe.
 *
 * Generated from fonts.googleapis.com/css2 (SIL Open Font License 1.1).
 * Do not edit by hand — regenerate with "deno task fonts:fetch".
 */
`;

interface Face {
  readonly family: string;
  readonly weight: string;
  readonly url: string;
}

async function fetchResponse(url: string, code: string): Promise<Response> {
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`${code} status=${response.status} url=${url}`);
  return response;
}

/**
 * Pull the `latin` @font-face blocks out of a css2 response. Google labels each
 * block with a subset comment and orders them subset by subset; that label is
 * the only thing telling the latin face from the cyrillic one.
 */
function extractLatinFaces(css: string): Face[] {
  const faces: Face[] = [];
  const blockPattern = /\/\* ([^*]+) \*\/\s*(@font-face \{[\s\S]*?\})/g;
  for (const [, label, block] of css.matchAll(blockPattern)) {
    if (label.trim() !== "latin") continue;
    const family = /font-family: '([^']+)'/.exec(block)?.[1];
    const weight = /font-weight: ([^;]+);/.exec(block)?.[1];
    const url = /url\((https:\/\/[^)]+)\)/.exec(block)?.[1];
    if (!family || !weight || !url) {
      throw new Error(`FONT_FACE_UNPARSEABLE block=${block.slice(0, 120)}`);
    }
    faces.push({ family, weight, url });
  }
  return faces;
}

/** Standard base64 without a dependency: the script must not widen consumer lockfiles. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function renderFace(face: Face, base64: string): string {
  return `@font-face {
  font-family: "${face.family}";
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  unicode-range: ${UNICODE_RANGE.join("\n    ")};
  src: url(data:font/woff2;base64,${base64}) format("woff2");
}
`;
}

async function generate(): Promise<{ module: string; rawBytes: number }> {
  const query = MCP_VIEW_FONT_FAMILIES
    .map((f) => `family=${f.family.replaceAll(" ", "+")}:wght@${f.weights}`)
    .join("&");
  const css = await (await fetchResponse(
    `https://fonts.googleapis.com/css2?${query}&display=swap`,
    "FONT_CSS_FETCH_FAILED",
  )).text();

  const faces = extractLatinFaces(css);
  if (faces.length !== MCP_VIEW_FONT_FAMILIES.length) {
    throw new Error(
      `FONT_FACE_COUNT_MISMATCH expected=${MCP_VIEW_FONT_FAMILIES.length} got=${faces.length}`,
    );
  }

  const rendered: string[] = [];
  let rawBytes = 0;
  for (const face of faces) {
    const binary = new Uint8Array(
      await (await fetchResponse(face.url, "FONT_FILE_FETCH_FAILED")).arrayBuffer(),
    );
    rawBytes += binary.byteLength;
    rendered.push(renderFace(face, encodeBase64(binary)));
  }

  const fontsCss = [HEADER, ...rendered].join("\n");
  if (fontsCss.includes("`") || fontsCss.includes("${")) {
    throw new Error("FONT_CSS_NOT_TEMPLATE_SAFE");
  }
  const module = `// Generated by scripts/fetch-fonts.ts — do not edit.\n` +
    `export const MCP_VIEW_FONTS_CSS: string = \`${fontsCss}\`;\n`;
  return { module, rawBytes };
}

const check = Deno.args.includes("--check");
const { module, rawBytes } = await generate();

if (check) {
  const current = await Deno.readTextFile(OUTPUT).catch((error: unknown) => {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        "FONT_DATA_MISSING run `deno task fonts:fetch` to generate src/fonts-data.ts",
      );
    }
    throw error;
  });
  if (current === module) {
    console.log("src/fonts-data.ts up to date");
  } else {
    console.error("FONTS_DATA_DRIFTED run `deno task fonts:fetch` to regenerate");
    Deno.exit(1);
  }
} else {
  await Deno.writeTextFile(OUTPUT, module);
  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  console.log(
    `src/fonts-data.ts written — ${MCP_VIEW_FONT_FAMILIES.length} variable faces, ` +
      `${kb(rawBytes)} raw / ${kb(module.length)} inlined`,
  );
}

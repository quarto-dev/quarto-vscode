/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2016 James Yu
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// based on https://github.com/James-Yu/LaTeX-Workshop/tree/master/src/providers/preview

// TODO: Cursor preview
// TODO: Preview only move selection if necessary
// TODO: Configuration / themeing
// TOOD: Need another return value where we signal an error (and keep last)
// TOOO: math should get separate css treatment (don't width confine, center?
// TODO: height of equations (break across mutliple lines)
// TODO: look at other width related options
// TODO: consider debouncing the assist panel
// TODO: embed latex completions

import type {
  ConvertOption,
  SupportedExtension,
  SvgOption,
  TexOption,
} from "mathjax-full";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import type { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import type { MathDocument } from "mathjax-full/js/core/MathDocument.js";
import type { LiteDocument } from "mathjax-full/js/adaptors/lite/Document.js";
import type { LiteText } from "mathjax-full/js/adaptors/lite/Text.js";
import "mathjax-full/js/input/tex/AllPackages.js";

import { MarkupContent, MarkupKind } from "vscode-languageserver/node";
import { config } from "../../../core/config";

const baseExtensions: SupportedExtension[] = [
  "ams",
  "base",
  "color",
  "newcommand",
  "noerrors",
  "noundefined",
];

function createHtmlConverter(extensions: SupportedExtension[]) {
  const baseTexOption: TexOption = {
    packages: extensions,
    formatError: (_jax, error) => {
      throw new Error(error.message);
    },
  };
  const texInput = new TeX<LiteElement, LiteText, LiteDocument>(baseTexOption);
  const svgOption: SvgOption = { fontCache: "local" };
  const svgOutput = new SVG<LiteElement, LiteText, LiteDocument>(svgOption);
  return mathjax.document("", {
    InputJax: texInput,
    OutputJax: svgOutput,
  }) as MathDocument<LiteElement, LiteText, LiteDocument>;
}

// some globals
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
let html = createHtmlConverter(baseExtensions);

export function mathjaxLoadExtensions() {
  const extensionsToLoad = baseExtensions.concat(
    config
      .previewMathJaxExtensions()
      .filter((ex) => supportedExtensionList.includes(ex))
  );
  html = createHtmlConverter(extensionsToLoad);
}

export function mathjaxTypesetToMarkdown(tex: string): MarkupContent | null {
  // prepare tex for mathjax
  const envBeginPat =
    /\\begin\{(align|align\*|alignat|alignat\*|aligned|alignedat|array|Bmatrix|bmatrix|cases|CD|eqnarray|eqnarray\*|equation|equation\*|gather|gather\*|gathered|matrix|multline|multline\*|pmatrix|smallmatrix|split|subarray|Vmatrix|vmatrix)\}/;
  const match = tex.match(envBeginPat);
  const envname = match ? match[1] : "";
  tex = mathjaxify(tex, envname);

  // typeset
  const typesetOpts = {
    scale: config.previewMathJaxScale(),
    color: getColor(),
  };
  try {
    const svg = typesetToSvg(tex, typesetOpts);
    const md = svgToDataUrl(svg);
    return {
      kind: MarkupKind.Markdown,
      value: `![equation](${md})`,
    };
  } catch (e) {
    console.log(e);
    console.log(`Error when MathJax is rendering ${tex}`);
    return null;
  }
}

function typesetToSvg(
  arg: string,
  opts: { scale: number; color: string }
): string {
  const convertOption: ConvertOption = {
    display: true,
    em: 18,
    ex: 9,
    containerWidth: 80 * 18,
  };
  const node = html.convert(arg, convertOption) as LiteElement;

  const css = `svg {font-size: ${100 * opts.scale}%;} * { color: ${
    opts.color
  } }`;
  let svgHtml = adaptor.innerHTML(node);
  svgHtml = svgHtml.replace(/<defs>/, `<defs><style>${css}</style>`);
  return svgHtml;
}

function getColor() {
  const lightness = config.previewMathJaxTheme();
  if (lightness === "light") {
    return "#000000";
  } else {
    return "#ffffff";
  }
}

function mathjaxify(
  tex: string,
  envname: string,
  opt = { stripLabel: true }
): string {
  // remove TeX comments
  let s = stripComments(tex);
  // remove \label{...}
  if (opt.stripLabel) {
    s = s.replace(/\\label\{.*?\}/g, "");
  }
  if (
    envname.match(
      /^(aligned|alignedat|array|Bmatrix|bmatrix|cases|CD|gathered|matrix|pmatrix|smallmatrix|split|subarray|Vmatrix|vmatrix)$/
    )
  ) {
    s = "\\begin{equation}" + s + "\\end{equation}";
  }
  return s;
}

function stripComments(text: string): string {
  const reg = /(^|[^\\]|(?:(?<!\\)(?:\\\\)+))%.*$/gm;
  return text.replace(reg, "$1");
}

function svgToDataUrl(xml: string): string {
  // We have to call encodeURIComponent and unescape because SVG can includes non-ASCII characters.
  // We have to encode them before converting them to base64.
  const svg64 = Buffer.from(
    unescape(encodeURIComponent(xml)),
    "binary"
  ).toString("base64");
  const b64Start = "data:image/svg+xml;base64,";
  return b64Start + svg64;
}

const supportedExtensionList = [
  "amscd",
  "bbox",
  "boldsymbol",
  "braket",
  "bussproofs",
  "cancel",
  "cases",
  "centernot",
  "colortbl",
  "empheq",
  "enclose",
  "extpfeil",
  "gensymb",
  "html",
  "mathtools",
  "mhchem",
  "physics",
  "textcomp",
  "textmacros",
  "unicode",
  "upgreek",
  "verb",
];

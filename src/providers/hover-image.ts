/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  Hover,
  Position,
  TextDocument,
  Range,
  MarkdownString,
  workspace,
  Uri,
} from "vscode";
import PngImage from "../core/png";

const kImagePattern =
  /(!\[((!\[[^\]]*?\]\(\s*)([^\s\(\)]+?)\s*\)\]|(?:\\\]|[^\]])*\])\(\s*)(([^\s\(\)]|\([^\s\(\)]*?\))+)\s*(".*?")?\)/g;

export async function imageHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  const lineRange = new Range(pos.line, 0, pos.line + 1, 0);
  const line = doc.getText(lineRange).trimEnd();
  if (line.match(kImagePattern)) {
    const path = "/Users/jjallaire/Desktop/foo.png";
    const width = await imageWidth(path);
    const widthAttrib = width ? `width="${width}"` : "";
    const content = new MarkdownString(`<img src="${path}" ${widthAttrib}/>`);
    content.supportHtml = true;
    content.isTrusted = true;
    return {
      contents: [content],
      range: lineRange,
    };
  } else {
    return null;
  }
}

async function imageWidth(file: string) {
  if (file.toLowerCase().endsWith(".png")) {
    try {
      const kMaxWidth = 600;
      const imageData = await workspace.fs.readFile(Uri.file(file));
      const pngImage = new PngImage(imageData);
      if (pngImage.isHighDpi) {
        const width = Math.round(pngImage.width / 2);
        return Math.min(width, kMaxWidth);
      } else {
        return Math.min(pngImage.width, kMaxWidth);
      }
    } catch (error) {
      console.log(error);
      return null;
    }
  } else {
    return null;
  }
}

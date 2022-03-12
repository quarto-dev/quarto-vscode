/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Hover, Position, TextDocument, Range, MarkdownString } from "vscode";

const kImagePattern =
  /(!\[((!\[[^\]]*?\]\(\s*)([^\s\(\)]+?)\s*\)\]|(?:\\\]|[^\]])*\])\(\s*)(([^\s\(\)]|\([^\s\(\)]*?\))+)\s*(".*?")?\)/g;

export function imageHover(doc: TextDocument, pos: Position): Hover | null {
  const lineRange = new Range(pos.line, 0, pos.line + 1, 0);
  const line = doc.getText(lineRange).trimEnd();
  if (line.match(kImagePattern)) {
    return {
      contents: [
        new MarkdownString(`![image](/Users/jjallaire/Desktop/foo.png)`),
      ],
      range: lineRange,
    };
  } else {
    return null;
  }
}

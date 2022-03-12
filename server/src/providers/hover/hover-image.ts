/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

const kImagePattern =
  /(!\[((!\[[^\]]*?\]\(\s*)([^\s\(\)]+?)\s*\)\]|(?:\\\]|[^\]])*\])\(\s*)(([^\s\(\)]|\([^\s\(\)]*?\))+)\s*(".*?")?\)/g;

import { Hover, MarkupKind, Position, Range } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

export function imageHover(doc: TextDocument, pos: Position): Hover | null {
  const lineRange = Range.create(pos.line, 0, pos.line + 1, 0);
  const line = doc.getText(lineRange).trimEnd();
  if (line.match(kImagePattern)) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `![image](/Users/jjallaire/Desktop/foo.png)`,
      },
      range: lineRange,
    };
  } else {
    return null;
  }
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Hover,
  MarkupContent,
  MarkupKind,
  Range,
  Position,
} from "vscode-languageserver/node";

import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";

import { mathPlugin } from "./hover-math-plugin";

export async function mathHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  const tokens = mathTokens.parse(doc);
  const mathBlock = tokens.find(isMathBlockAtPosition(pos));
  if (mathBlock && mathBlock.map) {
    const markdown: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: mathBlock.content,
    };
    return {
      contents: markdown,
      range: Range.create(
        Position.create(mathBlock.map[0], 0),
        Position.create(mathBlock.map[1] + 1, 0)
      ),
    };
  } else {
    return null;
  }
}

function isMathBlockAtPosition(pos: Position) {
  return (token: Token) => {
    if (token.type === "math_block" && token.map) {
      let [begin, end] = token.map;
      return pos.line >= begin && pos.line < end;
    } else {
      return false;
    }
  };
}

class MathTokens {
  public parse(doc: TextDocument): Token[] {
    // create parser on demand
    if (!this.md_) {
      this.md_ = MarkdownIt("zero");
      this.md_.use(mathPlugin);
    }

    // do we need to primate/update the cache?
    if (
      !this.cachedTokens_ ||
      doc.uri !== this.cachedUri_ ||
      doc.version !== this.cachedVersion_
    ) {
      // suffix to make sure trimming of whitepsace doesn't mess
      // up our cursor location detection
      const kSuffix = "\n\n---\n";
      this.cachedTokens_ = this.md_.parse(doc.getText() + kSuffix, {});
      this.cachedUri_ = doc.uri;
      this.cachedVersion_ = doc.version;
    }

    // return the current cache
    return this.cachedTokens_;
  }

  private cachedUri_: string | undefined;
  private cachedVersion_: number | undefined;
  private cachedTokens_: Token[] | undefined;
  private md_: MarkdownIt | undefined;
}

const mathTokens = new MathTokens();

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Range, Position } from "vscode-languageserver/node";

import Token from "markdown-it/lib/token";

import MarkdownIt from "markdown-it";
import { mathPlugin } from "./math-markdownit";
import { TextDocument } from "vscode-languageserver-textdocument";

export function mathRange(doc: TextDocument, pos: Position) {
  // see if we are in a math block
  const tokens = mathTokens.parse(doc);
  const mathBlock = tokens.find(isMathBlockAtPosition(pos));
  if (mathBlock && mathBlock.map) {
    return {
      math: mathBlock.content,
      range: Range.create(
        Position.create(mathBlock.map[0], 0),
        Position.create(mathBlock.map[1] + 1, 0)
      ),
    };
  }

  // see if we are in an inline range
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  return (
    inlineMathRange(pos, line, kInlineMathPattern) ||
    inlineMathRange(pos, line, kSingleLineDisplayMathPattern)
  );
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
  public parse(document: TextDocument): Token[] {
    // create parser on demand
    if (!this.md_) {
      this.md_ = MarkdownIt("zero");
      this.md_.use(mathPlugin, { enableInlines: false });
    }

    // (re)-primte cache if required
    if (
      !this.cachedTokens_ ||
      this.cachedUri_ !== document.uri.toString() ||
      this.cachedVersion_ !== document.version
    ) {
      this.cachedUri_ = document.uri.toString();
      this.cachedVersion_ = document.version;
      this.cachedTokens_ = this.md_.parse(document.getText(), {});
    }

    return this.cachedTokens_!;
  }

  private md_: MarkdownIt | undefined;
  private cachedUri_: string | undefined;
  private cachedVersion_: number | undefined;
  private cachedTokens_: Token[] | undefined;
}

const mathTokens = new MathTokens();

const kInlineMathPattern = /\$([^ ].*?[^\ ]?)\$/;
const kSingleLineDisplayMathPattern = /\$\$([^\n]+?)\$\$/;

function inlineMathRange(pos: Position, line: string, pattern: RegExp) {
  const match = line.match(pattern);
  if (match) {
    const range = Range.create(
      Position.create(pos.line, match.index || 0),
      Position.create(pos.line, (match.index || 0) + match[0].length)
    );
    if (
      range.start.character <= pos.character &&
      range.end.character >= pos.character
    ) {
      return {
        math: match[1],
        range,
      };
    }
  }
  return null;
}

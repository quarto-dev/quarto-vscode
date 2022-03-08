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

import { mathPlugin } from "./mathdownit-math";

export async function mathHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  // see if we are in a math block
  const tokens = mathTokens.parse(doc);
  const mathBlock = tokens.find(isMathBlockAtPosition(pos));
  if (mathBlock && mathBlock.map) {
    return {
      contents: mathAsMarkdown(mathBlock.content),
      range: Range.create(
        Position.create(mathBlock.map[0], 0),
        Position.create(mathBlock.map[1] + 1, 0)
      ),
    };
  }

  // see if we are inside inline math
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();

  return (
    inlineMathHover(pos, line, kInlineMathPattern) ||
    inlineMathHover(pos, line, kSingleLineDisplayMathPattern)
  );
}

const kInlineMathPattern = /\$([^ ].*?[^\ ]?)\$/;
const kSingleLineDisplayMathPattern = /\$\$([^\n]+?)\$\$/;

function inlineMathHover(pos: Position, line: string, pattern: RegExp) {
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
        contents: mathAsMarkdown(match[1]),
        range,
      };
    }
  }
  return null;
}

function mathAsMarkdown(math: string): MarkupContent {
  if (!math.endsWith("\n")) {
    math = math + "\n";
  }
  return {
    kind: MarkupKind.Markdown,
    value: math,
  };
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
      this.md_.use(mathPlugin, { enableInlines: false });
    }

    // do we need to primate/update the cache?
    if (
      !this.cachedTokens_ ||
      doc.uri !== this.cachedUri_ ||
      doc.version !== this.cachedVersion_
    ) {
      this.cachedTokens_ = this.md_.parse(doc.getText(), {});
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

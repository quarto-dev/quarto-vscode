/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import Token from "markdown-it/lib/token";
import { Position, TextDocument, Uri } from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import { embeddedLanguage, EmbeddedLanguage } from "./languages";
import { virtualDocUriFromEmbeddedContent } from "./vdoc-content";
import { virtualDocUriFromTempFile } from "./vdoc-tempfile";

export interface VirtualDoc {
  language: EmbeddedLanguage;
  content: string;
}

export async function virtualDoc(
  document: TextDocument,
  position: Position,
  engine: MarkdownEngine
): Promise<VirtualDoc | undefined> {
  // check if the cursor is in a fenced code block
  const tokens = await engine.parse(document);
  const language = languageAtPosition(tokens, position);

  if (language) {
    // filter out lines that aren't of this language
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push("");
    }
    for (const fencedCode of tokens.filter(isFencedCodeOf(language))) {
      if (fencedCode.map) {
        for (
          let line = fencedCode.map[0] + 1;
          line < fencedCode.map[1] - 1 && line < document.lineCount;
          line++
        ) {
          lines[line] = document.lineAt(line).text;
        }
      }
    }

    // perform inject if necessary
    if (language.inject) {
      lines[0] = language.inject;
    }

    // return the language and the content
    return {
      language,
      content: lines.join("\n"),
    };
  } else {
    return undefined;
  }
}

export async function virtualDocUri(virtualDoc: VirtualDoc, parentUri: Uri) {
  return virtualDoc.language.type === "content"
    ? virtualDocUriFromEmbeddedContent(virtualDoc, parentUri)
    : await virtualDocUriFromTempFile(virtualDoc);
}

export function languageAtPosition(tokens: Token[], position: Position) {
  for (const fencedCode of tokens.filter(isFencedCode)) {
    if (
      fencedCode.map &&
      position.line > fencedCode.map[0] &&
      position.line <= fencedCode.map[1]
    ) {
      return languageFromFenceToken(fencedCode);
    }
  }
  return undefined;
}

export function languageFromFenceToken(token: Token) {
  const langId = token.info.replace(/^[^\w]*/, "").replace(/[^\w]$/, "");
  return embeddedLanguage(langId);
}

export function isFencedCode(token: Token) {
  return token.type === "fence";
}

export function isFencedCodeOf(language: EmbeddedLanguage) {
  return (token: Token) => {
    return (
      isFencedCode(token) &&
      languageFromFenceToken(token)?.ids.some((id) => language.ids.includes(id))
    );
  };
}

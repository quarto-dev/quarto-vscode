/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument, Uri } from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import {
  extensionForLanguage,
  isFencedCodeOf,
  languageAtPosition,
} from "./languages";

export interface CompletionVirtualDoc {
  language: string;
  extension: string;
  content: string;
}

export interface CompletionVirtualDocUri {
  uri: Uri;
  dispose: () => Promise<void>;
}

export async function completionVirtualDoc(
  document: TextDocument,
  position: Position,
  engine: MarkdownEngine
): Promise<CompletionVirtualDoc | undefined> {
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

    // return the language and the content
    return {
      language,
      extension: extensionForLanguage(language),
      content: lines.join("\n"),
    };
  } else {
    return undefined;
  }
}

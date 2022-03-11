/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2016 James Yu
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// based on https://github.com/James-Yu/LaTeX-Workshop/blob/master/src/providers/completion.ts

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import {
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Range,
} from "vscode-languageserver/node";

import { isLatexPosition, mathRange } from "../../core/markdown/markdown";

interface LatexCommand {
  command: string;
  snippet?: string;
  detail?: string;
  documentation?: string;
}
import latexImport from "./latex.json";
const kLatexCommands = latexImport as Record<string, LatexCommand>;
for (const key of Object.keys(kLatexCommands)) {
  if (key.match(/\{.*?\}/)) {
    const ent = kLatexCommands[key];
    const newKey = key.replace(/\{.*?\}/, "");
    delete kLatexCommands[key];
    kLatexCommands[newKey] = ent;
  }
}

export async function latexCompletions(
  doc: TextDocument,
  pos: Position,
  completionContext?: CompletionContext
): Promise<CompletionItem[] | null> {
  // validate trigger
  const trigger = completionContext?.triggerCharacter;
  if (trigger && !["\\"].includes(trigger)) {
    return null;
  }

  // check for latex position
  if (!isLatexPosition(doc, pos)) {
    return null;
  }

  // scan back from the cursor to see if there is a \
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  const text = line.slice(0, pos.character);
  const backslashPos = text.lastIndexOf("\\");
  const spacePos = text.lastIndexOf(" ");
  if (backslashPos !== -1 && backslashPos > spacePos) {
    const token = text.slice(backslashPos + 1);
    // find commands that start with the token
    const completions: CompletionItem[] = [];
    Object.values(kLatexCommands).forEach((command) => {
      if (command.command.startsWith(token)) {
        const item: CompletionItem = {
          kind: CompletionItemKind.Function,
          label: command.command,
          documentation: command.documentation,
          detail: command.detail,
          insertTextFormat: InsertTextFormat.Snippet,
          insertText: command.snippet,
        };
        completions.push(item);
      }
    });
    if (completions.length > 0) {
      return completions;
    }
  }

  return null;
}

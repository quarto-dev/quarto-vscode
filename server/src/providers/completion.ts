/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Range, TextEdit } from "vscode-languageserver-types";

import {
  Command,
  CompletionItem,
  CompletionItemKind,
  ServerCapabilities,
} from "vscode-languageserver/node";
import { editorContext, Quarto } from "../quarto";

export const kCompletionCapabilities: ServerCapabilities = {
  completionProvider: {
    resolveProvider: false,
    // register a superset of all trigger characters for embedded languages
    // (languages are responsible for declaring which one they support if any)
    triggerCharacters: [".", "$", "@", ":", "\\"],
  },
};

export async function onCompletion(
  doc: TextDocument,
  pos: Position,
  explicit: boolean,
  quarto?: Quarto
): Promise<CompletionItem[] | null> {
  if (quarto) {
    const context = editorContext(doc, pos, explicit);
    const result = await quarto.getCompletions(context);
    if (result) {
      return result.completions.map((completion) => {
        const completionWord = completion.value.replace(/: $/, "");
        const item: CompletionItem = {
          label: completionWord,
          kind: CompletionItemKind.Field,
          documentation: completion.description,
        };
        if (
          result.token.length > 0 &&
          completionWord.startsWith(result.token)
        ) {
          const edit = TextEdit.replace(
            Range.create(
              pos.line,
              pos.character - result.token.length,
              pos.line,
              pos.character
            ),
            completion.value
          );
          item.textEdit = edit;
        } else {
          item.insertText = completion.value;
        }

        if (completion.suggest_on_accept) {
          item.command = Command.create(
            "Suggest",
            "editor.action.triggerSuggest"
          );
        }
        return item;
      });
    } else {
      return null;
    }
  } else {
    return null;
  }
}

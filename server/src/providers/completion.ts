/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, ServerCapabilities } from "vscode-languageserver/node";
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
    console.log(result);
    return [];
  } else {
    return null;
  }
}

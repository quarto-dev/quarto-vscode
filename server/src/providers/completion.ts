/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, ServerCapabilities } from "vscode-languageserver/node";

export const kCompletionCapabilities: ServerCapabilities = {
  completionProvider: {
    resolveProvider: false,
    // register a superset of all trigger characters for embedded languages
    // (languages are responsible for declaring which one they support if any)
    triggerCharacters: [".", "$", "@", ":", "\\"],
  },
};

export function onCompletion(
  doc: TextDocument,
  pos: Position,
  quarto?: any
): CompletionItem[] | null {
  console.log("onCompletion");
  return null;
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";

import {
  CompletionContext,
  CompletionItem,
  CompletionTriggerKind,
  ServerCapabilities,
} from "vscode-languageserver/node";
import { editorContext, Quarto } from "../../quarto";
import { attrCompletions } from "./completion-attrs";
import { yamlCompletions } from "./completion-yaml";

export const kCompletionCapabilities: ServerCapabilities = {
  completionProvider: {
    resolveProvider: false,
    // register a superset of all trigger characters for embedded languages
    // (languages are responsible for declaring which one they support if any)
    triggerCharacters: [".", "$", "@", ":", "\\", "-", "="],
  },
};

export async function onCompletion(
  doc: TextDocument,
  pos: Position,
  completionContext?: CompletionContext,
  quarto?: Quarto
): Promise<CompletionItem[] | null> {
  if (quarto) {
    const explicit =
      completionContext?.triggerKind === CompletionTriggerKind.TriggerCharacter;
    const trigger = completionContext?.triggerCharacter;
    const context = editorContext(doc, pos, explicit, trigger);
    return (
      (await attrCompletions(context)) ||
      (await yamlCompletions(context, quarto))
    );
  } else {
    return null;
  }
}

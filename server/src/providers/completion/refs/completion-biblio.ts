/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

export async function biblioCompletions(
  token: string
): Promise<CompletionItem[] | null> {
  return [
    {
      kind: CompletionItemKind.Function,
      //documentation: "documentation",
      //detail: "detail",
      label: token + "-biblio",
    },
  ];
}

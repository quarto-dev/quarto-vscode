/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

export async function crossrefCompletions(
  token: string,
  code: string,
  path: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  return [];
}

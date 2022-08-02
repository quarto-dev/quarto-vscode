/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { biblioRefs } from "../../../core/biblio";

export function biblioCompletions(
  _token: string,
  frontMatter: Record<string, unknown>,
  docPath: string,
  projectDir?: string
): CompletionItem[] | null {
  const refs = biblioRefs(frontMatter, docPath, projectDir);
  if (refs) {
    return refs.map((ref) => ({
      kind: CompletionItemKind.Function,
      label: ref.id,
      documentation: ref.cite
        ? {
            kind: MarkupKind.Markdown,
            value: ref.cite,
          }
        : undefined,
    }));
  } else {
    return null;
  }
}

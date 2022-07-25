/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

export async function biblioCompletions(
  token: string,
  frontMatter: Record<string, unknown>,
  docPath: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  // see if we can resolve some bibliographies
  const dir = path.dirname(docPath);
  const bibliographies = bibliographyOption(frontMatter["bibliography"])
    .map((biblio) => {
      return path.normalize(path.join(dir, biblio));
    })
    .filter(fs.existsSync);

  if (bibliographies.length > 0) {
    return [];
  } else {
    return null;
  }
}

function bibliographyOption(option: unknown): string[] {
  if (typeof option === "string") {
    return [option];
  } else if (Array.isArray(option)) {
    return option.map((value) => String(value));
  } else {
    return [];
  }
}

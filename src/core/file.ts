/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { extname } from "../core/path";

export const kQuartoDocumentSelector: vscode.DocumentSelector = {
  language: "quarto",
  scheme: "*",
};

export function isQuartoFile(document: vscode.TextDocument) {
  return document.languageId === "quarto";
}

export async function resolveQuartoFileUri(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  try {
    const doc = await tryResolveUriToQuartoFile(resource);
    if (doc) {
      return doc;
    }
  } catch {
    // Noop
  }

  // If no extension, try with `.qmd` extension
  if (extname(resource.path) === "") {
    return tryResolveUriToQuartoFile(
      resource.with({ path: resource.path + ".qmd" })
    );
  }

  return undefined;
}

async function tryResolveUriToQuartoFile(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(resource);
  } catch {
    return undefined;
  }
  if (isQuartoFile(document)) {
    return document;
  }
  return undefined;
}

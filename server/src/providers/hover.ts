/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover, ServerCapabilities } from "vscode-languageserver/node";

import { editorContext, EditorContext, quarto } from "../quarto/quarto";

export const kHoverCapabilities: ServerCapabilities = {
  hoverProvider: true,
};

export async function onHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  // bail if no quarto connection
  if (!quarto?.getHover) {
    return null;
  }
  const context = editorContext(doc, pos, true);
  const result = await quarto.getHover(context);
  if (result === null) return null;
  return {
    contents: {
      kind: "markdown",
      value: result.content,
    },
    range: result.range,
  };
}

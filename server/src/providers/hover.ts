/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover, ServerCapabilities } from "vscode-languageserver/node";
import { Quarto } from "../quarto";

export const kHoverCapabilities: ServerCapabilities = {
  hoverProvider: true,
};

export async function onHover(
  doc: TextDocument,
  pos: Position,
  quarto?: Quarto
): Promise<Hover | null> {
  return null;
}

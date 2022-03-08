/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover, ServerCapabilities } from "vscode-languageserver/node";

import { mathHover } from "./hover-math";
import { yamlHover } from "./hover-yaml";

export const kHoverCapabilities: ServerCapabilities = {
  hoverProvider: true,
};

export async function onHover(
  doc: TextDocument,
  pos: Position
): Promise<Hover | null> {
  // try math first
  const hover = await mathHover(doc, pos);
  if (hover) {
    return hover;
  }

  // now try yaml
  return await yamlHover(doc, pos);
}

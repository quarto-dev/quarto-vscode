/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import {
  Hover,
  InitializeParams,
  ServerCapabilities,
} from "vscode-languageserver/node";

import { yamlHover } from "./hover-yaml";
import { initializeMathHover } from "./math/math";

export const kHoverCapabilities: ServerCapabilities = {
  hoverProvider: true,
};

export function initializeHover() {
  const mathHover = initializeMathHover();

  return async (doc: TextDocument, pos: Position): Promise<Hover | null> => {
    return (await mathHover(doc, pos)) || (await yamlHover(doc, pos));
  };
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { ServerCapabilities, SignatureHelp } from "vscode-languageserver/node";
import { Quarto } from "../quarto";

export const kSignatureCapabilities: ServerCapabilities = {
  signatureHelpProvider: {
    // assume for now that these cover all languages (we can introduce
    // a refinement system like we do for completion triggers if necessary)
    triggerCharacters: ["(", ","],
    retriggerCharacters: [")"],
  },
};

export async function onSignatureHelp(
  doc: TextDocument,
  pos: Position,
  quarto?: Quarto
): Promise<SignatureHelp | null> {
  return null;
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";

const kQuartoLanguageId = "quarto";
const kYamlLanguageId = "yaml";

export function isQuartoDoc(doc: TextDocument) {
  return doc.languageId === kQuartoLanguageId;
}

export function isQuartoYaml(doc: TextDocument) {
  return doc.languageId === kYamlLanguageId && doc.uri.match(/_quarto\.ya?ml$/);
}

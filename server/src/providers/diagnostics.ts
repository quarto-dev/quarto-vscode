/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from "vscode-languageserver/node";
import {
  editorContext,
  kEndColumn,
  kEndRow,
  kStartColumn,
  kStartRow,
  LintItem,
  Quarto,
} from "../quarto";

export async function provideDiagnostics(
  doc: TextDocument,
  quarto?: Quarto
): Promise<Diagnostic[]> {
  if (quarto) {
    const context = editorContext(doc, Position.create(0, 0), true);
    const lint = await quarto.getLint(context);
    return lint.map((item) => {
      return {
        severity: lintSeverity(item),
        range: Range.create(
          item[kStartRow],
          item[kStartColumn],
          item[kEndRow],
          item[kEndColumn]
        ),
        message: item.text,
        source: "quarto",
      };
    });
  } else {
    return [];
  }
}

function lintSeverity(item: LintItem) {
  if (item.type === "error") {
    return DiagnosticSeverity.Error;
  } else if (item.type === "warning") {
    return DiagnosticSeverity.Warning;
  } else {
    return DiagnosticSeverity.Information;
  }
}

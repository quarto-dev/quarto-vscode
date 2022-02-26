/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { URL } from "url";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range } from "vscode-languageserver-types";
import { isQuartoDoc, isQuartoYaml } from "./doc";

export interface EditorContext {
  path: string;
  filetype: string;
  embedded: boolean;
  line: string;
  code: string;
  position: {
    row: number;
    column: number;
  };
  explicit: boolean;
  formats: string[];
  project_formats: string[];
  engine: string;
}

export function editorContext(
  doc: TextDocument,
  pos: Position,
  explicit: boolean
) {
  const path = new URL(doc.uri).pathname;
  const filetype = isQuartoDoc(doc)
    ? "markdown"
    : isQuartoYaml(doc)
    ? "yaml"
    : "markdown"; // should never get here
  const embedded = false;
  const code = doc.getText();
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line, code.length))
    .trimEnd();
  const position = { row: pos.line, column: pos.character };
  return {
    path,
    filetype,
    embedded,
    line,
    code,
    position,
    explicit,
    formats: [],
    project_formats: [],
    engine: "jupyter",
  };
}

export const kStartRow = "start.row";
export const kStartColumn = "start.column";
export const kEndRow = "end.row";
export const kEndColumn = "end.column";

export interface LintItem {
  [kStartRow]: number;
  [kStartColumn]: number;
  [kEndRow]: number;
  [kEndColumn]: number;
  text: string;
  type: string;
}

export interface CompletionResult {
  token: string;
  completions: Completion[];
  cacheable: boolean;
}

export interface Completion {
  type: string;
  value: string;
  display?: string;
  description?: string;
  suggest_on_accept?: boolean;
  replace_to_end?: boolean;
}

export interface Quarto {
  getCompletions(context: EditorContext): Promise<CompletionResult>;
  getLint(context: EditorContext): Promise<Array<LintItem>>;
}

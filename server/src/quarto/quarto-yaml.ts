/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { URL } from "url";
import * as path from "path";

import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range } from "vscode-languageserver-types";
import { isQuartoDoc, isQuartoYaml } from "../doc";
import fileUrl from "file-url";

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
  trigger?: string;
  formats: string[];
  project_formats: string[];
  engine: string;
  client: string;
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

export interface QuartoYamlModule {
  getCompletions(context: EditorContext): Promise<CompletionResult>;
  getLint(context: EditorContext): Promise<Array<LintItem>>;
}

export function initializeQuartoYamlModule(
  resourcesPath: string
): Promise<QuartoYamlModule> {
  const modulePath = path.join(resourcesPath, "editor", "tools", "vs-code.mjs");
  return new Promise((resolve, reject) => {
    import(fileUrl(modulePath))
      .then((mod) => {
        const quartoModule = mod as QuartoYamlModule;
        resolve(quartoModule);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export function yamlEditorContext(
  doc: TextDocument,
  pos: Position,
  explicit: boolean,
  trigger?: string
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
    .replace(/[\r\n]+$/, "");
  const position = { row: pos.line, column: pos.character };
  return {
    path,
    filetype,
    embedded,
    line,
    code,
    position,
    explicit,
    trigger,
    formats: [],
    project_formats: [],
    engine: "jupyter",
    client: "lsp",
  };
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import * as yaml from "js-yaml";
import * as fs from "fs";

import {
  CompletionItem,
  CompletionItemKind,
  Range,
  TextEdit,
} from "vscode-languageserver/node";
import { EditorContext } from "./quarto-yaml";

export type AttrContext =
  | "heading"
  | "div"
  | "div-simple"
  | "codeblock"
  | "figure";

export interface AttrToken {
  context: AttrContext;
  formats: string[];
  attr: string;
  token: string;
}

interface Attr {
  contexts: AttrContext[];
  formats: string[];
  filter?: RegExp;
  value: string;
  doc?: string;
}

interface AttrGroup {
  contexts: AttrContext[];
  formats?: string[];
  filter?: RegExp;
  completions: AttrCompletion[];
}

interface AttrCompletion {
  value: string;
  doc?: string;
}

// cache array of Attr
const attrs: Attr[] = [];

export function initializeAttrCompletionProvider(resourcesPath: string) {
  // read attr.yml from resources
  const attrYamlPath = path.join(resourcesPath, "editor", "tools", "attrs.yml");
  try {
    const attrGroups = yaml.load(
      fs.readFileSync(attrYamlPath, "utf-8")
    ) as AttrGroup[];
    for (const group of attrGroups) {
      group.completions.forEach((completion) => {
        attrs.push({
          contexts: group.contexts,
          formats: group.formats || [],
          filter: group.filter,
          ...completion,
        });
      });
    }
  } catch (error) {
    console.log(error);
  }

  return async (
    token: AttrToken,
    context: EditorContext
  ): Promise<CompletionItem[]> => {
    const completions: CompletionItem[] = attrs
      .filter((attr) => {
        return attr.value.startsWith(token.token);
      })
      .map((attr) => {
        const edit = TextEdit.replace(
          Range.create(
            context.position.row,
            context.position.column - token.token.length,
            context.position.row,
            context.position.column
          ),
          attr.value
        );
        return {
          label: attr.value,
          kind: CompletionItemKind.Field,
          documentation: attr.doc,
          textEdit: edit,
        };
      });

    return completions;
  };
}

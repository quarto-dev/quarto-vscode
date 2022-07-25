/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import { TextDocument } from "vscode-languageserver-textdocument";

export const kQuartoLanguageId = "quarto";
export const kYamlLanguageId = "yaml";

export enum DocType {
  None,
  Qmd,
  Yaml,
}

export function docType(doc: TextDocument) {
  if (isQuartoDoc(doc)) {
    return DocType.Qmd;
  } else if (isQuartoYaml(doc)) {
    return DocType.Yaml;
  } else {
    return DocType.None;
  }
}

export function isQuartoDoc(doc: TextDocument) {
  return doc.languageId === kQuartoLanguageId;
}

export function isQuartoYaml(doc: TextDocument) {
  return (
    doc.languageId === kYamlLanguageId &&
    (doc.uri.match(/_quarto\.ya?ml$/) || doc.uri.match(/_metadata\.ya?ml$/))
  );
}

export function projectDirForDocument(doc: string) {
  let dir = path.dirname(doc);
  while (true) {
    if (hasQuartoProject(dir)) {
      return dir;
    } else {
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

export function hasQuartoProject(dir?: string) {
  if (dir) {
    return (
      fs.existsSync(path.join(dir, "_quarto.yml")) ||
      fs.existsSync(path.join(dir, "_quarto.yaml"))
    );
  } else {
    return false;
  }
}

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

export function isQuartoRevealDoc(doc: TextDocument) {
  if (isQuartoDoc(doc)) {
    const text = doc.getText();
    if (text) {
      const match = doc.getText().match(kRegExYAML);
      if (match) {
        const yaml = match[0];
        return (
          !!yaml.match(/^format\:\s+revealjs\s*$/gm) ||
          !!yaml.match(/^[ \t]*revealjs\:\s*(default)?\s*$/gm)
        );
      }
    }
  } else {
    return false;
  }
}

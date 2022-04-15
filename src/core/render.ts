/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import { TextDocument, window } from "vscode";
import { canPreviewDoc } from "./doc";

export function activeRenderTarget(
  filter: (doc: TextDocument) => boolean,
  includeVisible = true
) {
  const activeDoc = window.activeTextEditor?.document;
  if (activeDoc && filter(activeDoc)) {
    return window.activeTextEditor;
  } else if (includeVisible) {
    const visibleEditor = window.visibleTextEditors.find((editor) =>
      canPreviewDoc(editor.document)
    );
    if (visibleEditor) {
      return visibleEditor;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

export function projectDirForDocument(doc: TextDocument) {
  let dir = path.dirname(doc.fileName);
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

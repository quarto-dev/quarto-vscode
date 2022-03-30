/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";

import { Uri, workspace } from "vscode";
import { hasFileScheme } from "./schemes";

export function isHugoMarkdown(uri?: Uri) {
  return (
    uri &&
    path.extname(uri.toString()).toLowerCase() === ".md" &&
    isWithinHugoProject(uri)
  );
}

export function isWithinHugoProject(uri: Uri) {
  const folder = workspace.getWorkspaceFolder(uri);
  if (folder && hasFileScheme(folder.uri)) {
    // first check if a hugo config 'tell' is in the root
    const folderPath = folder.uri.fsPath;
    if (
      fs.existsSync(path.join(folderPath, "config.toml")) ||
      fs.existsSync(path.join(folderPath, "config.yaml")) ||
      fs.existsSync(path.join(folderPath, "config.json")) ||
      fs.existsSync(path.join(folderPath, "config"))
    ) {
      // if so, see if we can successfully read the config from hugo
      try {
        child_process.execSync(`hugo config`, {
          cwd: folderPath,
        });
        return true;
      } catch {}
    }
  }
  return false;
}

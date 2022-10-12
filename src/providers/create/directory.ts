/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";

import { ExtensionContext, Uri, window } from "vscode";

export async function resolveDirectoryForCreate(
  context: ExtensionContext,
  name: string
) {
  // select direcotry (see if we have a default parent)
  const kDefaultParentDir = `quarto.create${name}.dir`;
  const defaultParent = context.globalState.get<string | undefined>(
    kDefaultParentDir,
    undefined
  );
  const projFolder = await window.showOpenDialog({
    title: `New ${name} Direcory`,
    openLabel: `Choose ${name} Directory`,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri:
      defaultParent && fs.existsSync(defaultParent)
        ? Uri.file(defaultParent)
        : undefined,
  });
  if (!projFolder) {
    return;
  }

  // see if we need a sub-directory
  let projDir: string | undefined = projFolder[0].fsPath;
  projDir = isDirEmpty(projDir)
    ? projDir
    : await directoryWithSubdir(name, projDir, 2, 2);
  if (!projDir) {
    return;
  }

  // update the default parent dir
  context.globalState.update(kDefaultParentDir, path.dirname(projDir));

  // return the projDir
  return projDir;
}

function directoryWithSubdir(
  name: string,
  parentDir: string,
  step?: number,
  totalSteps?: number
): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    const inputBox = window.createInputBox();
    inputBox.title = `${name} Subdirectory`;
    inputBox.prompt = parentDir;
    inputBox.placeholder = `New ${name.toLowerCase()} subdirectory name`;
    inputBox.step = step;
    inputBox.totalSteps = totalSteps;
    inputBox.onDidChangeValue((value) => {
      inputBox.prompt = path.join(parentDir, value);
    });
    let accepted = false;
    inputBox.onDidAccept(() => {
      accepted = true;
      inputBox.hide();
      resolve(
        inputBox.value.length ? path.join(parentDir, inputBox.value) : undefined
      );
    });
    inputBox.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
    inputBox.show();
  });
}

function isDirEmpty(dirname: string) {
  const listing = fs
    .readdirSync(dirname)
    .filter((file) => path.basename(file) !== ".DS_Store");
  return listing.length === 0;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { activateCommon } from "./extension";
import { MarkdownEngine } from "./markdown/engine";

export function activate(context: vscode.ExtensionContext) {
  // create markdown engine
  const engine = new MarkdownEngine();

  // activate providers common to browser/node
  activateCommon(context, engine);
}

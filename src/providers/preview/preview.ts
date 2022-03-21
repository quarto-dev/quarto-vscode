/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from "vscode";
import { Command } from "../../core/command";
import { previewCommands } from "./commands";
import { terminalInitialize } from "./terminal";

// TODO: check quarto version and use --log

export function activatePreview(context: ExtensionContext): Command[] {
  terminalInitialize(context);

  return previewCommands();
}

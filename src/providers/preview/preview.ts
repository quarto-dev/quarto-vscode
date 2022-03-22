/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from "../../core/command";
import { QuartoContext } from "../../core/quarto";
import { previewCommands } from "./commands";
import { terminalInitialize } from "./terminal";

// TODO: check quarto version and use --log

export function activatePreview(quartoContext: QuartoContext): Command[] {
  terminalInitialize(quartoContext);

  return previewCommands();
}

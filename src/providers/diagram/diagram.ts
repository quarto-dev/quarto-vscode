/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from "vscode";
import { Command } from "../../core/command";
import { MarkdownEngine } from "../../markdown/engine";
import { diagramCommands } from "./commands";

export function activateDiagram(
  _context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  // diagram commands
  return diagramCommands(engine);
}

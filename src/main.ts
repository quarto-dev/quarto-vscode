/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { MarkdownEngine } from "./markdown/engine";
import { kQuartoDocSelector } from "./core/doc";
import { activateLsp } from "./lsp/client";
import { cellCommands } from "./providers/cell/commands";
import { quartoCellExecuteCodeLensProvider } from "./providers/cell/codelens";
import { activateQuartoAssistPanel } from "./providers/assist/panel";
import { activateCommon } from "./extension";
import { activatePreview } from "./providers/preview/preview";
import { initQuartoContext } from "./core/quarto";

export function activate(context: vscode.ExtensionContext) {
  // create markdown engine
  const engine = new MarkdownEngine();

  // commands
  const commands = cellCommands(engine);

  // get quarto context (some features conditional on it)
  const quartoContext = initQuartoContext();
  if (quartoContext.available) {
    // lsp
    activateLsp(context, engine);

    // assist panel
    const assistCommands = activateQuartoAssistPanel(context, engine);
    commands.push(...assistCommands);

    // preview
    const previewCommands = activatePreview(quartoContext);
    commands.push(...previewCommands);
  }

  // provide code lens
  vscode.languages.registerCodeLensProvider(
    kQuartoDocSelector,
    quartoCellExecuteCodeLensProvider(engine)
  );

  // activate providers common to browser/node
  activateCommon(context, engine, commands);
}

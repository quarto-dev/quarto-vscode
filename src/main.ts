/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as path from "path";
import { MarkdownEngine } from "./markdown/engine";
import { kQuartoDocSelector } from "./core/doc";
import { activateLsp } from "./lsp/client";
import { cellCommands } from "./providers/cell/commands";
import { quartoCellExecuteCodeLensProvider } from "./providers/cell/codelens";
import { activateQuartoAssistPanel } from "./providers/assist/panel";
import { activateCommon } from "./extension";
import { activatePreview } from "./providers/preview/preview";
import { initQuartoContext } from "./shared/quarto";
import { activateStatusBar } from "./providers/statusbar";

export function activate(context: vscode.ExtensionContext) {
  // create markdown engine
  const engine = new MarkdownEngine();

  // commands
  const commands = cellCommands(engine);

  // get quarto context (some features conditional on it)
  const config = vscode.workspace.getConfiguration("quarto");
  const quartoPath = config.get("path") as string | undefined;
  const workspaceFolder = vscode.workspace.workspaceFolders?.length
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;
  const quartoContext = initQuartoContext(quartoPath, workspaceFolder);
  if (quartoContext.available) {
    // ensure quarto is on the path
    context.environmentVariableCollection.prepend(
      "PATH",
      path.delimiter + quartoContext.binPath + path.delimiter
    );

    // status bar
    activateStatusBar(quartoContext);

    // lsp
    activateLsp(context, engine);

    // assist panel
    const assistCommands = activateQuartoAssistPanel(context, engine);
    commands.push(...assistCommands);

    // preview
    const previewCommands = activatePreview(context, quartoContext, engine);
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

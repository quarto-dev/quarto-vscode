/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import QuartoLinkProvider, { OpenLinkCommand } from "./providers/link";
import QuartoDocumentSymbolProvider from "./providers/symbol-document";
import QuartoFoldingProvider from "./providers/folding";
import { PathCompletionProvider } from "./providers/completion-path";
import QuartoSelectionRangeProvider from "./providers/selection-range";
import QuartoWorkspaceSymbolProvider from "./providers/symbol-workspace";
import { MarkdownEngine } from "./markdown/engine";
import { activateBackgroundHighlighter } from "./providers/background";
import { kQuartoDocSelector } from "./core/doc";
import { activateLsp } from "./lsp/client";
import { CommandManager } from "./core/command";
import { cellCommands } from "./cell/commands";
import { quartoCellExecuteCodeLensProvider } from "./cell/codelens";

export function activate(context: vscode.ExtensionContext) {
  const engine = new MarkdownEngine();

  const symbolProvider = new QuartoDocumentSymbolProvider(engine);

  activateLsp(context, engine);
  activateBackgroundHighlighter(context, engine);

  context.subscriptions.push(
    registerMarkdownLanguageFeatures(symbolProvider, engine)
  );
  context.subscriptions.push(registerCommands(engine));
}

function registerMarkdownLanguageFeatures(
  symbolProvider: QuartoDocumentSymbolProvider,
  engine: MarkdownEngine
): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.languages.registerDocumentSymbolProvider(
      kQuartoDocSelector,
      symbolProvider
    ),
    vscode.languages.registerDocumentLinkProvider(
      kQuartoDocSelector,
      new QuartoLinkProvider(engine)
    ),
    vscode.languages.registerFoldingRangeProvider(
      kQuartoDocSelector,
      new QuartoFoldingProvider(engine)
    ),
    vscode.languages.registerSelectionRangeProvider(
      kQuartoDocSelector,
      new QuartoSelectionRangeProvider(engine)
    ),
    vscode.languages.registerWorkspaceSymbolProvider(
      new QuartoWorkspaceSymbolProvider(symbolProvider)
    ),
    vscode.languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoCellExecuteCodeLensProvider(engine)
    ),
    PathCompletionProvider.register(engine)
  );
}

function registerCommands(engine: MarkdownEngine): vscode.Disposable {
  const commandManager = new CommandManager();
  commandManager.register(new OpenLinkCommand(engine));
  for (const cmd of cellCommands(engine)) {
    commandManager.register(cmd);
  }

  return commandManager;
}

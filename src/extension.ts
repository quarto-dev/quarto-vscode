/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { OpenLinkCommand } from "./commands/open-link";
import QuartoLinkProvider from "./providers/link";
import QuartoDocumentSymbolProvider from "./providers/symbol-document";
import QuartoFoldingProvider from "./providers/folding";
import { PathCompletionProvider } from "./completion/path";
import QuartoSelectionRangeProvider from "./providers/selection-range";
import QuartoWorkspaceSymbolProvider from "./providers/symbol-workspace";
import { MarkdownEngine } from "./markdown/engine";
import { activateCellHighlighter } from "./providers/highlight-cell";
import { kQuartoDocumentSelector } from "./core/file";
import { activateLsp } from "./lsp/client";

export function activate(context: vscode.ExtensionContext) {
  const engine = new MarkdownEngine();

  const symbolProvider = new QuartoDocumentSymbolProvider(engine);

  activateCellHighlighter(context);

  activateLsp(context);

  context.subscriptions.push(
    registerMarkdownLanguageFeatures(symbolProvider, engine)
  );
  context.subscriptions.push(registerMarkdownCommands(engine));
}

function registerMarkdownLanguageFeatures(
  symbolProvider: QuartoDocumentSymbolProvider,
  engine: MarkdownEngine
): vscode.Disposable {
  return vscode.Disposable.from(
    vscode.languages.registerDocumentSymbolProvider(
      kQuartoDocumentSelector,
      symbolProvider
    ),
    vscode.languages.registerDocumentLinkProvider(
      kQuartoDocumentSelector,
      new QuartoLinkProvider(engine)
    ),
    vscode.languages.registerFoldingRangeProvider(
      kQuartoDocumentSelector,
      new QuartoFoldingProvider(engine)
    ),
    vscode.languages.registerSelectionRangeProvider(
      kQuartoDocumentSelector,
      new QuartoSelectionRangeProvider(engine)
    ),
    vscode.languages.registerWorkspaceSymbolProvider(
      new QuartoWorkspaceSymbolProvider(symbolProvider)
    ),
    PathCompletionProvider.register(engine)
  );
}

function registerMarkdownCommands(engine: MarkdownEngine): vscode.Disposable {
  const commandManager = new CommandManager();
  commandManager.register(new OpenLinkCommand(engine));
  return commandManager;
}

export interface Command {
  readonly id: string;

  execute(...args: any[]): void;
}

class CommandManager {
  private readonly commands = new Map<string, vscode.Disposable>();

  public dispose() {
    for (const registration of this.commands.values()) {
      registration.dispose();
    }
    this.commands.clear();
  }

  public register<T extends Command>(command: T): T {
    this.registerCommand(command.id, command.execute, command);
    return command;
  }

  private registerCommand(
    id: string,
    impl: (...args: any[]) => void,
    thisArg?: any
  ) {
    if (this.commands.has(id)) {
      return;
    }

    this.commands.set(id, vscode.commands.registerCommand(id, impl, thisArg));
  }
}

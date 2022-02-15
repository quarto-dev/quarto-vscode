/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import LinkProvider from './features/documentLinkProvider';
import MDDocumentSymbolProvider from './features/documentSymbolProvider';
import MarkdownFoldingProvider from './features/foldingProvider';
import MarkdownSmartSelect from './features/smartSelect';
import MarkdownWorkspaceSymbolProvider from './features/workspaceSymbolProvider';
import { MarkdownEngine } from './markdownEngine';
import { githubSlugifier } from './slugify';


export function activate(context: vscode.ExtensionContext) {

	const engine = new MarkdownEngine(githubSlugifier);

	const symbolProvider = new MDDocumentSymbolProvider(engine);

	context.subscriptions.push(registerMarkdownLanguageFeatures(symbolProvider, engine));
	context.subscriptions.push(registerMarkdownCommands(engine));
}

function registerMarkdownLanguageFeatures(
	symbolProvider: MDDocumentSymbolProvider,
	engine: MarkdownEngine
): vscode.Disposable {
	const selector: vscode.DocumentSelector = { language: 'quarto', scheme: '*' };

	return vscode.Disposable.from(
		vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider),
		vscode.languages.registerDocumentLinkProvider(selector, new LinkProvider(engine)),
		vscode.languages.registerFoldingRangeProvider(selector, new MarkdownFoldingProvider(engine)),
		vscode.languages.registerSelectionRangeProvider(selector, new MarkdownSmartSelect(engine)),
		vscode.languages.registerWorkspaceSymbolProvider(new MarkdownWorkspaceSymbolProvider(symbolProvider)),
	);
}

function registerMarkdownCommands(engine: MarkdownEngine): vscode.Disposable {

	const commandManager = new CommandManager();
	commandManager.register(new commands.OpenDocumentLinkCommand(engine));
	return commandManager;
}

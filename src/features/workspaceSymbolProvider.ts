/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SkinnyTextDocument, SkinnyTextLine } from '../tableOfContentsProvider';
import { Disposable } from '../util/dispose';
import { isQuartoFile } from '../util/file';
import { Lazy, lazy } from '../util/lazy';
import MDDocumentSymbolProvider from './documentSymbolProvider';

export interface WorkspaceQuartoDocumentProvider {
	getAllQuartoDocuments(): Thenable<Iterable<SkinnyTextDocument>>;

	readonly onDidChangeQuartoDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidCreateQuartoDocument: vscode.Event<SkinnyTextDocument>;
	readonly onDidDeleteQuartoDocument: vscode.Event<vscode.Uri>;
}

class VSCodeWorkspaceQuartoDocumentProvider extends Disposable implements WorkspaceQuartoDocumentProvider {

	private readonly _onDidChangeQuartoDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidCreateQuartoDocumentEmitter = this._register(new vscode.EventEmitter<SkinnyTextDocument>());
	private readonly _onDidDeleteQuartoDocumentEmitter = this._register(new vscode.EventEmitter<vscode.Uri>());

	private _watcher: vscode.FileSystemWatcher | undefined;

	private readonly utf8Decoder = new TextDecoder('utf-8');

	/**
	 * Reads and parses all .qmd documents in the workspace.
	 * Files are processed in batches, to keep the number of open files small.
	 *
	 * @returns Array of processed .qmd files.
	 */
	async getAllQuartoDocuments(): Promise<SkinnyTextDocument[]> {
		const maxConcurrent = 20;
		const docList: SkinnyTextDocument[] = [];
		const resources = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**');

		for (let i = 0; i < resources.length; i += maxConcurrent) {
			const resourceBatch = resources.slice(i, i + maxConcurrent);
			const documentBatch = (await Promise.all(resourceBatch.map(x => this.getQuartoDocument(x)))).filter((doc) => !!doc) as SkinnyTextDocument[];
			docList.push(...documentBatch);
		}
		return docList;
	}

	public get onDidChangeQuartoDocument() {
		this.ensureWatcher();
		return this._onDidChangeQuartoDocumentEmitter.event;
	}

	public get onDidCreateQuartoDocument() {
		this.ensureWatcher();
		return this._onDidCreateQuartoDocumentEmitter.event;
	}

	public get onDidDeleteQuartoDocument() {
		this.ensureWatcher();
		return this._onDidDeleteQuartoDocumentEmitter.event;
	}

	private ensureWatcher(): void {
		if (this._watcher) {
			return;
		}

		this._watcher = this._register(vscode.workspace.createFileSystemWatcher('**/*.md'));

		this._watcher.onDidChange(async resource => {
			const document = await this.getQuartoDocument(resource);
			if (document) {
				this._onDidChangeQuartoDocumentEmitter.fire(document);
			}
		}, null, this._disposables);

		this._watcher.onDidCreate(async resource => {
			const document = await this.getQuartoDocument(resource);
			if (document) {
				this._onDidCreateQuartoDocumentEmitter.fire(document);
			}
		}, null, this._disposables);

		this._watcher.onDidDelete(async resource => {
			this._onDidDeleteQuartoDocumentEmitter.fire(resource);
		}, null, this._disposables);

		vscode.workspace.onDidChangeTextDocument(e => {
			if (isQuartoFile(e.document)) {
				this._onDidChangeQuartoDocumentEmitter.fire(e.document);
			}
		}, null, this._disposables);
	}

	private async getQuartoDocument(resource: vscode.Uri): Promise<SkinnyTextDocument | undefined> {
		const matchingDocuments = vscode.workspace.textDocuments.filter((doc) => doc.uri.toString() === resource.toString());
		if (matchingDocuments.length !== 0) {
			return matchingDocuments[0];
		}

		const bytes = await vscode.workspace.fs.readFile(resource);

		// We assume that markdown is in UTF-8
		const text = this.utf8Decoder.decode(bytes);

		const lines: SkinnyTextLine[] = [];
		const parts = text.split(/(\r?\n)/);
		const lineCount = Math.floor(parts.length / 2) + 1;
		for (let line = 0; line < lineCount; line++) {
			lines.push({
				text: parts[line * 2]
			});
		}

		return {
			uri: resource,
			version: 0,
			lineCount: lineCount,
			lineAt: (index) => {
				return lines[index];
			},
			getText: () => {
				return text;
			}
		};
	}
}

export default class MarkdownWorkspaceSymbolProvider extends Disposable implements vscode.WorkspaceSymbolProvider {
	private _symbolCache = new Map<string, Lazy<Thenable<vscode.SymbolInformation[]>>>();
	private _symbolCachePopulated: boolean = false;

	public constructor(
		private _symbolProvider: MDDocumentSymbolProvider,
		private _workspaceQuartoDocumentProvider: WorkspaceQuartoDocumentProvider = new VSCodeWorkspaceQuartoDocumentProvider()
	) {
		super();
	}

	public async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
		if (!this._symbolCachePopulated) {
			await this.populateSymbolCache();
			this._symbolCachePopulated = true;

			this._workspaceQuartoDocumentProvider.onDidChangeQuartoDocument(this.onDidChangeDocument, this, this._disposables);
			this._workspaceQuartoDocumentProvider.onDidCreateQuartoDocument(this.onDidChangeDocument, this, this._disposables);
			this._workspaceQuartoDocumentProvider.onDidDeleteQuartoDocument(this.onDidDeleteDocument, this, this._disposables);
		}

		const allSymbolsSets = await Promise.all(Array.from(this._symbolCache.values(), x => x.value));
		const allSymbols = allSymbolsSets.flat();
		return allSymbols.filter(symbolInformation => symbolInformation.name.toLowerCase().indexOf(query.toLowerCase()) !== -1);
	}

	public async populateSymbolCache(): Promise<void> {
		const markdownDocumentUris = await this._workspaceQuartoDocumentProvider.getAllQuartoDocuments();
		for (const document of markdownDocumentUris) {
			this._symbolCache.set(document.uri.fsPath, this.getSymbols(document));
		}
	}

	private getSymbols(document: SkinnyTextDocument): Lazy<Thenable<vscode.SymbolInformation[]>> {
		return lazy(async () => {
			return this._symbolProvider.provideDocumentSymbolInformation(document);
		});
	}

	private onDidChangeDocument(document: SkinnyTextDocument) {
		this._symbolCache.set(document.uri.fsPath, this.getSymbols(document));
	}

	private onDidDeleteDocument(resource: vscode.Uri) {
		this._symbolCache.delete(resource.fsPath);
	}
}
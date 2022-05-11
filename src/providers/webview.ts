/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See KICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  Uri,
  WebviewPanel,
  window,
  ViewColumn,
  EventEmitter,
  ExtensionContext,
} from "vscode";

import { Disposable } from "../core/dispose";
import { isNotebook } from "../core/doc";

export interface ShowOptions {
  readonly preserveFocus?: boolean;
  readonly viewColumn?: ViewColumn;
}

export class QuartoWebviewManager<T extends QuartoWebview<S>, S> {
  constructor(
    context: ExtensionContext,
    private readonly viewType_: string,
    private readonly title_: string,
    private webviewType_: new (
      extensionUri: Uri,
      state: S,
      webviewPanel: WebviewPanel
    ) => T
  ) {
    this.extensionUri_ = context.extensionUri;

    context.subscriptions.push(
      window.registerWebviewPanelSerializer(this.viewType_, {
        deserializeWebviewPanel: async (panel, state) => {
          this.restoreWebvew(panel, state);
        },
      })
    );
  }

  public setOnShow(f: () => void) {
    this.onShow_ = f;
  }

  public showWebview(state: S, options?: ShowOptions): void {
    if (this.activeView_) {
      this.activeView_.show(state, options);
    } else {
      const view = this.createWebview(this.extensionUri_, state, options);
      this.registerWebviewListeners(view);
      this.activeView_ = view;
    }
    this.resolveOnShow();
    if (options?.preserveFocus) {
      this.preserveFocus();
    }
  }

  public revealWebview() {
    if (this.activeView_) {
      this.activeView_.reveal();
      this.resolveOnShow();
      this.preserveFocus();
    }
  }

  public hasWebview() {
    return !!this.activeView_;
  }

  private resolveOnShow() {
    if (this.onShow_) {
      this.onShow_();
      this.onShow_ = undefined;
    }
  }

  private preserveFocus() {
    // focus the editor (sometimes the terminal steals focus)
    const activeEditor = window.activeTextEditor;
    if (activeEditor) {
      if (!isNotebook(activeEditor?.document)) {
        setTimeout(() => {
          window.showTextDocument(
            activeEditor?.document,
            activeEditor.viewColumn,
            false
          );
        }, 200);
      }
    }
  }

  private restoreWebvew(panel: WebviewPanel, state: any): void {
    const url = state?.url ?? "";
    const view = new this.webviewType_(this.extensionUri_, url, panel);
    this.registerWebviewListeners(view);
    this.activeView_ = view;
  }

  private createWebview(
    extensionUri: Uri,
    state: S,
    showOptions?: ShowOptions
  ): T {
    const webview = window.createWebviewPanel(
      this.viewType_,
      this.title_,
      {
        viewColumn: showOptions?.viewColumn ?? ViewColumn.Active,
        preserveFocus: showOptions?.preserveFocus,
      },
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
      }
    );
    return new this.webviewType_(extensionUri, state, webview);
  }

  private registerWebviewListeners(view: T) {
    view.onDispose(() => {
      if (this.activeView_ === view) {
        this.activeView_ = undefined;
      }
    });
  }

  public dispose() {
    if (this.activeView_) {
      this.activeView_.dispose();
      this.activeView_ = undefined;
    }
  }
  protected activeView_?: T;
  private onShow_?: () => void;
  private readonly extensionUri_: Uri;
}

export abstract class QuartoWebview<T> extends Disposable {
  protected readonly _webviewPanel: WebviewPanel;

  private readonly _onDidDispose = this._register(new EventEmitter<void>());
  public readonly onDispose = this._onDidDispose.event;

  public constructor(
    private readonly extensionUri: Uri,
    state: T,
    webviewPanel: WebviewPanel
  ) {
    super();

    this._webviewPanel = this._register(webviewPanel);

    this._register(
      this._webviewPanel.onDidDispose(() => {
        this.dispose();
      })
    );

    this.show(state);
  }

  public override dispose() {
    this._onDidDispose.fire();
    super.dispose();
  }

  public show(state: T, options?: ShowOptions) {
    this._webviewPanel.webview.html = this.getHtml(state);
    this._webviewPanel.reveal(options?.viewColumn, options?.preserveFocus);
  }

  public reveal() {
    this._webviewPanel.reveal(undefined, true);
  }

  protected abstract getHtml(state: T): string;

  protected webviewHTML(
    mainJS: string[],
    mainCSS: string[],
    headerHtml: string,
    bodyHtml: string
  ) {
    const nonce = this.getNonce();

    const mainJs = this.extensionResourceUrl(mainJS);
    const mainCss = this.extensionResourceUrl(mainCSS);
    const codiconsUri = this.extensionResourceUrl([
      "assets",
      "www",
      "codicon",
      "codicon.css",
    ]);

    return /* html */ `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">

				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					font-src ${this._webviewPanel.webview.cspSource};
					style-src ${this._webviewPanel.webview.cspSource};
					script-src 'nonce-${nonce}';
					frame-src *;
					">

				${headerHtml}

				<link rel="stylesheet" type="text/css" href="${mainCss}">
				<link rel="stylesheet" type="text/css" href="${codiconsUri}">
			</head>
			<body>
				${bodyHtml}
				<script src="${mainJs}" nonce="${nonce}"></script>
			</body>
			</html>`;
  }

  protected extensionResourceUrl(parts: string[]): Uri {
    return this._webviewPanel.webview.asWebviewUri(
      Uri.joinPath(this.extensionUri, ...parts)
    );
  }

  protected escapeAttribute(value: string | Uri): string {
    return value.toString().replace(/"/g, "&quot;");
  }

  private getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 64; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// https://code.visualstudio.com/api/extension-guides/webview

import {
  WebviewViewProvider,
  WebviewView,
  Uri,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  ExtensionContext,
} from "vscode";

import { MarkdownEngine } from "../../markdown/engine";

export class QuartoActivityBarViewProvider
  implements WebviewViewProvider, Disposable
{
  public static readonly viewType = "quarto-activity-bar-view";

  constructor(context: ExtensionContext, _engine: MarkdownEngine) {
    this.extensionUri_ = context.extensionUri;
  }

  public dispose() {
    let item: Disposable | undefined;
    while ((item = this._disposables.pop())) {
      item.dispose();
    }
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext<unknown>,
    _token: CancellationToken
  ): void | Thenable<void> {
    this.view_ = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    };

    webviewView.onDidDispose(() => {
      this.view_ = undefined;
    });

    webviewView.webview.html = "<body>foo</body>";
  }

  private view_?: WebviewView;
  private readonly extensionUri_: Uri;
  private readonly _disposables: Disposable[] = [];
}

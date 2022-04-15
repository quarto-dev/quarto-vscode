/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// https://github.com/HuyQLuong/vscode-webview-extension-with-react
// https://code.visualstudio.com/blogs/2021/10/11/webview-ui-toolkit
// https://github.com/microsoft/vscode-webview-ui-toolkit

// https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/react/hello-world-cra

import {
  WebviewViewProvider,
  WebviewView,
  Uri,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  ExtensionContext,
  window,
} from "vscode";

import * as React from "react";
import * as ReactDOMServer from "react-dom/server";

import { Command } from "../../core/command";
import { MarkdownEngine } from "../../markdown/engine";
import { wwwAssetPath, wwwSharedAssetPath } from "../../core/assets";

import ActivityBar, { ActivityBarProps } from "./components/activitybar";

export function activateQuartoActivityBarPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  const provider = new QuartoActivityBarViewProvider(context, engine);
  context.subscriptions.push(provider);

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      QuartoActivityBarViewProvider.viewType,
      provider
    )
  );

  return [];
}

class QuartoActivityBarViewProvider implements WebviewViewProvider, Disposable {
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

    webviewView.webview.html = this.getHtml();
  }

  private getHtml() {
    const nonce = getNonce();

    const activityJs = this.extensionResourceUrl(this.assetPath("activity.js"));
    const activityCss = this.extensionResourceUrl(
      this.assetPath("activity.css")
    );
    const toolkitUri = this.extensionResourceUrl([
      "node_modules",
      "@vscode",
      "webview-ui-toolkit",
      "dist",
      "toolkit.js", // A toolkit.min.js file is also available
    ]);
    const codiconsUri = this.extensionResourceUrl(
      wwwSharedAssetPath(["codicon.css"])
    );

    const props: ActivityBarProps = {
      render: "quarto.render",
    };

    return /* html */ `<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">

				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					font-src ${this.view_?.webview.cspSource};
					style-src ${this.view_?.webview.cspSource};
					script-src 'nonce-${nonce}';
					frame-src *;
					">

				<link rel="stylesheet" type="text/css" href="${activityCss}">
        <link rel="stylesheet" type="text/css" href="${codiconsUri}">
			</head>
			<body>
				<main>
        ${ReactDOMServer.renderToString(<ActivityBar {...props} />)}
        </main>
        <script type="module" src="${toolkitUri}" nonce="${nonce}"></script>
				<script src="${activityJs}" nonce="${nonce}"></script>
			</body>
			</html>`;
  }

  private assetPath(asset: string): string[] {
    return wwwAssetPath(["activity", asset]);
  }

  private extensionResourceUrl(parts: string[]): Uri {
    return this.view_!.webview.asWebviewUri(
      Uri.joinPath(this.extensionUri_, ...parts)
    );
  }

  private view_?: WebviewView;
  private readonly extensionUri_: Uri;
  private readonly _disposables: Disposable[] = [];
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ["vscode-button"]: any;
    }
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 64; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

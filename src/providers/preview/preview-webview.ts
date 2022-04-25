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
  workspace,
  env,
  ExtensionContext,
  ColorThemeKind,
} from "vscode";

import { Disposable } from "../../core/dispose";
import { isNotebook } from "../../core/doc";

export interface ShowOptions {
  readonly preserveFocus?: boolean;
  readonly viewColumn?: ViewColumn;
}

export class PreviewWebviewManager {
  public static readonly slideIndex = "quarto.slideIndex";

  constructor(context: ExtensionContext) {
    this.extensionUri_ = context.extensionUri;

    context.subscriptions.push(
      window.registerWebviewPanelSerializer(QuartoPreviewView.viewType, {
        deserializeWebviewPanel: async (panel, state) => {
          this.restoreWebvew(panel, state);
        },
      })
    );
  }

  public setSlideIndex(slideIndex: number) {
    if (this.activeView_) {
      this.activeView_.setSlideIndex(slideIndex);
    }
  }

  public setOnShow(f: () => void) {
    this.onShow_ = f;
  }

  public showWebview(url: string, options?: ShowOptions): void {
    if (this.activeView_) {
      this.activeView_.show(url, options);
    } else {
      const view = QuartoPreviewView.create(this.extensionUri_, url, options);
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
    const view = QuartoPreviewView.restore(this.extensionUri_, url, panel);
    this.registerWebviewListeners(view);
    this.activeView_ = view;
  }

  private registerWebviewListeners(view: QuartoPreviewView) {
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
  private activeView_?: QuartoPreviewView;
  private onShow_?: () => void;
  private readonly extensionUri_: Uri;
}

class QuartoPreviewView extends Disposable {
  public static readonly viewType = "quarto.previewView";

  private static readonly title = "Quarto Preview";

  private readonly _webviewPanel: WebviewPanel;

  private readonly _onDidDispose = this._register(new EventEmitter<void>());
  public readonly onDispose = this._onDidDispose.event;

  public static create(
    extensionUri: Uri,
    url: string,
    showOptions?: ShowOptions
  ): QuartoPreviewView {
    const webview = window.createWebviewPanel(
      QuartoPreviewView.viewType,
      QuartoPreviewView.title,
      {
        viewColumn: showOptions?.viewColumn ?? ViewColumn.Active,
        preserveFocus: showOptions?.preserveFocus,
      },
      {
        enableScripts: true,
        enableForms: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          Uri.joinPath(extensionUri, "assets", "www", "preview"),
        ],
      }
    );
    return new QuartoPreviewView(extensionUri, url, webview);
  }

  public static restore(
    extensionUri: Uri,
    url: string,
    webview: WebviewPanel
  ): QuartoPreviewView {
    return new QuartoPreviewView(extensionUri, url, webview);
  }

  private constructor(
    private readonly extensionUri: Uri,
    url: string,
    webviewPanel: WebviewPanel
  ) {
    super();

    this._webviewPanel = this._register(webviewPanel);

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage((e) => {
        switch (e.type) {
          case "openExternal":
            try {
              const url = Uri.parse(e.url);
              env.openExternal(url);
            } catch {
              // Noop
            }
            break;
        }
      })
    );

    this._register(
      this._webviewPanel.onDidDispose(() => {
        this.dispose();
      })
    );

    this._register(
      workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration("simpleBrowser.focusLockIndicator.enabled")
        ) {
          const configuration = workspace.getConfiguration("simpleBrowser");
          this._webviewPanel.webview.postMessage({
            type: "didChangeFocusLockIndicatorEnabled",
            focusLockEnabled: configuration.get<boolean>(
              "focusLockIndicator.enabled",
              true
            ),
          });
        }
      })
    );

    this._register(
      window.onDidChangeActiveColorTheme((_e) => {
        this._webviewPanel.webview.postMessage({
          type: "didChangeActiveColorTheme",
          theme:
            window.activeColorTheme.kind == ColorThemeKind.Light
              ? "light"
              : "dark",
        });
      })
    );

    this.show(url);
  }

  public override dispose() {
    this._onDidDispose.fire();
    super.dispose();
  }

  public show(url: string, options?: ShowOptions) {
    this._webviewPanel.webview.html = this.getHtml(url);
    this._webviewPanel.reveal(options?.viewColumn, options?.preserveFocus);
  }

  public reveal() {
    this._webviewPanel.reveal(undefined, true);
  }

  public setSlideIndex(slideIndex: number) {
    this._webviewPanel.webview.postMessage({
      type: "setSlideIndex",
      index: slideIndex,
    });
  }

  private getHtml(url: string) {
    const configuration = workspace.getConfiguration("simpleBrowser");

    const nonce = getNonce();

    const mainJs = this.extensionResourceUrl(this.assetPath("index.js"));
    const mainCss = this.extensionResourceUrl(this.assetPath("main.css"));
    const codiconsUri = this.extensionResourceUrl(
      this.assetPath("codicon.css")
    );

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

				<meta id="simple-browser-settings" data-settings="${escapeAttribute(
          JSON.stringify({
            url: url,
            focusLockEnabled: configuration.get<boolean>(
              "focusLockIndicator.enabled",
              true
            ),
          })
        )}">

				<link rel="stylesheet" type="text/css" href="${mainCss}">
				<link rel="stylesheet" type="text/css" href="${codiconsUri}">
			</head>
			<body>
				<header class="header">
					<nav class="controls">
						<button
							title=""Back"
							class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

						<button
							title="Forward"
							class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

						<button
							title="Reload"
							class="reload-button icon"><i class="codicon codicon-refresh"></i></button>
					</nav>

					<input class="url-input" type="text">

					<nav class="controls">
						<button
							title="Open in browser"
							class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
					</nav>
				</header>
				<div class="content">
					<div class="iframe-focused-alert">Focus Lock</div>
					<iframe sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
				</div>

				<script src="${mainJs}" nonce="${nonce}"></script>
			</body>
			</html>`;
  }

  private assetPath(asset: string): string[] {
    return ["assets", "www", "preview", asset];
  }

  private extensionResourceUrl(parts: string[]): Uri {
    return this._webviewPanel.webview.asWebviewUri(
      Uri.joinPath(this.extensionUri, ...parts)
    );
  }
}

function escapeAttribute(value: string | Uri): string {
  return value.toString().replace(/"/g, "&quot;");
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

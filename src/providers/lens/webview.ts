/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// https://code.visualstudio.com/api/extension-guides/webview

import {
  WebviewViewProvider,
  WebviewView,
  Uri,
  window,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  CancellationTokenSource,
} from "vscode";
import {
  createRenderCacheKey,
  RenderCacheKey,
  renderCacheKeyEquals,
  renderCacheKeyNone,
} from "./render-cache";
import { renderActiveLens, renderWebviewHtml } from "./render-lens";

export class QuartoLensViewProvider implements WebviewViewProvider, Disposable {
  public static readonly viewType = "quarto-lens";

  constructor(extensionUri: Uri) {
    this.extensionUri_ = extensionUri;

    window.onDidChangeActiveTextEditor(
      () => {
        this.render();
      },
      null,
      this._disposables
    );

    window.onDidChangeTextEditorSelection(
      () => {
        this.render();
      },
      null,
      this._disposables
    );

    this.render();
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext<unknown>,
    _token: CancellationToken
  ): void | Thenable<void> {
    this.view_ = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri_],
    };

    webviewView.onDidChangeVisibility(() => {
      if (this.view_?.visible) {
        this.render(true);
      }
    });

    webviewView.onDidDispose(() => {
      this.view_ = undefined;
    });

    webviewView.webview.html = renderWebviewHtml(
      webviewView.webview,
      this.extensionUri_
    );
  }

  public dispose() {
    let item: Disposable | undefined;
    while ((item = this._disposables.pop())) {
      item.dispose();
    }
  }

  private async render(ignoreCache = false) {
    // ignore if we have no view
    if (!this.view_) {
      return;
    }

    // don't render if the editor state hasn't changed (i.e. the cursor
    // isn't on a new word range)
    const newRenderCacheKey = createRenderCacheKey(window.activeTextEditor);
    if (
      !ignoreCache &&
      renderCacheKeyEquals(this.currentRenderCacheKey_, newRenderCacheKey)
    ) {
      return;
    }
    this.currentRenderCacheKey_ = newRenderCacheKey;

    // if we have a previous load in progress then cancel it
    if (this.rendering_) {
      this.rendering_.cts.cancel();
      this.rendering_ = undefined;
    }

    // set loading
    const renderingEntry = { cts: new CancellationTokenSource() };
    this.rendering_ = renderingEntry;

    // promise used to perform updates (this will be raced with a progress indicator)
    const renderPromise = (async () => {
      // get html
      const html = await renderActiveLens(renderingEntry.cts.token);

      // check for cancel
      if (renderingEntry.cts.token.isCancellationRequested) {
        return;
      }

      // check for another render started after us
      if (this.rendering_ !== renderingEntry) {
        // A new entry has started loading since we started
        return;
      }
      this.rendering_ = undefined;

      // post update to view
      if (html.length) {
        this.view_?.webview.postMessage({
          type: "update",
          body: html,
        });
      } else {
        this.view_?.webview.postMessage({
          type: "noContent",
          body: "No lens available",
        });
      }
    })();

    // only show progress indicator if it takes longer than 250ms to render
    await Promise.race([
      renderPromise,

      new Promise<void>((resolve) => setTimeout(resolve, 250)).then(() => {
        if (renderingEntry.cts.token.isCancellationRequested) {
          return;
        }
        return window.withProgress(
          { location: { viewId: QuartoLensViewProvider.viewType } },
          () => renderPromise
        );
      }),
    ]);
  }

  private view_?: WebviewView;
  private readonly extensionUri_: Uri;
  private readonly _disposables: Disposable[] = [];

  private currentRenderCacheKey_: RenderCacheKey = renderCacheKeyNone;
  private rendering_?: { cts: CancellationTokenSource };
}

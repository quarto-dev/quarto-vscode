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
  ExtensionContext,
} from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import { languageNameFromBlock } from "../../markdown/language";
import { languageBlockAtPosition } from "../../vdoc/vdoc";
import {
  createRenderCacheKey,
  RenderCacheKey,
  renderCacheKeyEquals,
  renderCacheKeyNone,
} from "./render-cache";
import { renderActiveAssist, renderWebviewHtml } from "./render-assist";

export class QuartoAssistViewProvider
  implements WebviewViewProvider, Disposable
{
  public static readonly viewType = "quarto-assist";

  constructor(context: ExtensionContext, engine: MarkdownEngine) {
    this.extensionUri_ = context.extensionUri;
    this.engine_ = engine;

    window.onDidChangeActiveTextEditor(
      () => {
        if (this.view_?.visible) {
          this.render();
        }
      },
      null,
      this._disposables
    );

    window.onDidChangeTextEditorSelection(
      () => {
        if (this.view_?.visible) {
          this.render();
        }
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
      enableCommandUris: true,
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

    this.render(true);
  }

  public activate() {
    if (this.view_) {
      this.view_.show(true);
      return true;
    } else {
      return false;
    }
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
      // determine default language
      let defaultLanguage = "";
      if (window.activeTextEditor?.document) {
        const tokens = await this.engine_.parse(
          window.activeTextEditor?.document
        );
        const languageBlock = languageBlockAtPosition(
          tokens,
          window.activeTextEditor.selection.active
        );
        if (languageBlock) {
          defaultLanguage = languageNameFromBlock(languageBlock);
        }
      }

      // get html
      const assist = await renderActiveAssist(
        renderingEntry.cts.token,
        defaultLanguage
      );

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
      if (assist) {
        if (this.view_) {
          this.view_.webview.postMessage({
            type: "update",
            body: `<div class="${assist.type.toLowerCase()}">${
              assist.html
            }</div>`,
          });
          this.view_.description = assist.type;
        }
      } else {
        if (this.view_) {
          this.view_?.webview.postMessage({
            type: "noContent",
            body:
              "Quarto Assist provides contextual help for code and live preview for equation editing. " +
              "Help will display automatically when your cursor is located on a symbol with " +
              "help content available (for example, a function or yaml option).",
          });
          this.view_.description = undefined;
        }
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
          { location: { viewId: QuartoAssistViewProvider.viewType } },
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

  private readonly engine_: MarkdownEngine;
}

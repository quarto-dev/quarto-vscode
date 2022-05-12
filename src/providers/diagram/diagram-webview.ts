/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import debounce from "lodash.debounce";
import { ExtensionContext, Uri, WebviewPanel, window, Position } from "vscode";
import { isGraphvizDoc, isMermaidDoc, isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isDiagram,
  languageBlockAtPosition,
  languageNameFromBlock,
} from "../../markdown/language";
import { QuartoWebview, QuartoWebviewManager } from "../webview";

// TODO: rendering errors
// TODO: progress treatment (and enque requests)
// TODO: svg transitions with d3
// TODO: graphviz scaling
// TODO: dark mode

export interface DiagramState {
  engine: "mermaid" | "graphviz";
  src: string;
}

export class QuartoDiagramWebviewManager extends QuartoWebviewManager<
  QuartoDiagramWebview,
  null
> {
  constructor(
    context: ExtensionContext,
    private readonly engine_: MarkdownEngine
  ) {
    super(
      context,
      "quarto.diagramView",
      "Quarto: Diagram",
      QuartoDiagramWebview
    );

    window.onDidChangeActiveTextEditor(
      () => {
        this.updatePreview();
      },
      null,
      this.disposables_
    );

    window.onDidChangeTextEditorSelection(
      debounce(() => {
        this.updatePreview();
      }, 500),
      null,
      this.disposables_
    );
  }

  protected override onViewStateChanged(): void {
    this.updatePreview();
  }

  private async updatePreview() {
    if (this.isVisible()) {
      // determine diagram state
      let state: DiagramState | undefined;

      // get the active editor
      if (window.activeTextEditor) {
        const doc = window.activeTextEditor.document;
        if (isQuartoDoc(doc)) {
          // if we are in a diagram block then send its contents
          const tokens = await this.engine_.parse(doc);
          const line = window.activeTextEditor.selection.start.line;
          const block = languageBlockAtPosition(tokens, new Position(line, 0));
          if (block && isDiagram(block)) {
            const language = languageNameFromBlock(block);
            state = {
              engine: language === "dot" ? "graphviz" : "mermaid",
              src: block.content,
            };
          }
        } else if (isMermaidDoc(doc)) {
          state = {
            engine: "mermaid",
            src: doc.getText(),
          };
        } else if (isGraphvizDoc(doc)) {
          state = {
            engine: "graphviz",
            src: doc.getText(),
          };
        }
      }

      // send the update
      this.activeView_?.update(state);
    }
  }
}

class QuartoDiagramWebview extends QuartoWebview<null> {
  public constructor(
    extensionUri: Uri,
    state: null,
    webviewPanel: WebviewPanel
  ) {
    super(extensionUri, state, webviewPanel);

    this._register(
      this._webviewPanel.webview.onDidReceiveMessage((e) => {
        switch (e.type) {
          case "initialized":
            this.initialized_ = true;
            if (this.pendingState_) {
              const state = this.pendingState_;
              this.pendingState_ = undefined;
              this.update(state);
            }
            break;
        }
      })
    );
  }

  public update(state?: DiagramState) {
    if (!this.initialized_) {
      this.pendingState_ = state;
    } else if (state) {
      this._webviewPanel.webview.postMessage({
        type: "render",
        ...state,
      });
    } else {
      this._webviewPanel.webview.postMessage({
        type: "clear",
      });
    }
  }

  protected getHtml(_state: null): string {
    const headerHtml = ``;

    const bodyHtml = `<div id="diagram-preview"></div>`;

    return this.webviewHTML(
      [
        this.assetPath("mermaid.min.js"),
        this.assetPath("graphviz.min.js"),
        this.assetPath("diagram.js"),
      ],
      this.assetPath("diagram.css"),
      headerHtml,
      bodyHtml,
      true
    );
  }

  private assetPath(asset: string) {
    return ["assets", "www", "diagram", asset];
  }

  private initialized_ = false;
  private pendingState_: DiagramState | undefined;
}

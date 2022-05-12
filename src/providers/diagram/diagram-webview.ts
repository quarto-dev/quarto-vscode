/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, WebviewPanel } from "vscode";
import { QuartoWebview, QuartoWebviewManager } from "../webview";

export interface DiagramState {
  type: "mermaid" | "dot";
}

// https://marketplace.visualstudio.com/items?itemName=EFanZh.graphviz-preview

// tempting to integrate w/ this
// https://github.com/tintinweb/vscode-interactive-graphviz

export class QuartoDiagramWebviewManager extends QuartoWebviewManager<
  QuartoDiagramWebview,
  string
> {}

export class QuartoDiagramWebview extends QuartoWebview<string> {
  public constructor(
    extensionUri: Uri,
    state: string,
    webviewPanel: WebviewPanel
  ) {
    super(extensionUri, state, webviewPanel);
  }

  protected getHtml(_state: string): string {
    const headerHtml = ``;

    const bodyHtml = `body`;

    return this.webviewHTML(
      this.assetPath("diagram.js"),
      this.assetPath("diagram.css"),
      headerHtml,
      bodyHtml
    );
  }

  private assetPath(asset: string) {
    return ["assets", "www", "diagram", asset];
  }
}

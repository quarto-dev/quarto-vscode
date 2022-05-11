/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, WebviewPanel } from "vscode";
import { QuartoWebview, QuartoWebviewManager } from "../webview";

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

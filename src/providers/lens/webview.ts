/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  WebviewViewProvider,
  WebviewView,
  Uri,
  WebviewViewResolveContext,
  CancellationToken,
} from "vscode";

export class QuartoLensViewProvider implements WebviewViewProvider {
  public static readonly viewType = "quarto-lens";

  private view_?: WebviewView;
  private readonly extensionUri_: Uri;

  constructor(extensionUri: Uri) {
    this.extensionUri_ = extensionUri;
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    _context: WebviewViewResolveContext<unknown>,
    _token: CancellationToken
  ): void | Thenable<void> {
    this.view_ = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this.extensionUri_],
    };

    webviewView.webview.html = this.webviewHtml();

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "colorSelected": {
          break;
        }
      }
    });
  }

  private webviewHtml() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Quarto Lens</title>
</head>
<body>
  Quarto Lens
</body>
</html> 
`;
  }
}

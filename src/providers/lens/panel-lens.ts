/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  ExtensionContext,
  ProviderResult,
  TextDocument,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  window,
  Range,
  languages,
  commands,
} from "vscode";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { isDisplayMath } from "../../markdown/language";

export function activateLensPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
) {
  const provider = new LensViewProvider(context.extensionUri);

  context.subscriptions.push(
    window.registerWebviewViewProvider(LensViewProvider.viewType, provider)
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoLensCodeLensProvider(engine)
    )
  );

  context.subscriptions.push(
    commands.registerCommand("quarto.previewMath", () => {
      commands.executeCommand("quarto-lens.focus");
    })
  );
}

class LensViewProvider implements WebviewViewProvider {
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

export function quartoLensCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parseSync(document);
      const mathBlocks = tokens.filter(isDisplayMath);
      for (let i = 0; i < mathBlocks.length; i++) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }

        const block = mathBlocks[i];
        if (block.map) {
          // push code lens
          const range = new Range(block.map[0], 0, block.map[0], 0);
          lenses.push(
            ...[
              new CodeLens(range, {
                title: "$(zoom-in) Preview",
                tooltip: "Preview the rendered LaTeX math",
                command: "quarto.previewMath",
                arguments: [block.map[0] + 1],
              }),
            ]
          );
        }
      }
      return lenses;
    },
  };
}

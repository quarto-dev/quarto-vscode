/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  Uri,
  window,
  CancellationToken,
  Webview,
  TextEditor,
  Hover,
  commands,
  MarkedString,
  MarkdownString,
} from "vscode";

export function renderWebviewHtml(webview: Webview, extensionUri: Uri) {
  const nonce = scriptNonce();
  const scriptUri = webview.asWebviewUri(assetUri("lens.js", extensionUri));
  const styleUri = webview.asWebviewUri(assetUri("lens.css", extensionUri));

  return /* html */ `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">

      <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
        img-src data: https:;
        ">

      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <link href="${styleUri}" rel="stylesheet">
      
      <title>Quarto Lens</title>
    </head>
    <body>
      <article id="main"></article>

      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export async function renderActiveLens(
  token: CancellationToken
): Promise<string> {
  const editor = window.activeTextEditor;
  if (!editor) {
    return "";
  }

  const hovers = await getHoversAtCurrentPositionInEditor(editor);

  if (token.isCancellationRequested) {
    return "";
  }

  return hovers?.length
    ? `<pre>${getMarkdown(hovers[0].contents[0])} </pre>`
    : "";
}

function getHoversAtCurrentPositionInEditor(editor: TextEditor) {
  return commands.executeCommand<Hover[]>(
    "vscode.executeHoverProvider",
    editor.document.uri,
    editor.selection.active
  );
}

function getMarkdown(content: MarkedString | MarkdownString | string): string {
  if (typeof content === "string") {
    return content;
  } else if (content instanceof MarkdownString) {
    return content.value;
  } else {
    const markdown = new MarkdownString();
    markdown.appendCodeblock(content.value, content.language);
    return markdown.value;
  }
}

function scriptNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function assetUri(file: string, extensionUri: Uri) {
  return Uri.joinPath(extensionUri, "assets", "www", "lens", file);
}

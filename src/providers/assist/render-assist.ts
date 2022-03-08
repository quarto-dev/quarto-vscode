/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: test quarto assist for R (no signature tip?)
// TODO: if no signature tip, perhaps scan backwards if cursor is in between two params
// TODO: word range detection doesn't work for signature tip
// TODO: only set seletion for math preview if the selection isn't in the block
// TODO: consider having a help command
// TODO: code lenses only active when panel isn't shown?

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";

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
  SignatureHelp,
  SignatureInformation,
} from "vscode";
import { escapeRegExpCharacters } from "../../core/strings";

const kAssistHelp = "Help";

export function renderWebviewHtml(webview: Webview, extensionUri: Uri) {
  const nonce = scriptNonce();
  const scriptUri = webview.asWebviewUri(assetUri("assist.js", extensionUri));
  const styleUri = webview.asWebviewUri(assetUri("assist.css", extensionUri));

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

export interface Assist {
  type: string;
  html: string;
}

export async function renderActiveAssist(
  token: CancellationToken,
  language?: string
): Promise<Assist | undefined> {
  const editor = window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const hovers = await getHoversAtCurrentPositionInEditor(editor);
  if (token.isCancellationRequested) {
    return undefined;
  }

  if (hovers.length) {
    return getAssistFromHovers(hovers, language);
  } else {
    const help = await getSignatureHelpAtCurrentPositionInEditor(editor);
    if (help) {
      return getAssistFromSignatureHelp(help, language);
    } else {
      return undefined;
    }
  }
}

function getHoversAtCurrentPositionInEditor(editor: TextEditor) {
  return commands.executeCommand<Hover[]>(
    "vscode.executeHoverProvider",
    editor.document.uri,
    editor.selection.active
  );
}

function getSignatureHelpAtCurrentPositionInEditor(editor: TextEditor) {
  return commands.executeCommand<SignatureHelp>(
    "vscode.executeSignatureHelpProvider",
    editor.document.uri,
    editor.selection.active
  );
}

function getAssistFromHovers(hovers: Hover[], language?: string) {
  const parts = hovers
    .flatMap((hover) => hover.contents)
    .map((content) => getMarkdown(content))
    .filter((content) => content.length > 0);

  if (!parts.length) {
    return undefined;
  }

  const markdown = parts.join("\n---\n");
  if (filterHoverAssist(markdown)) {
    return renderAssist(kAssistHelp, markdown, language);
  } else {
    return undefined;
  }
}

function filterHoverAssist(markdown: string) {
  return !markdown.match(/^```\w*\n.*?\n```\s*$/);
}

function getAssistFromSignatureHelp(help: SignatureHelp, language?: string) {
  const markdown: string[] = [];

  // build up markdown for signature
  const signature = help.signatures[help.activeSignature];
  const activeParameterIndex =
    signature.activeParameter ?? help.activeParameter;

  if (signature.label) {
    markdown.push("");
    const preCode = `<pre class="signature"><code>`;
    if (signature.parameters.length > 0) {
      markdown.push(
        preCode + renderParameters(signature, activeParameterIndex)
      );
    } else {
      markdown.push(preCode + signature.label);
    }
    markdown.push(`</code></pre>`);
  }

  const activeParameter = signature.parameters[activeParameterIndex];
  if (activeParameter.documentation) {
    markdown.push("");
    markdown.push(getMarkdown(activeParameter.documentation));
  }

  if (signature.documentation) {
    markdown.push("\n");
    markdown.push(getMarkdown(signature.documentation));
  }

  if (markdown.length > 0) {
    return renderAssist(kAssistHelp, markdown.join("\n"), language);
  } else {
    return undefined;
  }
}

function renderParameters(
  signature: SignatureInformation,
  activeParameterIndex: number
) {
  const [start, end] = getParameterLabelOffsets(
    signature,
    activeParameterIndex
  );

  const parameters = `${signature.label.substring(
    0,
    start
  )}<span class="parameter active">${signature.label.substring(
    start,
    end
  )}</span>${signature.label.substring(end)}`;

  return parameters;
}

function getParameterLabelOffsets(
  signature: SignatureInformation,
  paramIdx: number
): [number, number] {
  const param = signature.parameters[paramIdx];
  if (!param) {
    return [0, 0];
  } else if (Array.isArray(param.label)) {
    return param.label;
  } else if (!param.label.length) {
    return [0, 0];
  } else {
    const regex = new RegExp(
      `(\\W|^)${escapeRegExpCharacters(param.label)}(?=\\W|$)`,
      "g"
    );
    regex.test(signature.label);
    const idx = regex.lastIndex - param.label.length;
    return idx >= 0 ? [idx, regex.lastIndex] : [0, 0];
  }
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

function renderAssist(type: string, markdown: string, language?: string) {
  const md = MarkdownIt("commonmark", {
    html: true,
    linkify: true,
    highlight: (str, lang) => {
      lang = lang || language || "";
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (error) {
          console.log(error);
        }
      }
      return "";
    },
  });
  return {
    type,
    html: md.render(markdown),
  };
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
  return Uri.joinPath(extensionUri, "assets", "www", "assist", file);
}

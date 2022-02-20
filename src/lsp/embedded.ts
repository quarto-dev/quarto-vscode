/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import Token from "markdown-it/lib/token";
import {
  CancellationToken,
  commands,
  CompletionContext,
  CompletionList,
  Position,
  TextDocument,
  Uri,
  workspace,
} from "vscode";
import { ProvideCompletionItemsSignature } from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";

const kQmdEmbeddedContent = "quarto-qmd-embedded-content";

export function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
  const virtualDocumentContents = new Map<string, string>();

  workspace.registerTextDocumentContentProvider(kQmdEmbeddedContent, {
    provideTextDocumentContent: (uri) => {
      const path = uri.path.slice(1);
      const originalUri = path.slice(0, path.lastIndexOf("."));
      const decodedUri = decodeURIComponent(originalUri);
      const content = virtualDocumentContents.get(decodedUri);
      return content;
    },
  });

  return async (
    document: TextDocument,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
    next: ProvideCompletionItemsSignature
  ) => {
    // see if there is a completion virtual doc we should be using
    const virtualDoc = await completionVirtualDoc(document, position, engine);
    if (virtualDoc) {
      // set virtual doc
      const originalUri = document.uri.toString();
      virtualDocumentContents.set(originalUri, virtualDoc.content);

      // request completions
      const vdocUriString = `${kQmdEmbeddedContent}://${
        virtualDoc.language
      }/${encodeURIComponent(originalUri)}.${virtualDoc.extension}`;
      const vdocUri = Uri.parse(vdocUriString);

      return await commands.executeCommand<CompletionList>(
        "vscode.executeCompletionItemProvider",
        vdocUri,
        position,
        context.triggerCharacter
      );
    } else {
      return await next(document, position, context, token);
    }
  };
}

interface VirtualDoc {
  language: string;
  extension: string;
  content: string;
}

async function completionVirtualDoc(
  document: TextDocument,
  position: Position,
  engine: MarkdownEngine
): Promise<VirtualDoc | undefined> {
  // check if the cursor is in a fenced code block
  const tokens = await engine.parse(document);
  const language = languageAtPosition(tokens, position);

  if (language) {
    // filter out lines that aren't of this language
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push("");
    }
    for (const fencedCode of tokens.filter(isFencedCodeOf(language))) {
      if (fencedCode.map) {
        for (
          let line = fencedCode.map[0] + 1;
          line < fencedCode.map[1] - 1 && line < document.lineCount;
          line++
        ) {
          lines[line] = document.lineAt(line).text;
        }
      }
    }

    // return the language and the content
    return {
      language,
      extension: extensionForLanguage(language),
      content: lines.join("\n"),
    };
  } else {
    return undefined;
  }
}

function extensionForLanguage(language: string) {
  switch (language) {
    case "python":
      return "py";
    default:
      return language;
  }
}

function languageAtPosition(tokens: Token[], position: Position) {
  for (const fencedCode of tokens.filter(isFencedCode)) {
    if (
      fencedCode.map &&
      position.line > fencedCode.map[0] &&
      position.line <= fencedCode.map[1]
    ) {
      return languageFromFenceToken(fencedCode);
    }
  }
  return undefined;
}

function languageFromFenceToken(token: Token) {
  return token.info.replace(/^[^\w]*/, "").replace(/[^\w]$/, "");
}

function isFencedCode(token: Token) {
  return token.type === "fence";
}

function isFencedCodeOf(language: string) {
  return (token: Token) => {
    return isFencedCode(token) && languageFromFenceToken(token) === language;
  };
}

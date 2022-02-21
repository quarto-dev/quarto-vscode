/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Copyright (c) 2019 Takashi Tamura
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";

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
  WorkspaceEdit,
} from "vscode";
import { ProvideCompletionItemsSignature } from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";

export function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
  // initialize embedded conent
  initVirtualDocEmbeddedContent();

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
      // determine what sort of virtual doc we should be using. the temp file
      // method always works for all langauges, the embedded content method
      // is less resource intensive. we explicitliy opt in languages known
      // to work correctly w/ embedded content
      let vdocUri: VirtualDocUri | undefined;
      const kEmbeddedContentLanguages = [
        "html",
        "css",
        "ts",
        "typescript",
        "js",
        "javascript",
      ];
      if (kEmbeddedContentLanguages.includes(virtualDoc.language)) {
        vdocUri = virtualDocUriFromEmbeddedContent(document, virtualDoc);
      } else {
        vdocUri = await virtualDocUriFromTempFile(virtualDoc);
      }

      try {
        return await commands.executeCommand<CompletionList>(
          "vscode.executeCompletionItemProvider",
          vdocUri.uri,
          position,
          context.triggerCharacter
        );
      } catch (error) {
        return undefined;
      } finally {
        await vdocUri.dispose();
      }
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

interface VirtualDocUri {
  uri: Uri;
  dispose: () => Promise<void>;
}

async function virtualDocUriFromTempFile(
  virtualDoc: VirtualDoc
): Promise<VirtualDocUri> {
  // write the virtual doc as a temp file
  const vdocTempFile = createVirtualDocTempFile(virtualDoc);

  // open the document
  const vodcUri = Uri.file(vdocTempFile);
  await workspace.openTextDocument(vodcUri);

  // return the uri and a dispose method that deletes the doc
  return {
    uri: vodcUri,
    dispose: async () => {
      const edit = new WorkspaceEdit();
      edit.deleteFile(vodcUri);
      await workspace.applyEdit(edit);
    },
  };
}

// create temp files for vdocs. use a base directory that has a subdirectory
// for each extension used within the document. this is a no-op if the
// file already exists
tmp.setGracefulCleanup();
const vdocTempDir = tmp.dirSync().name;
function createVirtualDocTempFile(virtualDoc: VirtualDoc) {
  const ext = extensionForLanguage(virtualDoc.language);
  const dir = path.join(vdocTempDir, ext);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const tmpPath = path.join(vdocTempDir, ext, "intellisense." + ext);

  // if this is a python file we write a comment to disable pylance
  // (otherwise issues can flash on and off in the 'Problems' tab)
  const content =
    virtualDoc.language === "python"
      ? virtualDoc.content.replace("\n", "# type: ignore\n")
      : virtualDoc.content;

  fs.writeFileSync(tmpPath, content);

  return tmpPath;
}

const kQmdEmbeddedContent = "quarto-qmd-embedded-content";
const virtualDocumentContents = new Map<string, string>();
function initVirtualDocEmbeddedContent() {
  workspace.registerTextDocumentContentProvider(kQmdEmbeddedContent, {
    provideTextDocumentContent: (uri) => {
      const path = uri.path.slice(1);
      const originalUri = path.slice(0, path.lastIndexOf("."));
      const decodedUri = decodeURIComponent(originalUri);
      const content = virtualDocumentContents.get(decodedUri);
      return content;
    },
  });
}

function virtualDocUriFromEmbeddedContent(
  document: TextDocument,
  virtualDoc: VirtualDoc
): VirtualDocUri {
  // set virtual doc
  const originalUri = document.uri.toString();
  virtualDocumentContents.set(originalUri, virtualDoc.content);

  // form uri
  const vdocUriString = `${kQmdEmbeddedContent}://${
    virtualDoc.language
  }/${encodeURIComponent(originalUri)}.${virtualDoc.extension}`;
  const vdocUri = Uri.parse(vdocUriString);

  return {
    uri: vdocUri,
    dispose: () => Promise.resolve(),
  };
}

function extensionForLanguage(language: string) {
  switch (language) {
    case "python":
      return "py";
    case "ruby":
      return "rb";
    case "typescript":
      return "ts";
    case "javascript":
      return "js";
    case "html":
      return "html";
    case "sql":
      return "sql";
    case "r":
      return "r";
    case "css":
      return "css";
    case "cpp":
    case "rcpp":
      return "cpp";
    case "go":
      return "go";
    case "java":
      return "java";
    case "latex":
    case "tex":
      return "tex";
    case "rust":
      return "rs";
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

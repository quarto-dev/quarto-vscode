/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import { ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import {
  CancellationToken,
  commands,
  CompletionContext,
  CompletionList,
  Position,
  TextDocument,
} from "vscode";
import { ProvideCompletionItemsSignature } from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { completionVirtualDoc } from "./vdoc";
import {
  initVirtualDocEmbeddedContent,
  virtualDocUriFromEmbeddedContent,
} from "./vdoc-content";
import { virtualDocUriFromTempFile } from "./vdoc-tempfile";

let client: LanguageClient;

export function activateLsp(context: ExtensionContext, engine: MarkdownEngine) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "*", language: "quarto" }],
    middleware: {
      provideCompletionItem: embeddedCodeCompletionProvider(engine),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "quarto-lsp",
    "Quarto LSP",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
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
      // if there is a trigger character make sure the langauge supports it
      const language = virtualDoc.language;
      if (context.triggerCharacter) {
        if (
          !language.trigger ||
          !language.trigger.includes(context.triggerCharacter)
        ) {
          return undefined;
        }
      }

      // get uri for completions
      const vdocUri =
        language.type === "content"
          ? virtualDocUriFromEmbeddedContent(document, virtualDoc)
          : await virtualDocUriFromTempFile(virtualDoc);

      // execute completions
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

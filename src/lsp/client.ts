/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import {
  ExtensionContext,
  Hover,
  SignatureHelp,
  SignatureHelpContext,
} from "vscode";
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
import {
  ProvideCompletionItemsSignature,
  ProvideHoverSignature,
  ProvideSignatureHelpSignature,
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { virtualDoc, virtualDocUri } from "./vdoc";
import { activateVirtualDocEmbeddedContent } from "./vdoc-content";
import { deactivateVirtualDocTempFiles } from "./vdoc-tempfile";

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
      provideHover: embeddedHoverProvider(engine),
      provideSignatureHelp: embeddedSignatureHelpProvider(engine),
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
  deactivateVirtualDocTempFiles();

  if (!client) {
    return undefined;
  }
  return client.stop();
}

function embeddedCodeCompletionProvider(engine: MarkdownEngine) {
  // initialize embedded conent
  activateVirtualDocEmbeddedContent();

  return async (
    document: TextDocument,
    position: Position,
    context: CompletionContext,
    token: CancellationToken,
    next: ProvideCompletionItemsSignature
  ) => {
    // see if there is a completion virtual doc we should be using
    const vdoc = await virtualDoc(document, position, engine);

    if (vdoc) {
      // if there is a trigger character make sure the langauge supports it
      const language = vdoc.language;
      if (context.triggerCharacter) {
        if (
          !language.trigger ||
          !language.trigger.includes(context.triggerCharacter)
        ) {
          return undefined;
        }
      }

      // get uri for completions
      const vdocUri = await virtualDocUri(vdoc, document.uri);

      // execute completions
      try {
        return await commands.executeCommand<CompletionList>(
          "vscode.executeCompletionItemProvider",
          vdocUri,
          position,
          context.triggerCharacter
        );
      } catch (error) {
        return undefined;
      }
    } else {
      return await next(document, position, context, token);
    }
  };
}

function embeddedHoverProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    token: CancellationToken,
    next: ProvideHoverSignature
  ) => {
    const vdoc = await virtualDoc(document, position, engine);
    if (vdoc) {
      // get uri for hover
      const vdocUri = await virtualDocUri(vdoc, document.uri);

      // execute hover
      try {
        const hover = await commands.executeCommand<Hover[]>(
          "vscode.executeHoverProvider",
          vdocUri,
          position
        );
        if (!hover) {
          return undefined;
        } else {
          return hover[0];
        }
      } catch (error) {
        return undefined;
      }
    } else {
      return await next(document, position, token);
    }
  };
}

function embeddedSignatureHelpProvider(engine: MarkdownEngine) {
  return async (
    document: TextDocument,
    position: Position,
    context: SignatureHelpContext,
    token: CancellationToken,
    next: ProvideSignatureHelpSignature
  ) => {
    const vdoc = await virtualDoc(document, position, engine);
    if (vdoc) {
      const vdocUri = await virtualDocUri(vdoc, document.uri);
      try {
        return await commands.executeCommand<SignatureHelp>(
          "vscode.executeSignatureHelpProvider",
          vdocUri,
          position,
          context.triggerCharacter
        );
      } catch (error) {
        return undefined;
      }
    } else {
      return await next(document, position, context, token);
    }
  };
}

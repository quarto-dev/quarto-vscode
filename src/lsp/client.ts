/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import {
  ExtensionContext,
  Hover,
  SignatureHelp,
  SignatureHelpContext,
  workspace,
  window,
  ColorThemeKind,
  ConfigurationTarget,
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
  Middleware,
  ProvideCompletionItemsSignature,
  ProvideHoverSignature,
  ProvideSignatureHelpSignature,
} from "vscode-languageclient";
import { MarkdownEngine } from "../markdown/engine";
import { virtualDoc, virtualDocUri } from "../vdoc/vdoc";
import { activateVirtualDocEmbeddedContent } from "../vdoc/vdoc-content";
import { deactivateVirtualDocTempFiles } from "../vdoc/vdoc-tempfile";
import { imageHover } from "../providers/hover-image";

let client: LanguageClient;

export async function activateLsp(
  context: ExtensionContext,
  engine: MarkdownEngine
) {
  // sync color theme config before starting server
  await syncColorThemeConfig();

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

  // create middleware (respect disabling of selected features in config)
  const config = workspace.getConfiguration("quarto");
  const middleware: Middleware = {
    provideCompletionItem: embeddedCodeCompletionProvider(engine),
  };
  if (config.get("cells.hoverHelp.enabled", true)) {
    middleware.provideHover = embeddedHoverProvider(engine);
  }
  if (config.get("cells.signatureHelp.enabled", true)) {
    middleware.provideSignatureHelp = embeddedSignatureHelpProvider(engine);
  }

  // create client options
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "*", language: "quarto" },
      {
        scheme: "*",
        language: "yaml",
        pattern: "**/_{quarto,metadata}.{yml,yaml}",
      },
    ],
    middleware,
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

    if (vdoc && !isWithinYamlComment(document, position)) {
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
    // see if we have any local hover providers
    const imgHover = await imageHover(document, position);
    if (imgHover) {
      return imgHover;
    }

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
        if (hover && hover.length > 0) {
          // reutrn the last hover (arbitrary, but it seems like the
          // LSP results are returned second)
          return hover[hover.length - 1];
        }
      } catch (error) {
        console.log(error);
      }
    }

    // default to server delegation
    return await next(document, position, token);
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

function isWithinYamlComment(doc: TextDocument, pos: Position) {
  const line = doc.lineAt(pos.line).text;
  return !!line.match(/^\s*#\| /);
}

async function syncColorThemeConfig() {
  // update the config
  const updateColorThemeConfig = async () => {
    const theme =
      window.activeColorTheme.kind == ColorThemeKind.Light ? "light" : "dark";
    const quartoConfig = workspace.getConfiguration("quarto");
    await quartoConfig.update(
      "preview.mathjax.theme",
      theme,
      ConfigurationTarget.Global
    );
  };
  await updateColorThemeConfig();

  // listen for changes and update on change
  workspace.onDidChangeConfiguration(async (ev) => {
    if (ev.affectsConfiguration("workbench.colorTheme")) {
      await updateColorThemeConfig();
    }
  });
}

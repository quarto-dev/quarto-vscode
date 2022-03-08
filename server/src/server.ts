/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  createConnection,
  Diagnostic,
  InitializeParams,
  ProposedFeatures,
  TextDocumentIdentifier,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { isQuartoDoc, isQuartoYaml } from "./core/doc";
import {
  kCompletionCapabilities,
  onCompletion,
} from "./providers/completion/completion";
import { kHoverCapabilities, onHover } from "./providers/hover/hover";
import { kSignatureCapabilities, onSignatureHelp } from "./providers/signature";
import { provideDiagnostics } from "./providers/diagnostics";

import { initializeQuarto } from "./quarto/quarto";

// initialize connection to quarto
initializeQuarto();

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
function resolveDoc(docId: TextDocumentIdentifier) {
  const doc = documents.get(docId.uri);
  if (!doc) {
    return null;
  }
  if (isQuartoDoc(doc) || isQuartoYaml(doc)) {
    return doc;
  } else {
    return null;
  }
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
connection.onInitialize((_params: InitializeParams) => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      ...kCompletionCapabilities,
      ...kHoverCapabilities,
      ...kSignatureCapabilities,
    },
  };
});

connection.onCompletion(async (textDocumentPosition, _token) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    return await onCompletion(
      doc,
      textDocumentPosition.position,
      textDocumentPosition.context
    );
  } else {
    return null;
  }
});

connection.onHover(async (textDocumentPosition, _token) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    return await onHover(doc, textDocumentPosition.position);
  } else {
    return null;
  }
});

connection.onSignatureHelp(async (textDocumentPosition, _token) => {
  const doc = resolveDoc(textDocumentPosition.textDocument);
  if (doc) {
    return await onSignatureHelp(doc, textDocumentPosition.position);
  } else {
    return null;
  }
});

// diagnostics on open and save (clear on doc modified)
documents.onDidOpen(async (e) => {
  sendDiagnostics(e.document, await provideDiagnostics(e.document));
});
documents.onDidSave(async (e) => {
  sendDiagnostics(e.document, await provideDiagnostics(e.document));
});
documents.onDidChangeContent(async (e) => {
  sendDiagnostics(e.document, []);
});
function sendDiagnostics(doc: TextDocument, diagnostics: Diagnostic[]) {
  connection.sendDiagnostics({
    uri: doc.uri,
    version: doc.version,
    diagnostics,
  });
}

// listen
documents.listen(connection);
connection.listen();

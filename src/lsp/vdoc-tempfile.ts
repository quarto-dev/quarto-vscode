/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2019 Takashi Tamura
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import { TextDocument, Uri, workspace, WorkspaceEdit } from "vscode";
import { CompletionVirtualDoc } from "./vdoc";

// one virtual doc per language file extension
const languageVirtualDocs = new Map<String, TextDocument>();

export async function virtualDocUriFromTempFile(
  virtualDoc: CompletionVirtualDoc
) {
  // do we have an existing document?
  const langVdoc = languageVirtualDocs.get(virtualDoc.language.extension);
  if (langVdoc) {
    if (langVdoc.getText() === virtualDoc.content) {
      // if its content is identical to what's passed in then just return it
      return langVdoc.uri;
    } else {
      // otherwise remove it (it will get recreated below)
      await deleteDocument(langVdoc);
      languageVirtualDocs.delete(virtualDoc.language.extension);
    }
  }

  // write the virtual doc as a temp file
  const vdocTempFile = createVirtualDocTempFile(virtualDoc);

  // open the document and save a reference to it
  const vodcUri = Uri.file(vdocTempFile);
  const doc = await workspace.openTextDocument(vodcUri);
  languageVirtualDocs.set(virtualDoc.language.extension, doc);

  // return the uri
  return doc.uri;
}

// delete any vdocs left open
export async function deactivateVirtualDocTempFiles() {
  languageVirtualDocs.forEach(async (doc) => {
    await deleteDocument(doc);
  });
}

// delete a document
async function deleteDocument(doc: TextDocument) {
  const edit = new WorkspaceEdit();
  edit.deleteFile(doc.uri);
  await workspace.applyEdit(edit);
}

// create temp files for vdocs. use a base directory that has a subdirectory
// for each extension used within the document. this is a no-op if the
// file already exists
tmp.setGracefulCleanup();
const vdocTempDir = tmp.dirSync().name;
function createVirtualDocTempFile(virtualDoc: CompletionVirtualDoc) {
  const ext = virtualDoc.language.extension;
  const dir = path.join(vdocTempDir, ext);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  const tmpPath = path.join(vdocTempDir, ext, "intellisense." + ext);

  // if this is a python file we write a comment to disable pylance
  // (otherwise issues can flash on and off in the 'Problems' tab)
  const content = virtualDoc.language.inject
    ? virtualDoc.content.replace("\n", `${virtualDoc.language.inject}\n`)
    : virtualDoc.content;

  fs.writeFileSync(tmpPath, content);

  return tmpPath;
}

/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Copyright (c) 2019 Takashi Tamura
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import { Uri, workspace, WorkspaceEdit } from "vscode";
import { extensionForLanguage } from "./languages";
import { CompletionVirtualDoc, CompletionVirtualDocUri } from "./vdoc";

export async function virtualDocUriFromTempFile(
  virtualDoc: CompletionVirtualDoc
): Promise<CompletionVirtualDocUri> {
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
function createVirtualDocTempFile(virtualDoc: CompletionVirtualDoc) {
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

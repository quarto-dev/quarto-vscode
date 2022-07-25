/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { TextDocument } from "vscode-languageserver-textdocument";
import { Range, Position } from "vscode-languageserver-types";

import {
  CompletionContext,
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node";
import { projectDirForDocument } from "../../../core/doc";
import {
  documentFrontMatter,
  isContentPosition,
} from "../../../core/markdown/markdown";

import { EditorContext, quarto } from "../../../quarto/quarto";
import { biblioCompletions } from "./completion-biblio";
import { crossrefCompletions } from "./completion-crossref";

export async function refsCompletions(
  doc: TextDocument,
  pos: Position,
  context: EditorContext,
  _completionContext?: CompletionContext
): Promise<CompletionItem[] | null> {
  // bail if no quarto connection
  if (!quarto) {
    return null;
  }

  // validate trigger
  if (context.trigger && !["@"].includes(context.trigger)) {
    return null;
  }

  // bypass if the current line doesn't contain a @
  // (performance optimization so we don't execute the regexs
  // below if we don't need to)
  if (context.line.indexOf("@") === -1) {
    return null;
  }

  // ensure we have the file scheme
  if (!doc.uri.startsWith("file:")) {
    return null;
  }

  // check if we are in markdown
  if (!isContentPosition(doc, pos)) {
    return null;
  }

  // scan back from the cursor to see if there is a @
  const line = doc
    .getText(Range.create(pos.line, 0, pos.line + 1, 0))
    .trimEnd();
  const text = line.slice(0, pos.character);
  const atPos = text.lastIndexOf("@");
  const spacePos = text.lastIndexOf(" ");

  if (atPos !== -1 && atPos > spacePos) {
    // everything between the @ and the cursor must match the cite pattern
    const tokenText = text.slice(atPos + 1, pos.character);
    if (/[^@;\[\]\s\!\,]*/.test(tokenText)) {
      // make sure there is no text directly ahead (except bracket, space, semicolon)
      const nextChar = text.slice(pos.character, pos.character + 1);
      if (!nextChar || [";", " ", "]"].includes(nextChar)) {
        // construct path
        const path = new URL(doc.uri).pathname;
        const projectDir = projectDirForDocument(path);

        const biblioItems = await biblioCompletions(
          tokenText,
          documentFrontMatter(doc),
          path,
          projectDir
        );
        const crossrefItems = await crossrefCompletions(
          tokenText,
          doc.getText(),
          path,
          projectDir
        );
        if (biblioItems || crossrefItems) {
          return (biblioItems || []).concat(crossrefItems || []);
        } else {
          return null;
        }
      }
    }
  }

  return null;
}

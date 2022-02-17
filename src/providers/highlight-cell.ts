/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) [2021] [Chris Bain] (https://github.com/baincd/vscode-markdown-color-plus/)
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import debounce from "lodash.debounce";

import { isQuartoFile, kQuartoDocumentSelector } from "../core/file";

let codeBackgrondDecoration: vscode.TextEditorDecorationType | undefined =
  undefined;

const kHighlightDelayMs = 2000;

export function activateCellHighlighter(context: vscode.ExtensionContext) {
  // create shared background decoration
  codeBackgrondDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    light: {
      backgroundColor: "#DCDCDC66",
    },
    dark: {
      backgroundColor: "#0A0A0A66",
    },
  });

  // update highlighting when docs are opened
  vscode.workspace.onDidOpenTextDocument(
    (doc) => {
      if (doc === vscode.window.activeTextEditor?.document) {
        if (!isQuartoFile(doc)) {
          clearEditorHighlightDecorations(vscode.window.activeTextEditor);
        } else {
          triggerUpdateActiveEditorDecorations(
            vscode.window.activeTextEditor,
            kHighlightDelayMs
          );
        }
      }
    },
    null,
    context.subscriptions
  );

  // update highlighting when visible text editors change
  vscode.window.onDidChangeVisibleTextEditors(
    (_editors) => {
      triggerUpdateAllEditorsDecorations();
    },
    null,
    context.subscriptions
  );

  // update highlighting on changes to the document
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        triggerUpdateActiveEditorDecorations(
          vscode.window.activeTextEditor,
          kHighlightDelayMs,
          true,
          event.contentChanges.length == 1
            ? event.contentChanges[0].range.start
            : undefined
        );
      }
    },
    null,
    context.subscriptions
  );

  // update highlighting for ordinary document highlighter callbacks
  context.subscriptions.push(
    vscode.languages.registerDocumentHighlightProvider(
      kQuartoDocumentSelector,
      {
        provideDocumentHighlights: function (
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken
        ) {
          if (document === vscode.window.activeTextEditor?.document) {
            triggerUpdateActiveEditorDecorations(
              vscode.window.activeTextEditor,
              kHighlightDelayMs,
              true,
              position,
              token
            );
          }
          return [];
        },
      }
    )
  );

  // highlight all editors at activation time
  triggerUpdateAllEditorsDecorations();
}

function triggerUpdateActiveEditorDecorations(
  editor: vscode.TextEditor,
  delay: number,
  immediate?: boolean,
  pos?: vscode.Position,
  token?: vscode.CancellationToken
) {
  debounce(() => setEditorHighlightDecorations(editor, pos, token), delay, {
    leading: !!immediate,
  })();
}

function triggerUpdateAllEditorsDecorations() {
  debounce(
    () =>
      vscode.window.visibleTextEditors.forEach((e) =>
        setEditorHighlightDecorations(e)
      ),
    kHighlightDelayMs
  )();
}

function setEditorHighlightDecorations(
  editor: vscode.TextEditor,
  _pos?: vscode.Position,
  token?: vscode.CancellationToken
) {
  const executableCodeBlocks: vscode.Range[] = [];

  let currentLine = -1;
  while (
    !token?.isCancellationRequested &&
    ++currentLine < editor.document.lineCount
  ) {
    let line = editor.document.lineAt(currentLine).text;
    const match = line.match(
      /^([\t >]*)(```+)\s*\{([a-zA-Z0-9_]+)(?: *[ ,].*?)?\}[ \t]*$/
    );
    if (match) {
      // get the match and record the start line
      const prefix = match[1];
      const ticks = match[2];
      const startLine = currentLine;

      // look for the end line
      const endPattern = new RegExp("^" + prefix + ticks + "[ \\t]*$");
      while (++currentLine < editor.document.lineCount) {
        let line = editor.document.lineAt(currentLine).text;
        if (line.match(endPattern)) {
          executableCodeBlocks.push(
            new vscode.Range(startLine, 0, currentLine, line.length)
          );
          break;
        }
      }
    }
  }

  // set highlights
  editor.setDecorations(codeBackgrondDecoration!, executableCodeBlocks);
}

function clearEditorHighlightDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(codeBackgrondDecoration!, []);
}

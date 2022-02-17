/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) [2021] [Chris Bain] (https://github.com/baincd/vscode-markdown-color-plus/)
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import debounce from "lodash.debounce";

import { isQuartoFile, kQuartoDocumentSelector } from "../core/file";

export function activateCellHighlighter(context: vscode.ExtensionContext) {
  // read config and monitor it for changes
  highlightingConfig.sync();
  vscode.workspace.onDidChangeConfiguration(
    () => {
      highlightingConfig.sync();
      triggerUpdateAllEditorsDecorations();
    },
    null,
    context.subscriptions
  );

  // update highlighting when docs are opened
  vscode.workspace.onDidOpenTextDocument(
    (doc) => {
      if (doc === vscode.window.activeTextEditor?.document) {
        if (!isQuartoFile(doc)) {
          clearEditorHighlightDecorations(vscode.window.activeTextEditor);
        } else {
          triggerUpdateActiveEditorDecorations(
            vscode.window.activeTextEditor,
            highlightingConfig.delayMs()
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
          highlightingConfig.delayMs(),
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
              highlightingConfig.delayMs(),
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
    highlightingConfig.delayMs()
  )();
}

function setEditorHighlightDecorations(
  editor: vscode.TextEditor,
  _pos?: vscode.Position,
  token?: vscode.CancellationToken
) {
  if (!editor || !isQuartoFile(editor.document)) {
    return;
  }

  const executableCodeBlocks: vscode.Range[] = [];

  if (highlightingConfig.enabled()) {
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
  }

  // set highlights (could be none if we highlighting isn't enabled)
  editor.setDecorations(
    highlightingConfig.backgroundDecoration(),
    executableCodeBlocks
  );
}

function clearEditorHighlightDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(highlightingConfig.backgroundDecoration(), []);
}

class HiglightingConfig {
  constructor() {}

  public enabled() {
    return this.enabled_;
  }

  public backgroundDecoration() {
    return this.backgroundDecoration_!;
  }

  public delayMs() {
    return this.delayMs_;
  }

  public sync() {
    const config = vscode.workspace.getConfiguration("quarto");

    this.enabled_ = config.get("cells.background.enabled", true);
    this.delayMs_ = config.get("cells.background.delay", 200);

    if (this.backgroundDecoration_) {
      this.backgroundDecoration_.dispose();
    }
    this.backgroundDecoration_ = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      light: {
        backgroundColor: config.get("cells.background.light", "#DCDCDC66"),
      },
      dark: {
        backgroundColor: config.get("cells.background.dark", "#0A0A0A66"),
      },
    });
  }

  private enabled_ = true;
  private backgroundDecoration_: vscode.TextEditorDecorationType | undefined;
  private delayMs_ = 200;
}

const highlightingConfig = new HiglightingConfig();

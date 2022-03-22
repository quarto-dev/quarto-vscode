/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tmp from "tmp";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

import {
  commands,
  Terminal,
  TerminalOptions,
  TextDocument,
  ViewColumn,
  window,
} from "vscode";
import { hasFileScheme } from "../../core/schemes";
import { QuartoContext } from "../../core/quarto";
import { shQuote } from "../../core/strings";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";

// TODO: Simple Browser .Aside ends up being somewhat unstable w/ other windows
//       Do we need to consider a 'Quarto Preview' fork for better control
//       over the preview window
// TODO: image being removed from disk causes reload
// TODO: discover project context for .qmd files
// TODO: support for ipynb files
// TODO: progress within preview window (don't showTerminal after that)

let previewManager: PreviewManager;

export function activatePreview(quartoContext: QuartoContext): Command[] {
  previewManager = new PreviewManager(quartoContext);
  return previewCommands();
}

export function previewDoc(doc: TextDocument) {
  if (hasFileScheme(doc)) {
    previewManager.preview(doc);
  } else {
    window.showErrorMessage("Unable to preview non-filesystem documents");
  }
}

class PreviewManager {
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
  }

  public preview(doc: TextDocument) {
    if (this.canReuseRunningPreview(doc)) {
      // perform the render
      http.get(this.serverUrl_ + "quarto-render/");
      // show the terminal and preview browser
      this.terminal_!.show(true);
      this.showPreviewBrowser();
    } else {
      // start a new preview
      this.startPreview(doc);
    }
  }

  private canReuseRunningPreview(doc: TextDocument) {
    return (
      this.scope_ === doc.uri.fsPath &&
      this.serverUrl_ &&
      this.terminal_ &&
      this.terminal_.exitStatus === undefined
    );
  }

  private startPreview(doc: TextDocument) {
    // dispose any existing preview terminals
    const kPreviewWindowTitle = "Quarto Preview";
    const terminal = window.terminals.find((terminal) => {
      return terminal.name === kPreviewWindowTitle;
    });
    if (terminal) {
      terminal.dispose();
    }

    // cleanup output
    this.outputSink_.reset();

    // reset scope and server url (used to detect re-use of existing terminal)
    this.scope_ = doc.uri.fsPath;
    this.serverUrl_ = undefined;

    // create and show the terminal
    const options: TerminalOptions = {
      name: kPreviewWindowTitle,
      cwd: path.dirname(doc.uri.fsPath),
    };
    this.terminal_ = window.createTerminal(options);
    const quarto = path.join(this.quartoContext_.binPath, "quarto");
    const cmd =
      shQuote(quarto) +
      " preview " +
      shQuote(path.basename(doc.uri.fsPath)) +
      " --no-browser" +
      " --no-watch-inputs" +
      " --log " +
      shQuote(this.outputSink_.outputFile());
    this.terminal_.sendText(cmd, true);
    this.terminal_.show(true);
  }

  private onPreviewOutput(output: string) {
    // detect preview and show in browser
    if (!this.serverUrl_) {
      const match = output.match(/Browse at (http:\/\/localhost\:\d+\/)/);
      if (match) {
        this.serverUrl_ = match[1];
        this.showPreviewBrowser();
      }
    }
  }

  private showPreviewBrowser() {
    commands.executeCommand("simpleBrowser.api.open", this.serverUrl_, {
      preserveFocus: true,
      viewColumn: ViewColumn.Beside,
    });
  }

  private scope_: string | undefined;
  private serverUrl_: string | undefined;
  private terminal_: Terminal | undefined;

  private readonly quartoContext_: QuartoContext;
  private readonly outputSink_: PreviewOutputSink;
}

class PreviewOutputSink {
  constructor(handler: (output: string) => void) {
    // allocate a directory for preview output
    tmp.setGracefulCleanup();
    const previewDir = tmp.dirSync({ prefix: "quarto-preview" });
    this.outputFile_ = path.join(previewDir.name, "preview.log");

    // watch for changes
    setInterval(() => {
      const lastModified = fs.existsSync(this.outputFile_)
        ? fs.statSync(this.outputFile_).mtimeMs
        : 0;
      if (lastModified > this.lastModified_) {
        this.lastModified_ = lastModified;
        handler(fs.readFileSync(this.outputFile_, { encoding: "utf-8" }));
      }
    }, 200);
  }

  public outputFile() {
    return this.outputFile_;
  }

  public reset() {
    try {
      if (fs.existsSync(this.outputFile_)) {
        fs.unlinkSync(this.outputFile_);
      }
    } catch (e) {
    } finally {
      this.lastModified_ = 0;
    }
  }

  private readonly outputFile_: string;
  private lastModified_ = 0;
}

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
import { Schemes } from "../../core/schemes";
import { QuartoContext } from "../../core/quarto";
import { shQuote } from "../../core/strings";

export function terminalInitialize(quartoContext: QuartoContext) {
  terminalManager.init(quartoContext);
}

export function terminalPreview(doc: TextDocument) {
  if (doc.uri.scheme === Schemes.file.slice(0, Schemes.file.length - 1)) {
    terminalManager.preview(doc);
  } else {
    window.showErrorMessage("Unable to preview non-filesystem documents");
  }
}

class PreviewTerminalManager {
  public init(quartoContext: QuartoContext) {
    // record context
    this.quartoContext_ = quartoContext;
    // allocate a directory for preview output
    tmp.setGracefulCleanup();
    const previewDir = tmp.dirSync({ prefix: "quarto-preview" });
    const kPreviewLog = "preview.log";
    this.previewOutputFile_ = path.join(previewDir.name, kPreviewLog);
    this.resetPreviewOutput();

    // watch for changes
    setInterval(() => {
      const previewOutputFileLastModified =
        this.previewOutputFile_ && fs.existsSync(this.previewOutputFile_)
          ? fs.statSync(this.previewOutputFile_).mtimeMs
          : 0;
      if (previewOutputFileLastModified > this.previewOutputFileLastModified_) {
        this.previewOutputFileLastModified_ = previewOutputFileLastModified;
        this.onPreviewOutput(
          fs.readFileSync(this.previewOutputFile_!, { encoding: "utf-8" })
        );
      }
    }, 200);
  }

  public preview(doc: TextDocument) {
    // if we have an existing terminal for this doc then re-use it if we can
    if (
      this.terminal_ &&
      this.terminal_.exitStatus === undefined &&
      this.previewBrowserUrl_ &&
      this.scope_ === doc.uri.fsPath
    ) {
      this.terminal_.show();
      http.get(this.previewBrowserUrl_);
      this.showPreview();
      return;
    }

    // reset output
    this.resetPreviewOutput();

    // kill any existing terminal
    if (this.terminal_) {
      this.terminal_.dispose();
      this.terminal_ = undefined;
      this.scope_ = undefined;
    }

    // re-use any other quarto preview terminal
    const kTerminalName = "Quarto Preview";
    const terminal = window.terminals.find((terminal) => {
      return terminal.name === kTerminalName;
    });
    if (terminal) {
      terminal.dispose();
    }

    const docPath = doc.uri.fsPath;
    const options: TerminalOptions = {
      name: kTerminalName,
      cwd: path.dirname(docPath),
    };
    this.terminal_ = window.createTerminal(options);
    this.terminal_.show(true);
    const quarto = path.join(this.quartoContext_!.binPath, "quarto");
    const cmd =
      shQuote(quarto) +
      " preview " +
      shQuote(path.basename(docPath)) +
      " --no-browser" +
      " --log " +
      shQuote(this.previewOutputFile_!);
    this.terminal_.sendText(cmd, true);
    this.scope_ = docPath;
  }

  private onPreviewOutput(output: string) {
    if (!this.previewBrowserUrl_) {
      const match = output.match(/Browse at (http:\/\/localhost\:\d+\/)/);
      if (match) {
        this.previewBrowserUrl_ = match[1];
        this.showPreview();
      }
    }
  }

  private showPreview() {
    commands.executeCommand("simpleBrowser.api.open", this.previewBrowserUrl_, {
      preserveFocus: true,
      viewColumn: ViewColumn.Beside,
    });
  }

  private resetPreviewOutput() {
    try {
      if (this.previewOutputFile_ && fs.existsSync(this.previewOutputFile_)) {
        fs.unlinkSync(this.previewOutputFile_!);
      }
    } catch (e) {
    } finally {
      this.previewBrowserUrl_ = undefined;
      this.previewOutputFileLastModified_ = 0;
    }
  }

  private quartoContext_: QuartoContext | undefined;
  private previewOutputFileLastModified_ = 0;
  private previewBrowserUrl_: string | undefined;
  private previewOutputFile_: string | undefined;
  private terminal_: Terminal | undefined;
  private scope_: string | undefined;
}

const terminalManager = new PreviewTerminalManager();

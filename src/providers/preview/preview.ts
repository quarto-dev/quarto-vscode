/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tmp from "tmp";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";

import {
  commands,
  Terminal,
  TerminalOptions,
  TextDocument,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import { QuartoContext } from "../../core/quarto";
import { shQuote } from "../../core/strings";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import { isNotebook, isQuartoDoc } from "../../core/doc";

// TODO: Simple Browser .Aside ends up being somewhat unstable w/ other windows
//       Do we need to consider a 'Quarto Preview' fork for better control
//       over the preview window
//       activate on in place render (add after http call for re-render)
//       url doesn't change on reload!

// TODO: progress within preview window (don't showTerminal after that)

// TODO: client sends format and that is respected by startup and by in-place
//       (including no format / default format -- some sniffing)
// TODO: update required CLI version in preview command once this lands

let previewManager: PreviewManager;

export function activatePreview(quartoContext: QuartoContext): Command[] {
  previewManager = new PreviewManager(quartoContext);
  return previewCommands(quartoContext);
}

export function canPreviewDoc(doc: TextDocument) {
  return isQuartoDoc(doc) || isNotebook(doc);
}

export async function previewDoc(doc: TextDocument) {
  await commands.executeCommand("workbench.action.files.save");
  await previewManager.preview(doc);
}

class PreviewManager {
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
  }

  public async preview(doc: TextDocument) {
    if (this.canReuseRunningPreview(doc)) {
      if (isQuartoDoc(doc)) {
        const previewUri = Uri.parse(this.previewUrl_!);
        try {
          const requestUri =
            previewUri.scheme +
            "://" +
            previewUri.authority +
            "/B4AA6EED-A702-4ED2-9734-A20C6FDC4071" +
            doc.uri.fsPath;
          const response = await axios.get(requestUri);
          if (response.status === 200) {
            this.terminal_!.show(true);
          } else {
            this.startPreview(doc);
          }
        } catch (e) {
          this.startPreview(doc);
        }
      } else if (isNotebook(doc)) {
        this.showPreviewBrowser();
      }
    } else {
      this.startPreview(doc);
    }
  }

  private canReuseRunningPreview(doc: TextDocument) {
    return (
      (isQuartoDoc(doc) ||
        (isNotebook(doc) && this.scope_ === doc.uri.fsPath)) &&
      this.previewUrl_ &&
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
    this.previewUrl_ = undefined;

    // create and show the terminal
    const options: TerminalOptions = {
      name: kPreviewWindowTitle,
      cwd: path.dirname(doc.uri.fsPath),
    };
    this.terminal_ = window.createTerminal(options);
    const quarto = path.join(this.quartoContext_.binPath, "quarto");
    const cmd: string[] = [
      shQuote(quarto),
      "preview",
      shQuote(path.basename(doc.uri.fsPath)),
      "--no-browser",
      "--log",
      shQuote(this.outputSink_.outputFile()),
    ];
    if (isQuartoDoc(doc)) {
      cmd.push("--no-watch-inputs");
    }
    this.terminal_.sendText(cmd.join(" "), true);
    this.terminal_.show(true);
  }

  private onPreviewOutput(output: string) {
    // detect preview and show in browser
    if (!this.previewUrl_) {
      const match = output.match(/Browse at (http:\/\/localhost\:\d+\/[^\s]*)/);
      if (match) {
        this.previewUrl_ = match[1];
        this.showPreviewBrowser();
      }
    }
  }

  private showPreviewBrowser() {
    commands.executeCommand("simpleBrowser.api.open", this.previewUrl_, {
      preserveFocus: true,
      viewColumn: ViewColumn.Beside,
    });
  }

  private scope_: string | undefined;
  private previewUrl_: string | undefined;
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

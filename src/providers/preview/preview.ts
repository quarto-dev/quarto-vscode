/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tmp from "tmp";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
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

// TODO: test on windows

// TODO: use quarto context on server, create pref for context, detect rstudio (createStatusBarItem)

// TODO: render project and preview project commands (in place render w/ those)

let previewManager: PreviewManager;

export function activatePreview(quartoContext: QuartoContext): Command[] {
  previewManager = new PreviewManager(quartoContext);
  return previewCommands(quartoContext);
}

export function canPreviewDoc(doc: TextDocument) {
  return isQuartoDoc(doc) || isNotebook(doc);
}

export async function previewDoc(doc: TextDocument, format?: string) {
  await commands.executeCommand("workbench.action.files.save");
  doc = window.activeTextEditor?.document || doc;
  await previewManager.preview(doc, format);
}

class PreviewManager {
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
  }

  public async preview(doc: TextDocument, format?: string) {
    if (this.canReuseRunningPreview()) {
      try {
        const response = await this.previewRenderRequest(doc, format);
        if (response.status === 200) {
          this.terminal_!.show(true);
        } else {
          this.startPreview(doc, format);
        }
      } catch (e) {
        this.startPreview(doc, format);
      }
    } else {
      this.startPreview(doc, format);
    }
  }

  private canReuseRunningPreview() {
    return (
      this.previewUrl_ &&
      this.terminal_ &&
      this.terminal_.exitStatus === undefined
    );
  }

  private previewRenderRequest(doc: TextDocument, format?: string) {
    const previewUri = Uri.parse(this.previewUrl_!);

    const requestUri =
      previewUri.scheme +
      "://" +
      previewUri.authority +
      "/B4AA6EED-A702-4ED2-9734-A20C6FDC4071";
    const params: Record<string, unknown> = {
      path: doc.uri.fsPath,
    };
    if (format) {
      params.format = format;
    }
    return axios.get(requestUri, { params });
  }

  private startPreview(doc: TextDocument, format?: string) {
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

    // reset server url (used to detect re-use of existing terminal)
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
    ];
    if (format) {
      cmd.push("--to", format);
    }
    cmd.push("--no-browser");
    cmd.push("--no-watch-inputs");
    cmd.push("--log", shQuote(this.outputSink_.outputFile()));
    const cmdText =
      os.platform() === "win32" ? `cmd /C"${cmd.join(" ")}"` : cmd.join(" ");
    this.terminal_.sendText(cmdText, true);
    this.terminal_.show(true);
  }

  private onPreviewOutput(output: string) {
    // detect preview and show in browser
    if (!this.previewUrl_) {
      const match = output.match(/Browse at (http:\/\/localhost\:\d+\/[^\s]*)/);
      if (match) {
        this.previewUrl_ = match[1];
        commands.executeCommand("simpleBrowser.api.open", this.previewUrl_, {
          preserveFocus: true,
          viewColumn: ViewColumn.Beside,
        });
      }
    }
  }

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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as os from "os";
import axios from "axios";

import {
  commands,
  ExtensionContext,
  Terminal,
  TerminalOptions,
  TextDocument,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import { QuartoContext } from "../../shared/quarto";
import { shQuote } from "../../core/strings";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import { isNotebook, isQuartoDoc } from "../../core/doc";
import { PreviewWebviewManager } from "./preview-webview";
import { PreviewOutputSink } from "./preview-output";

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext
): Command[] {
  // create preview manager
  previewManager = new PreviewManager(context, quartoContext);
  context.subscriptions.push(previewManager);

  // preview commands
  return previewCommands(quartoContext);
}

export function canPreviewDoc(doc: TextDocument) {
  return isQuartoDoc(doc) || isNotebook(doc);
}

export async function previewDoc(doc: TextDocument, format?: string) {
  // save document
  await doc.save();
  // extra save sometimes required for notbooks
  await commands.executeCommand("workbench.action.files.save");
  // if we saved an untitled file we now need to get the path
  doc = window.activeTextEditor?.document || doc;
  await previewManager.preview(doc, format);
}

class PreviewManager {
  constructor(
    context: ExtensionContext,
    private readonly quartoContext_: QuartoContext
  ) {
    this.webviewManager_ = new PreviewWebviewManager(context);
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
  }

  dispose() {
    this.webviewManager_.dispose();
    this.outputSink_.dispose();
  }

  public async preview(doc: TextDocument, format?: string) {
    this.previewOutput_ = "";
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
    this.previewOutput_ += output;
    if (!this.previewUrl_) {
      // detect new preview and show in browser
      const match = this.previewOutput_.match(
        /Browse at (http:\/\/localhost\:\d+\/[^\s]*)/
      );
      if (match) {
        this.previewUrl_ = match[1];
        this.webviewManager_.showWebview(this.previewUrl_, {
          preserveFocus: true,
          viewColumn: ViewColumn.Beside,
        });
      }
    } else {
      // detect update to existing preview and activate browser
      if (
        this.previewOutput_.trimEnd().endsWith("Watching files for changes")
      ) {
        this.webviewManager_.revealWebview();
      }
    }
  }

  private previewOutput_ = "";
  private previewUrl_: string | undefined;
  private terminal_: Terminal | undefined;

  private readonly webviewManager_: PreviewWebviewManager;
  private readonly outputSink_: PreviewOutputSink;
}

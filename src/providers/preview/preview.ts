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
  workspace,
} from "vscode";
import { QuartoContext } from "../../shared/quarto";
import { shQuote } from "../../core/strings";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import { isNotebook, isQuartoDoc } from "../../core/doc";
import { PreviewWebviewManager } from "./preview-webview";
import { PreviewOutputSink } from "./preview-output";
import { isHtmlContent, isPdfContent } from "../../core/mime";

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

    // reset preview state
    this.previewDoc_ = doc.uri;
    this.previewUrl_ = undefined;
    this.previewOutputFile_ = undefined;

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
        // capture output file
        const fileMatch = this.previewOutput_.match(/Output created\: (.*?)\n/);
        if (fileMatch) {
          this.previewUrl_ = match[1];
          this.previewOutputFile_ = this.outputFileUri(fileMatch[1]);
          this.showPreview();
        } else {
          console.log("Matched browse at without output created");
        }
      }
    } else {
      // detect update to existing preview and activate browser
      if (
        this.previewOutput_.trimEnd().endsWith("Watching files for changes")
      ) {
        this.updatePreview();
      }
    }
  }

  private showPreview() {
    if (this.isBrowserPreviewable(this.previewOutputFile_)) {
      this.webviewManager_.showWebview(this.previewUrl_!, {
        preserveFocus: true,
        viewColumn: ViewColumn.Beside,
      });
    } else {
      this.showOuputFile();
    }
  }

  private updatePreview() {
    if (this.isBrowserPreviewable(this.previewOutputFile_)) {
      this.webviewManager_.revealWebview();
    } else {
      this.showOuputFile();
    }
  }

  private outputFileUri(file: string) {
    if (path.isAbsolute(file)) {
      return Uri.file(file);
    } else {
      return Uri.file(path.join(path.dirname(this.previewDoc_?.fsPath!), file));
    }
  }

  private isBrowserPreviewable(uri?: Uri) {
    return isHtmlContent(uri?.toString()) || isPdfContent(uri?.toString());
  }

  private async showOuputFile() {
    // TODO: full restart happening every time
    // TODO: activate existing
    // TODO: readonly?
    // TODO: consider rendered html for markdown?
    // TODO: open non text files
    await commands.executeCommand(
      "vscode.open",
      this.previewOutputFile_!.with({ fragment: "" }),
      ViewColumn.Beside
    );
  }

  private previewOutput_ = "";
  private previewDoc_: Uri | undefined;
  private previewUrl_: string | undefined;
  private previewOutputFile_: Uri | undefined;

  private terminal_: Terminal | undefined;

  private readonly webviewManager_: PreviewWebviewManager;
  private readonly outputSink_: PreviewOutputSink;
}

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
  ExtensionContext,
  Terminal,
  TerminalOptions,
  TextDocument,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
} from "vscode";
import { QuartoContext } from "../../core/quarto";
import { shQuote } from "../../core/strings";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import { isNotebook, isQuartoDoc } from "../../core/doc";
import { QuartoPreviewView, ShowOptions } from "./preview-webview";

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext
): Command[] {
  // create preview manager
  previewManager = new PreviewManager(context.extensionUri, quartoContext);
  context.subscriptions.push(previewManager);

  context.subscriptions.push(
    window.registerWebviewPanelSerializer(QuartoPreviewView.viewType, {
      deserializeWebviewPanel: async (panel, state) => {
        previewManager.restoreWebvew(panel, state);
      },
    })
  );

  // preview commands
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
  constructor(
    private readonly extensionUri_: Uri,
    private readonly quartoContext_: QuartoContext
  ) {
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
  }

  dispose() {
    this.activeView_?.dispose();
    this.activeView_ = undefined;
  }

  public async preview(doc: TextDocument, format?: string) {
    if (this.canReuseRunningPreview()) {
      try {
        const response = await this.previewRenderRequest(doc, format);
        if (response.status === 200) {
          this.terminal_!.show(true);
          this.revealWebview();
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

  public restoreWebvew(panel: WebviewPanel, state: any): void {
    const url = state?.url ?? "";
    const view = QuartoPreviewView.restore(this.extensionUri_, url, panel);
    this.registerWebviewListeners(view);
    return;
  }

  private showWebview(url: string, options?: ShowOptions): void {
    if (this.activeView_) {
      this.activeView_.show(url, options);
    } else {
      const view = QuartoPreviewView.create(this.extensionUri_, url, options);
      this.registerWebviewListeners(view);
      this.activeView_ = view;
    }
  }

  private revealWebview() {
    if (this.activeView_) {
      this.activeView_.reveal();
    }
  }

  private registerWebviewListeners(view: QuartoPreviewView) {
    view.onDispose(() => {
      if (this.activeView_ === view) {
        this.activeView_ = undefined;
      }
    });
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
        this.showWebview(this.previewUrl_, {
          preserveFocus: true,
          viewColumn: ViewColumn.Beside,
        });
      }
    }
  }

  private previewUrl_: string | undefined;
  private terminal_: Terminal | undefined;
  private activeView_?: QuartoPreviewView;

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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as uuid from "uuid";
import axios from "axios";

import vscode, {
  commands,
  ExtensionContext,
  MessageItem,
  Terminal,
  TerminalOptions,
  TextDocument,
  TextEditor,
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
import { isHtmlContent, isTextContent, isPdfContent } from "../../core/mime";

import * as tmp from "tmp";
import { PreviewEnv, PreviewEnvManager, previewEnvsEqual } from "./preview-env";
import { MarkdownEngine } from "../../markdown/engine";
tmp.setGracefulCleanup();

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  // create preview manager
  previewManager = new PreviewManager(context, quartoContext, engine);
  context.subscriptions.push(previewManager);

  // preview commands
  return previewCommands(quartoContext);
}

export function canPreviewDoc(doc: TextDocument) {
  return !!(isQuartoDoc(doc) || isNotebook(doc));
}

export async function previewDoc(editor: TextEditor, format?: string) {
  // save document
  let doc = editor.document;
  await doc.save();

  // extra save sometimes required for notbooks
  if (doc.uri === window.activeTextEditor?.document.uri) {
    await commands.executeCommand("workbench.action.files.save");
    // if we saved an untitled file we now need to get the path
    doc = window.activeTextEditor?.document || doc;
  }
  // execute the preview
  await previewManager.preview(doc.uri, doc, format);

  // focus the editor (sometimes the terminal takes focus on launch)
  await window.showTextDocument(doc, editor.viewColumn, false);
}

export async function previewProject(target: Uri, format?: string) {
  await previewManager.preview(target, undefined, format);
}

class PreviewManager {
  constructor(
    context: ExtensionContext,
    private readonly quartoContext_: QuartoContext,
    engine: MarkdownEngine
  ) {
    this.renderToken_ = uuid.v4();
    this.webviewManager_ = new PreviewWebviewManager(context);
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
    this.previewEnvManager_ = new PreviewEnvManager(
      this.outputSink_,
      this.renderToken_,
      engine
    );
  }

  dispose() {
    this.webviewManager_.dispose();
    this.outputSink_.dispose();
  }

  public async preview(uri: Uri, doc?: TextDocument, format?: string) {
    this.previewOutput_ = "";
    const prevewEnv = await this.previewEnvManager_.previewEnv(uri, doc);
    if (doc && this.canReuseRunningPreview(prevewEnv)) {
      try {
        const response = await this.previewRenderRequest(doc, format);
        if (response.status === 200) {
          this.terminal_!.show(true);
        } else {
          this.startPreview(prevewEnv, uri, doc, format);
        }
      } catch (e) {
        this.startPreview(prevewEnv, uri, doc, format);
      }
    } else {
      this.startPreview(prevewEnv, uri, doc, format);
    }
  }

  private canReuseRunningPreview(previewEnv: PreviewEnv) {
    return (
      this.previewUrl_ &&
      previewEnvsEqual(this.previewEnv_, previewEnv) &&
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
      "/" +
      this.renderToken_;
    const params: Record<string, unknown> = {
      path: doc.uri.fsPath,
    };
    if (format) {
      params.format = format;
    }
    return axios.get(requestUri, { params });
  }

  private startPreview(
    previewEnv: PreviewEnv,
    target: Uri,
    doc?: TextDocument,
    format?: string
  ) {
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
    this.previewEnv_ = previewEnv;
    this.previewTarget_ = target;
    this.previewUrl_ = undefined;
    this.previewOutputFile_ = undefined;

    // create and show the terminal
    const options: TerminalOptions = {
      name: kPreviewWindowTitle,
      cwd: this.targetDir(),
      env: this.previewEnv_ as unknown as {
        [key: string]: string | null | undefined;
      },
    };
    this.terminal_ = window.createTerminal(options);
    const quarto = path.join(this.quartoContext_.binPath, "quarto");
    const cmd: string[] = [
      shQuote(quarto),
      "preview",
      shQuote(this.targetFile()),
    ];
    if (!doc) {
      // project render
      cmd.push("--render", format || "all");
    } else if (format) {
      // doc render
      cmd.push("--to", format);
    }

    cmd.push("--no-browser");
    cmd.push("--no-watch-inputs");
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
        // capture output file
        const fileMatch = this.previewOutput_.match(/Output created\: (.*?)\n/);
        if (fileMatch) {
          this.previewOutputFile_ = this.outputFileUri(fileMatch[1]);
        }
        this.showPreview();
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
    if (
      !this.previewOutputFile_ || // no output file means project render/preview
      this.isBrowserPreviewable(this.previewOutputFile_)
    ) {
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

  private targetDir() {
    const targetPath = this.previewTarget_!.fsPath;
    if (fs.statSync(targetPath).isDirectory()) {
      return targetPath;
    } else {
      return path.dirname(targetPath);
    }
  }

  private targetFile() {
    const targetPath = this.previewTarget_!.fsPath;
    if (fs.statSync(targetPath).isDirectory()) {
      return ".";
    } else {
      return path.basename(targetPath);
    }
  }

  private outputFileUri(file: string) {
    if (path.isAbsolute(file)) {
      return Uri.file(file);
    } else {
      return Uri.file(path.join(this.targetDir()!, file));
    }
  }

  private isBrowserPreviewable(uri?: Uri) {
    return (
      isHtmlContent(uri?.toString()) ||
      isPdfContent(uri?.toString()) ||
      isTextContent(uri?.toString())
    );
  }

  private async showOuputFile() {
    if (this.previewOutputFile_) {
      const outputFile = this.previewOutputFile_.fsPath;
      const viewFile: MessageItem = { title: "View Preview" };
      const result = await window.showInformationMessage<MessageItem>(
        "Render complete for " + path.basename(outputFile),
        viewFile
      );
      if (result === viewFile) {
        const outputTempDir = tmp.dirSync();
        const outputTemp = path.join(
          outputTempDir.name,
          path.basename(outputFile)
        );
        fs.copyFileSync(outputFile, outputTemp);
        fs.chmodSync(outputTemp, fs.constants.S_IRUSR);
        vscode.env.openExternal(Uri.file(outputTemp));
      }
    }
  }

  private previewOutput_ = "";
  private previewEnv_: PreviewEnv | undefined;
  private previewTarget_: Uri | undefined;
  private previewUrl_: string | undefined;
  private previewOutputFile_: Uri | undefined;

  private terminal_: Terminal | undefined;

  private readonly renderToken_: string;
  private readonly previewEnvManager_: PreviewEnvManager;
  private readonly webviewManager_: PreviewWebviewManager;
  private readonly outputSink_: PreviewOutputSink;
}

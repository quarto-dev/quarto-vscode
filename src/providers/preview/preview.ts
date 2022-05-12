/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";
import * as uuid from "uuid";
import * as os from "os";
import axios from "axios";

import vscode, {
  commands,
  env,
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
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import {
  isNotebook,
  isQuartoDoc,
  validatateQuartoExtension,
} from "../../core/doc";
import { PreviewOutputSink } from "./preview-output";
import { isHtmlContent, isTextContent, isPdfContent } from "../../core/mime";

import * as tmp from "tmp";
import { PreviewEnv, PreviewEnvManager, previewEnvsEqual } from "./preview-env";
import { isHugoMarkdown } from "../../core/hugo";
import { MarkdownEngine } from "../../markdown/engine";
import { shQuote } from "../../core/strings";
import {
  QuartoPreviewWebview,
  QuartoPreviewWebviewManager,
} from "./preview-webview";
import { projectDirForDocument } from "./preview-util";
tmp.setGracefulCleanup();

const kLocalPreviewRegex = /(http:\/\/localhost\:\d+\/[^\s]*)/;

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  // create preview manager
  if (quartoContext.available) {
    previewManager = new PreviewManager(context, quartoContext);
    context.subscriptions.push(previewManager);
  }

  // preview commands
  return previewCommands(quartoContext, engine);
}

export function canPreviewDoc(doc?: TextDocument) {
  return !!doc && !!(isQuartoDoc(doc) || isNotebook(doc));
}

export async function previewDoc(
  editor: TextEditor,
  format?: string | null,
  slideIndex?: number,
  onShow?: () => void
) {
  // set the slide index and onShow if its provided
  if (slideIndex !== undefined) {
    previewManager.setSlideIndex(slideIndex);
  }
  if (onShow !== undefined) {
    previewManager.setOnShow(onShow);
  }

  // activate the editor
  if (!isNotebook(editor.document)) {
    await window.showTextDocument(editor.document, editor.viewColumn, false);
  }

  // save (exit if we cancelled)
  await commands.executeCommand("workbench.action.files.save");
  if (editor.document.isDirty) {
    return;
  }

  // execute the preview
  const doc = window.activeTextEditor?.document;
  if (doc) {
    // error if we didn't save using a valid quarto extension
    if (!isNotebook(doc) && !validatateQuartoExtension(doc)) {
      window.showErrorMessage("Unsupported File Extension", {
        modal: true,
        detail:
          "This document cannot be rendered because it doesn't have a supported Quarto file extension. " +
          "Save the file with a .qmd extension then try rendering again.",
      });
      return;
    }

    // run the preview
    await previewManager.preview(doc.uri, doc, format);

    // focus the editor (sometimes the terminal steals focus)
    if (!isNotebook(doc)) {
      await window.showTextDocument(doc, editor.viewColumn, false);
    }
  }
}

export async function previewProject(target: Uri, format?: string) {
  await previewManager.preview(target, undefined, format);
}

class PreviewManager {
  constructor(
    context: ExtensionContext,
    private readonly quartoContext_: QuartoContext
  ) {
    this.renderToken_ = uuid.v4();
    this.webviewManager_ = new QuartoPreviewWebviewManager(
      context,
      "quarto.previewView",
      "Quarto Preview",
      QuartoPreviewWebview
    );
    this.outputSink_ = new PreviewOutputSink(this.onPreviewOutput.bind(this));
    this.previewEnvManager_ = new PreviewEnvManager(
      this.outputSink_,
      this.renderToken_
    );
  }

  dispose() {
    this.webviewManager_.dispose();
    this.outputSink_.dispose();
  }

  public async preview(uri: Uri, doc?: TextDocument, format?: string | null) {
    // resolve format if we need to
    if (format === undefined) {
      format = this.previewFormats_.get(uri.fsPath) || null;
    } else {
      this.previewFormats_.set(uri.fsPath, format);
    }

    this.previewOutput_ = "";
    const prevewEnv = await this.previewEnvManager_.previewEnv(uri);
    if (doc && this.canReuseRunningPreview(prevewEnv)) {
      try {
        const response = await this.previewRenderRequest(doc, format);
        if (response.status === 200) {
          this.terminal_!.show(true);
        } else {
          await this.startPreview(prevewEnv, uri, format, doc);
        }
      } catch (e) {
        await this.startPreview(prevewEnv, uri, format, doc);
      }
    } else {
      await this.startPreview(prevewEnv, uri, format, doc);
    }
  }

  public setSlideIndex(slideIndex: number) {
    this.webviewManager_.setSlideIndex(slideIndex);
  }

  public setOnShow(f: () => void) {
    this.webviewManager_.setOnShow(f);
  }

  private canReuseRunningPreview(previewEnv: PreviewEnv) {
    return (
      this.previewUrl_ &&
      previewEnvsEqual(this.previewEnv_, previewEnv) &&
      this.previewType_ === this.previewTypeConfig() &&
      (this.previewType_ !== "internal" || this.webviewManager_.hasWebview()) &&
      this.terminal_ &&
      this.terminal_.exitStatus === undefined
    );
  }

  private previewRenderRequest(doc: TextDocument, format: string | null) {
    const requestUri = this.previewServerRequestUri("/" + this.renderToken_);

    const params: Record<string, unknown> = {
      path: doc.uri.fsPath,
    };
    if (format) {
      params.format = format;
    }
    return axios.get(requestUri, { params });
  }

  private async previewTerminateRequest() {
    const kTerminateToken = "4231F431-58D3-4320-9713-994558E4CC45";
    try {
      await axios.get(this.previewServerRequestUri("/" + kTerminateToken), {
        timeout: 1000,
      });
    } catch (error) {
      /*
      console.log("Error requesting preview server termination");
      console.log(error);
      */
    }
  }

  private previewServerRequestUri(path: string) {
    const previewUri = Uri.parse(this.previewCommandUrl_!);
    const requestUri = previewUri.scheme + "://" + previewUri.authority + path;
    return requestUri;
  }

  private async startPreview(
    previewEnv: PreviewEnv,
    target: Uri,
    format: string | null,
    doc?: TextDocument
  ) {
    // dispose any existing preview terminals
    const kPreviewWindowTitle = "Quarto Preview";
    const terminal = window.terminals.find((terminal) => {
      return terminal.name === kPreviewWindowTitle;
    });
    if (terminal) {
      await this.previewTerminateRequest();
      terminal.dispose();
    }

    // cleanup output
    this.outputSink_.reset();

    // reset preview state
    this.previewEnv_ = previewEnv;
    this.previewTarget_ = target;
    this.previewType_ = this.previewTypeConfig();
    this.previewUrl_ = undefined;
    this.previewCommandUrl_ = undefined;
    this.previewOutputFile_ = undefined;

    // determine project dir (if any)
    const projectDir = fs.statSync(target.fsPath).isFile()
      ? projectDirForDocument(target)
      : undefined;
    const targetFile = projectDir
      ? path.relative(projectDir, target.fsPath)
      : this.targetFile();

    // create and show the terminal
    const options: TerminalOptions = {
      name: kPreviewWindowTitle,
      cwd: projectDir || this.targetDir(),
      env: this.previewEnv_ as unknown as {
        [key: string]: string | null | undefined;
      },
    };
    this.terminal_ = window.createTerminal(options);
    const quarto = path.join(this.quartoContext_.binPath, "quarto");
    const cmd: string[] = [shQuote(quarto), "preview", shQuote(targetFile)];
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
    const kOutputCreatedPattern = /Output created\: (.*?)\n/;
    this.previewOutput_ += output;
    if (!this.previewUrl_) {
      // detect new preview and show in browser
      const match = this.previewOutput_.match(kLocalPreviewRegex);
      if (match) {
        // capture output file
        const fileMatch = this.previewOutput_.match(kOutputCreatedPattern);
        if (fileMatch) {
          this.previewOutputFile_ = this.outputFileUri(fileMatch[1]);
        }

        // capture preview command url and preview url
        this.previewCommandUrl_ = match[1];
        const browseMatch = this.previewOutput_.match(
          /Browse at (https?:\/\/[^\s]*)/
        );
        if (browseMatch) {
          this.previewUrl_ = browseMatch[1];
        } else {
          this.previewUrl_ = this.previewCommandUrl_;
        }

        if (this.previewType_ === "internal") {
          this.showPreview();
        } else if (this.previewType_ === "external") {
          try {
            const url = Uri.parse(this.previewUrl_);
            env.openExternal(url);
          } catch {
            // Noop
          }
        }
      }
    } else {
      // detect update to existing preview and activate browser
      if (this.previewOutput_.match(kOutputCreatedPattern)) {
        if (this.previewType_ === "internal" && this.previewRevealConfig()) {
          this.updatePreview();
        }
      }
    }
  }

  private showPreview() {
    if (
      (!this.previewOutputFile_ || // no output file means project render/preview
        this.isBrowserPreviewable(this.previewOutputFile_)) &&
      !isHugoMarkdown(this.previewOutputFile_) // hugo preview done via 'hugo serve'
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

  private previewTypeConfig(): "internal" | "external" | "none" {
    return this.quartoConfig().get("render.previewType", "internal");
  }

  private previewRevealConfig(): boolean {
    return this.quartoConfig().get("render.previewReveal", true);
  }

  private quartoConfig() {
    return vscode.workspace.getConfiguration("quarto");
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
        // open non localhost urls externally
        if (this.previewUrl_ && !this.previewUrl_.match(kLocalPreviewRegex)) {
          vscode.env.openExternal(Uri.parse(this.previewUrl_!));
        } else {
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
  }

  private previewOutput_ = "";
  private previewEnv_: PreviewEnv | undefined;
  private previewTarget_: Uri | undefined;
  private previewUrl_: string | undefined;
  private previewCommandUrl_: string | undefined;
  private previewOutputFile_: Uri | undefined;
  private previewType_: "internal" | "external" | "none" | undefined;

  private terminal_: Terminal | undefined;

  private readonly renderToken_: string;
  private readonly previewEnvManager_: PreviewEnvManager;
  private readonly webviewManager_: QuartoPreviewWebviewManager;
  private readonly outputSink_: PreviewOutputSink;
  private readonly previewFormats_ = new Map<string, string | null>();
}

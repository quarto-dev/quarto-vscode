/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as uuid from "uuid";
import * as process from "process";
import stripAnsi from "strip-ansi";
import { spawn, ChildProcess, SpawnOptions } from "child_process";
import axios from "axios";

import vscode, {
  commands,
  env,
  ExtensionContext,
  MessageItem,
  OutputChannel,
  TextDocument,
  TextEditor,
  Uri,
  ViewColumn,
  window,
} from "vscode";
import { QuartoContext } from "../../shared/quarto";
import { previewCommands } from "./commands";
import { Command } from "../../core/command";
import { isNotebook, isQuartoDoc } from "../../core/doc";
import { PreviewWebviewManager } from "./preview-webview";
import { isHtmlContent, isTextContent, isPdfContent } from "../../core/mime";

import * as tmp from "tmp";
import { PreviewEnv, PreviewEnvManager, previewEnvsEqual } from "./preview-env";
import { isHugoMarkdown } from "../../core/hugo";
import { MarkdownEngine } from "../../markdown/engine";
tmp.setGracefulCleanup();

let previewManager: PreviewManager;

export function activatePreview(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  // create preview manager
  previewManager = new PreviewManager(context, quartoContext);
  context.subscriptions.push(previewManager);

  // preview commands
  return previewCommands(quartoContext, engine);
}

export function canPreviewDoc(doc: TextDocument) {
  return !!(isQuartoDoc(doc) || isNotebook(doc));
}

export async function previewDoc(
  editor: TextEditor,
  format?: string | null,
  slideIndex?: number
) {
  // set the slide index if its provided
  if (slideIndex !== undefined) {
    previewManager.setSlideIndex(slideIndex);
  }

  // save (exit if we cancelled)
  await commands.executeCommand("workbench.action.files.save");
  if (editor.document.isDirty) {
    return;
  }

  // execute the preview
  const doc = window.activeTextEditor?.document;
  if (doc) {
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
    this.webviewManager_ = new PreviewWebviewManager(context);
    this.previewEnvManager_ = new PreviewEnvManager(this.renderToken_);
    this.outputChannel_ = window.createOutputChannel("Quarto Preview");
  }

  dispose() {
    try {
      this.webviewManager_.dispose();
      this.outputChannel_.dispose();
      this.previewProcess_?.kill();
    } catch {}
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
          this.outputChannel_.clear();
          this.outputChannel_.show(true);
        } else {
          this.startPreview(prevewEnv, uri, format, doc);
        }
      } catch (e) {
        this.startPreview(prevewEnv, uri, format, doc);
      }
    } else {
      this.startPreview(prevewEnv, uri, format, doc);
    }
  }

  public setSlideIndex(slideIndex: number) {
    this.webviewManager_.setSlideIndex(slideIndex);
  }

  private canReuseRunningPreview(previewEnv: PreviewEnv) {
    return (
      this.previewUrl_ &&
      previewEnvsEqual(this.previewEnv_, previewEnv) &&
      this.previewType_ === this.previewTypeConfig() &&
      (this.previewType_ !== "internal" || this.webviewManager_.hasWebview()) &&
      this.previewProcess_ &&
      this.previewProcess_.exitCode === null
    );
  }

  private previewRenderRequest(doc: TextDocument, format: string | null) {
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
    format: string | null,
    doc?: TextDocument
  ) {
    // kill existing process
    if (this.previewProcess_) {
      if (this.previewProcess_.exitCode !== null) {
        this.previewProcess_.kill();
      }
      this.previewProcess_ = undefined;
    }

    // clear existing output
    this.outputChannel_.clear();

    // reset preview state
    this.previewEnv_ = previewEnv;
    this.previewTarget_ = target;
    this.previewType_ = this.previewTypeConfig();
    this.previewUrl_ = undefined;
    this.previewOutputFile_ = undefined;

    // create the preview process
    const quarto = path.join(this.quartoContext_.binPath, "quarto");
    const options: SpawnOptions = {
      cwd: this.targetDir(),
      env: {
        ...process.env,
        ...this.previewEnv_,
      },
      shell: os.platform() === "win32",
    };
    const cmd: string[] = ["preview", this.targetFile()];
    if (!doc) {
      // project render
      cmd.push("--render", format || "all");
    } else if (format) {
      // doc render
      cmd.push("--to", format);
    }
    cmd.push("--no-browser");
    cmd.push("--no-watch-inputs");
    this.outputChannel_.show(true);
    this.previewProcess_ = spawn(quarto, cmd, options);
    this.previewProcess_.stderr.setEncoding("UTF-8");
    this.previewProcess_.stderr.on("data", this.onPreviewOutput.bind(this));
  }

  private onPreviewOutput(output: string) {
    output = stripAnsi(output);
    this.outputChannel_.append(output);
    const kOutputCreatedPattern = /Output created\: (.*?)\n/;
    this.previewOutput_ += output;
    if (!this.previewUrl_) {
      // detect new preview and show in browser
      const match = this.previewOutput_.match(
        /Browse at (http:\/\/localhost\:\d+\/[^\s]*)/
      );
      if (match) {
        // capture output file
        const fileMatch = this.previewOutput_.match(kOutputCreatedPattern);
        if (fileMatch) {
          this.previewOutputFile_ = this.outputFileUri(fileMatch[1]);
        }

        // capture preview url and show preview
        this.previewUrl_ = match[1];
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
  private previewType_: "internal" | "external" | "none" | undefined;

  private previewProcess_: ChildProcess | undefined;
  private readonly outputChannel_: OutputChannel;

  private readonly renderToken_: string;
  private readonly previewEnvManager_: PreviewEnvManager;
  private readonly webviewManager_: PreviewWebviewManager;
  private readonly previewFormats_ = new Map<string, string | null>();
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";
import * as path from "path";
import * as fs from "fs";

import { TextDocument, window, Uri, workspace, commands } from "vscode";
import { Command } from "../../core/command";
import { QuartoContext } from "../../shared/quarto";
import { canPreviewDoc, previewDoc, previewProject } from "./preview";
import { MarkdownEngine } from "../../markdown/engine";
import { revealSlideIndex } from "./preview-reveal";
import { isNotebook } from "../../core/doc";
import { PreviewManager } from "./preview";

export function previewCommands(
  quartoContext: QuartoContext,
  previewManager: PreviewManager,
  engine: MarkdownEngine
): Command[] {
  return [
    new RenderDocumentCommand(quartoContext, engine),
    new RenderShortcutCommand(quartoContext, engine),
    new RenderDocumentHTMLCommand(quartoContext, engine),
    new RenderDocumentPDFCommand(quartoContext, engine),
    new RenderDocumentWordCommand(quartoContext, engine),
    new RenderProjectCommand(quartoContext),
    new TerminatePreviewCommand(previewManager),
    new WalkthroughRenderCommand(quartoContext, engine),
    new ClearCacheCommand(),
  ];
}

abstract class RenderCommand {
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
  }
  async execute() {
    const kRequiredVersion = "0.9.149";
    if (semver.gte(this.quartoContext_.version, kRequiredVersion)) {
      await this.doExecute();
    } else {
      window.showWarningMessage(
        `Rendering requires Quarto version ${kRequiredVersion} or greater`
      );
    }
  }
  protected abstract doExecute(): Promise<void>;
  private readonly quartoContext_: QuartoContext;
}

abstract class RenderDocumentCommandBase extends RenderCommand {
  constructor(
    quartoContext: QuartoContext,
    private readonly engine_: MarkdownEngine
  ) {
    super(quartoContext);
  }
  protected async renderFormat(format?: string | null, onShow?: () => void) {
    const targetEditor = findRenderTarget(canPreviewDoc);
    if (targetEditor) {
      // set the slide index from the source editor so we can
      // navigate to it in the preview frame
      const slideIndex = !isNotebook(targetEditor.document)
        ? await revealSlideIndex(
            targetEditor.selection.active,
            targetEditor.document,
            this.engine_
          )
        : undefined;

      await previewDoc(targetEditor, format, slideIndex, onShow);
    } else {
      window.showInformationMessage("No Quarto document available to render");
    }
  }
}

class RenderShortcutCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderShortcut";
  public readonly id = RenderShortcutCommand.id;

  protected async doExecute() {
    return super.renderFormat();
  }
}

class RenderDocumentCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.render";
  public readonly id = RenderDocumentCommand.id;

  protected async doExecute() {
    return super.renderFormat(null);
  }
}

class RenderDocumentHTMLCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderHTML";
  public readonly id = RenderDocumentHTMLCommand.id;

  protected async doExecute() {
    return super.renderFormat("html");
  }
}

class RenderDocumentPDFCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderPDF";
  public readonly id = RenderDocumentPDFCommand.id;

  protected async doExecute() {
    return super.renderFormat("pdf");
  }
}

class RenderDocumentWordCommand
  extends RenderDocumentCommandBase
  implements Command
{
  constructor(quartoContext: QuartoContext, engine: MarkdownEngine) {
    super(quartoContext, engine);
  }
  private static readonly id = "quarto.renderWord";
  public readonly id = RenderDocumentWordCommand.id;

  protected async doExecute() {
    return super.renderFormat("docx");
  }
}

class RenderProjectCommand extends RenderCommand implements Command {
  private static readonly id = "quarto.renderProject";
  public readonly id = RenderProjectCommand.id;

  async doExecute() {
    await workspace.saveAll(false);
    // start by using the currently active or visible source files
    const targetEditor = findRenderTarget(canPreviewDoc);
    if (targetEditor) {
      const projectDir = projectDirForDocument(targetEditor.document);
      if (projectDir) {
        previewProject(Uri.file(projectDir));
        return;
      }
    }

    // next check any open workspaces for a project file
    if (workspace.workspaceFolders) {
      for (const folder of workspace.workspaceFolders) {
        if (hasQuartoProject(folder.uri.fsPath)) {
          previewProject(folder.uri);
          return;
        }
      }
    }

    // no project found!
    window.showInformationMessage("No project available to render.");
  }
}

class TerminatePreviewCommand implements Command {
  private static readonly id = "quarto.terminatePreview";
  public readonly id = TerminatePreviewCommand.id;
  constructor(private readonly previewManager_: PreviewManager) {}
  execute(): void {
    this.previewManager_.terminatePreview(true);
  }
}

class ClearCacheCommand implements Command {
  private static readonly id = "quarto.clearCache";
  public readonly id = ClearCacheCommand.id;

  async execute(): Promise<void> {
    // see if there is a cache to clear
    const doc = findRenderTarget(canPreviewDoc)?.document;
    if (doc) {
      const cacheDir = cacheDirForDocument(doc);
      if (cacheDir) {
        const result = await window.showInformationMessage(
          "Clear Cache Directory",
          { modal: true, detail: `Delete the cache directory at ${cacheDir}?` },
          "Yes",
          "No"
        );
        if (result === "Yes") {
          await workspace.fs.delete(Uri.file(cacheDir), { recursive: true });
        }
      } else {
        window.showInformationMessage("Unable to Clear Cache", {
          modal: true,
          detail:
            "There is no cache associated with the current Quarto document.",
        });
      }
      // see if there is an _cache directory for this file
      // see if there is a .jupyter_cache directory for this file
    } else {
      window.showInformationMessage("Unable to Clear Cache", {
        modal: true,
        detail: "The current document is not a Quarto document.",
      });
    }
  }
}

class WalkthroughRenderCommand extends RenderDocumentCommandBase {
  private static readonly id = "quarto.walkthrough.render";
  public readonly id = WalkthroughRenderCommand.id;

  protected async doExecute() {
    return super.renderFormat(null, () => {
      commands.executeCommand("workbench.action.closeSidebar");
    });
  }
}

function cacheDirForDocument(doc: TextDocument) {
  // directory for doc
  const dir = path.dirname(doc.fileName);

  // check for jupyter cache
  const jupyterCacheDir = path.join(dir, ".jupyter_cache");
  if (fs.existsSync(jupyterCacheDir)) {
    return jupyterCacheDir;
  }

  // check for knitr cache
  const stem = path.basename(doc.fileName, path.extname(doc.fileName));
  const knitrCacheDir = path.join(dir, stem + "_cache");
  if (fs.existsSync(knitrCacheDir)) {
    return knitrCacheDir;
  }

  return undefined;
}

function projectDirForDocument(doc: TextDocument) {
  let dir = path.dirname(doc.fileName);
  while (true) {
    if (hasQuartoProject(dir)) {
      return dir;
    } else {
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

function hasQuartoProject(dir?: string) {
  if (dir) {
    return (
      fs.existsSync(path.join(dir, "_quarto.yml")) ||
      fs.existsSync(path.join(dir, "_quarto.yaml"))
    );
  } else {
    return false;
  }
}

function findRenderTarget(
  filter: (doc: TextDocument) => boolean,
  includeVisible = true
) {
  const activeDoc = window.activeTextEditor?.document;
  if (activeDoc && filter(activeDoc)) {
    return window.activeTextEditor;
  } else if (includeVisible) {
    const visibleEditor = window.visibleTextEditors.find((editor) =>
      canPreviewDoc(editor.document)
    );
    if (visibleEditor) {
      return visibleEditor;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

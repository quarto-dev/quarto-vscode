/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";

import { window, Uri, workspace } from "vscode";
import { Command } from "../../core/command";
import { QuartoContext } from "../../shared/quarto";
import { previewDoc, previewProject } from "./preview";
import { MarkdownEngine } from "../../markdown/engine";
import { revealSlideIndex } from "./preview-reveal";
import { canPreviewDoc, isNotebook } from "../../core/doc";
import {
  activeRenderTarget,
  hasQuartoProject,
  projectDirForDocument,
} from "../../core/render";

export function previewCommands(
  quartoContext: QuartoContext,
  engine: MarkdownEngine
): Command[] {
  return [
    new RenderDocumentCommand(quartoContext, engine),
    new RenderProjectCommand(quartoContext),
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

class RenderDocumentCommand extends RenderCommand implements Command {
  constructor(
    quartoContext: QuartoContext,
    private readonly engine_: MarkdownEngine
  ) {
    super(quartoContext);
  }
  private static readonly id = "quarto.render";
  public readonly id = RenderDocumentCommand.id;
  async doExecute() {
    const targetEditor = activeRenderTarget(canPreviewDoc);
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

      await previewDoc(targetEditor, undefined, slideIndex);
    } else {
      window.showInformationMessage("No Quarto document available to render");
    }
  }
}

class RenderProjectCommand extends RenderCommand implements Command {
  private static readonly id = "quarto.renderProject";
  public readonly id = RenderProjectCommand.id;

  async doExecute() {
    await workspace.saveAll(false);
    // start by using the currently active or visible source files
    const targetEditor = activeRenderTarget(canPreviewDoc);
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

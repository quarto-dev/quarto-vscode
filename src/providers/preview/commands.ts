/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";
import * as path from "path";

import { TextDocument, window, Uri } from "vscode";
import { Command } from "../../core/command";
import { QuartoContext } from "../../shared/quarto";
import { canPreviewDoc, previewDoc, previewProject } from "./preview";

export function previewCommands(quartoContext: QuartoContext): Command[] {
  return [
    new RenderDocumentCommand(quartoContext),
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
  private static readonly id = "quarto.render";
  public readonly id = RenderDocumentCommand.id;
  async doExecute() {
    const targetEditor = findRenderTarget(canPreviewDoc);
    if (targetEditor) {
      await previewDoc(targetEditor);
    } else {
      window.showInformationMessage("No Quarto document available to render");
    }
  }
}

class RenderProjectCommand extends RenderCommand implements Command {
  private static readonly id = "quarto.renderProject";
  public readonly id = RenderProjectCommand.id;

  async doExecute() {
    const targetEditor = findRenderTarget(canPreviewDoc);
    if (targetEditor) {
      // TODO: chase up the heirarchy to find project for editor
      previewProject(Uri.file(path.dirname(targetEditor.document.uri.fsPath)));
    }
    // TODO: look at workspace

    // TODO: error if can't find a project

    // TODO: not re-using when single doc is rendered back into it (could be the uri
    // we are using to call into the python extension with?)
  }
}

function findRenderTarget(filter: (doc: TextDocument) => boolean) {
  const activeDoc = window.activeTextEditor?.document;
  if (activeDoc && filter(activeDoc)) {
    return window.activeTextEditor;
  } else {
    const visibleEditor = window.visibleTextEditors.find((editor) =>
      canPreviewDoc(editor.document)
    );
    if (visibleEditor) {
      return visibleEditor;
    } else {
      return undefined;
    }
  }
}

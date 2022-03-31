/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";
import * as path from "path";
import * as fs from "fs";

import { TextDocument, window, Uri, workspace } from "vscode";
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

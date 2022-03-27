/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";

import { window } from "vscode";
import { Command } from "../../core/command";
import { QuartoContext } from "../../shared/quarto";
import { canPreviewDoc, previewDoc } from "./preview";

export function previewCommands(quartoContext: QuartoContext): Command[] {
  return [new RenderCommand(quartoContext)];
}

class RenderCommand implements Command {
  private static readonly id = "quarto.render";
  public readonly id = RenderCommand.id;
  constructor(quartoContext: QuartoContext) {
    this.quartoContext_ = quartoContext;
  }
  async execute() {
    const kRequiredVersion = "0.9.149";
    if (semver.gte(this.quartoContext_.version, kRequiredVersion)) {
      const activeDoc = window.activeTextEditor?.document;
      if (activeDoc && canPreviewDoc(activeDoc)) {
        await previewDoc(window.activeTextEditor!);
      } else {
        const visibleEditor = window.visibleTextEditors.find((editor) =>
          canPreviewDoc(editor.document)
        );
        if (visibleEditor) {
          await previewDoc(visibleEditor);
        } else {
          window.showInformationMessage(
            "No Quarto document available to render"
          );
        }
      }
    } else {
      window.showWarningMessage(
        `Rending documents requires Quarto version ${kRequiredVersion} or greater`
      );
    }
  }
  private readonly quartoContext_: QuartoContext;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import semver from "semver";

import { window } from "vscode";
import { Command } from "../../core/command";
import { QuartoContext } from "../../core/quarto";
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
    const kRequiredVersion = "99.9.9";
    if (semver.gte(this.quartoContext_.version, kRequiredVersion)) {
      const activeDoc = window.activeTextEditor?.document;
      if (activeDoc && canPreviewDoc(activeDoc)) {
        await previewDoc(activeDoc);
      }
    } else {
      window.showWarningMessage(
        `Rending documents requires Quarto version ${kRequiredVersion} or greater`
      );
    }
  }
  private readonly quartoContext_: QuartoContext;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window } from "vscode";
import { Command } from "../../core/command";
import { canPreviewDoc, previewDoc } from "./preview";

export function previewCommands(): Command[] {
  return [new RenderCommand()];
}

class RenderCommand implements Command {
  private static readonly id = "quarto.render";
  public readonly id = RenderCommand.id;
  async execute() {
    const activeDoc = window.activeTextEditor?.document;
    if (activeDoc && canPreviewDoc(activeDoc)) {
      await previewDoc(activeDoc);
    }
  }
}

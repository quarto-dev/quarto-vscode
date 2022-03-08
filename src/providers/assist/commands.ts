/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Position, Selection, window } from "vscode";
import { Command } from "../../core/command";
import { QuartoAssistViewProvider } from "./webview";

export class PreviewMathCommand implements Command {
  private static readonly id = "quarto.previewMath";
  public readonly id = PreviewMathCommand.id;
  constructor(private readonly provider_: QuartoAssistViewProvider) {}
  execute(line: number): void {
    if (window.activeTextEditor) {
      const selPos = new Position(line, 0);
      window.activeTextEditor.selection = new Selection(selPos, selPos);
    }

    // attempt to activate (if we fail to the view has been closed so
    // recreate it by calling focus)
    if (!this.provider_.activate()) {
      // commands.executeCommand("quarto-assist.focus");
    }
  }
}

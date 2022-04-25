/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, env, Uri } from "vscode";
import { Command } from "../core/command";
import { QuartoContext } from "../shared/quarto";

export function walkthroughCommands(quartoContext: QuartoContext): Command[] {
  return [new VerifyInstallationCommand(quartoContext)];
}

class VerifyInstallationCommand implements Command {
  private static readonly id = "quarto.verifyInstallation";
  public readonly id = VerifyInstallationCommand.id;

  constructor(private readonly quartoContext_: QuartoContext) {}

  async execute(): Promise<void> {
    if (this.quartoContext_.available) {
      window.showInformationMessage("Quarto Installation Verified", {
        modal: true,
        detail: `Quarto version ${this.quartoContext_.version} installed at ${this.quartoContext_.binPath}`,
      });
    } else {
      const installQuarto = { title: "Install Quarto" };
      const result = await window.showWarningMessage(
        "Quarto Installation Not Found",
        {
          modal: true,
          detail:
            "Please install the Quarto CLI before using the VS Code extension.",
        },
        installQuarto
      );
      if (result === installQuarto) {
        env.openExternal(Uri.parse("https://quarto.org/docs/get-started/"));
      }
    }
  }
}

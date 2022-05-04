/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, env, Uri } from "vscode";

export async function promptForQuartoInstallation(context: string) {
  const installQuarto = { title: "Install Quarto" };
  const result = await window.showWarningMessage(
    "Quarto Installation Not Found",
    {
      modal: true,
      detail: `Please install the Quarto CLI before ${context}.`,
    },
    installQuarto
  );
  if (result === installQuarto) {
    env.openExternal(Uri.parse("https://quarto.org/docs/get-started/"));
  }
}

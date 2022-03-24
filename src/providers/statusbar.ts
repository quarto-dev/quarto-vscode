/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { StatusBarAlignment, window } from "vscode";
import { QuartoContext } from "../shared/quarto";

export function activateStatusBar(quartoContext: QuartoContext) {
  const statusItem = window.createStatusBarItem(
    "quarto.version",
    StatusBarAlignment.Right
  );
  statusItem.name = "Quarto";
  statusItem.text = `${quartoContext.version}`;
  statusItem.tooltip = `${statusItem.name} v${statusItem.text}: ${quartoContext.binPath}`;
  statusItem.show();
}

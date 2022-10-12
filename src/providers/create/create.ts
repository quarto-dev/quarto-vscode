/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import path from "path";

import { ExtensionContext, workspace, window, ViewColumn } from "vscode";
import { QuartoContext } from "../../shared/quarto";
import { collectFirstRun } from "./firstrun";
import { CreateProjectCommand } from "./project";

export async function activateCreate(
  context: ExtensionContext,
  quartoContext: QuartoContext
) {
  // open documents if there is a first-run file
  if (quartoContext.workspaceDir) {
    const firstRun = collectFirstRun(quartoContext.workspaceDir).map((file) =>
      path.join(quartoContext.workspaceDir!, file)
    );
    for (const file of firstRun) {
      const doc = await workspace.openTextDocument(file);
      await window.showTextDocument(doc, ViewColumn.Active);
    }
  }

  // commands
  return [new CreateProjectCommand(context, quartoContext)];
}

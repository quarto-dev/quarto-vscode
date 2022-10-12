/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";

import { commands, ExtensionContext, QuickPickItem, Uri, window } from "vscode";
import { Command } from "../../core/command";
import { withMinimumQuartoVersion } from "../../core/quarto";
import { QuartoContext } from "../../shared/quarto";
import { resolveDirectoryForCreate } from "./directory";
import { createFirstRun } from "./firstrun";

export class CreateExtensionCommand implements Command {
  constructor(
    private readonly context_: ExtensionContext,
    private readonly quartoContext_: QuartoContext
  ) {}
  private static readonly id = "quarto.createExtension";
  public readonly id = CreateExtensionCommand.id;

  async execute() {
    await withMinimumQuartoVersion(
      this.quartoContext_,
      "1.3.0",
      "Creating extensions",
      async () => {
        // select extension type
        const typePick = await selectExtensionType(1, 2);
        if (!typePick) {
          return;
        }

        // resolve directory
        const extensionDir = await resolveDirectoryForCreate(
          this.context_,
          "Extension"
        );
        if (!extensionDir) {
          return;
        }

        // create the extension
        await createAndOpenExtension(
          this.quartoContext_,
          typePick,
          extensionDir
        );
      }
    );
  }
}

async function createAndOpenExtension(
  _quartoContext: QuartoContext,
  pick: CreateExtensionQuickPickItem,
  extensionDir: string
) {
  // create the project
  // quartoContext.runQuarto({}, "create-project", projDir, "--type", pick.type);
  fs.mkdirSync(extensionDir);
  fs.writeFileSync(
    path.join(extensionDir, "example.qmd"),
    `---
title: "Example"
format: html
---

`,
    { encoding: "utf-8" }
  );

  // write the first run file
  createFirstRun(extensionDir, pick.firstRun);

  // open the project
  await commands.executeCommand("vscode.openFolder", Uri.file(extensionDir));
}

interface CreateExtensionQuickPickItem extends QuickPickItem {
  type: string;
  name: string;
  firstRun: string[];
}

function selectExtensionType(
  step?: number,
  totalSteps?: number
): Promise<CreateExtensionQuickPickItem | undefined> {
  return new Promise<CreateExtensionQuickPickItem | undefined>((resolve) => {
    const shortcodeType: CreateExtensionQuickPickItem = {
      type: "shortcode",
      name: "Shortcode",
      firstRun: ["example.qmd"],
      label: "Shortcode Extension",
      detail: "A shortcode for generating content",
      alwaysShow: true,
    };
    const filterType: CreateExtensionQuickPickItem = {
      type: "filter",
      name: "Filter",
      firstRun: ["example.qmd"],
      label: "Filter Extension",
      detail: "A filter for filtering",
      alwaysShow: true,
    };
    const quickPick = window.createQuickPick<CreateExtensionQuickPickItem>();
    quickPick.title = "Create Extension";
    quickPick.placeholder = "Select extension type";
    quickPick.step = step;
    quickPick.totalSteps = totalSteps;
    quickPick.items = [shortcodeType, filterType];
    let accepted = false;
    quickPick.onDidAccept(() => {
      accepted = true;
      quickPick.hide();
      resolve(quickPick.selectedItems[0]);
    });
    quickPick.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
    quickPick.show();
  });
}

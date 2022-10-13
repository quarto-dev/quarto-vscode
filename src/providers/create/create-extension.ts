/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";

import {
  commands,
  ExtensionContext,
  QuickPickItem,
  QuickPickItemKind,
  Uri,
  window,
} from "vscode";
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
          "Extension",
          "Extension Name",
          true
        );
        if (!extensionDir) {
          return;
        }

        // create the extension
        await createAndOpenExtension(
          this.context_,
          this.quartoContext_,
          typePick,
          extensionDir
        );
      }
    );
  }
}

async function createAndOpenExtension(
  context: ExtensionContext,
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
  createFirstRun(context, extensionDir, pick.firstRun);

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
    const extensionQuickPick = (
      name: string,
      type: string,
      detail: string
    ) => ({
      type: type || name.toLowerCase(),
      name,
      firstRun: ["example.qmd"],
      label: name,
      detail,
      alwaysShow: true,
    });

    const quickPick = window.createQuickPick<QuickPickItem>();
    quickPick.title = "Create Quarto Extension";
    quickPick.placeholder = "Select extension type";
    quickPick.step = step;
    quickPick.totalSteps = totalSteps;
    quickPick.items = [
      extensionQuickPick(
        "Shortcode",
        "shortcode",
        "Markdown directive that generates content"
      ),
      extensionQuickPick(
        "Filter",
        "filter",
        "Custom markdown rendering behavior"
      ),
      extensionQuickPick(
        "Revealjs Plugin",
        "revealjs",
        "New capabilities for Revealjs presentations"
      ),
      {
        label: "Formats",
        kind: QuickPickItemKind.Separator,
      },
      extensionQuickPick(
        "Journal Article Format",
        "journal",
        "Professional Journal article format"
      ),
      extensionQuickPick(
        "Custom Format (HTML)",
        "format:html",
        "HTML format with custom options, style sheet, etc."
      ),
      extensionQuickPick(
        "Custom Format (PDF)",
        "format:pdf",
        "PDF format with custom options, LaTeX directives, etc."
      ),
      extensionQuickPick(
        "Custom Format (MS Word)",
        "format:docx",
        "MS Word format with custom options, template, etc."
      ),
      extensionQuickPick(
        "Custom Format (Revealjs)",
        "format:revealjs",
        "Revealjs format with custom options, theme, etc."
      ),
      {
        label: "Projects",
        kind: QuickPickItemKind.Separator,
      },
      extensionQuickPick(
        "Custom Project Type",
        "project",
        "Project with standard set of options"
      ),
    ];
    let accepted = false;
    quickPick.onDidAccept(() => {
      accepted = true;
      quickPick.hide();
      resolve(quickPick.selectedItems[0] as CreateExtensionQuickPickItem);
    });
    quickPick.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
    quickPick.show();
  });
}

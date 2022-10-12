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
import { createFirstRun } from "./firstrun";

export class CreateProjectCommand implements Command {
  constructor(
    private readonly context_: ExtensionContext,
    private readonly quartoContext_: QuartoContext
  ) {}
  private static readonly id = "quarto.createProject";
  public readonly id = CreateProjectCommand.id;

  async execute() {
    await withMinimumQuartoVersion(
      this.quartoContext_,
      "1.0.0",
      "Creating projects",
      async () => {
        // select project type
        const typePick = await selectProjectType(1, 2);
        if (!typePick) {
          return;
        }

        // select direcotry (see if we have a default parent)
        const kDefaultProjectParentDir = "quarto.createProject.dir";
        const defaultParent = this.context_.globalState.get<string | undefined>(
          kDefaultProjectParentDir,
          undefined
        );
        const projFolder = await window.showOpenDialog({
          title: "New Project Direcory",
          openLabel: "Choose Project Directory",
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri:
            defaultParent && fs.existsSync(defaultParent)
              ? Uri.file(defaultParent)
              : undefined,
        });
        if (!projFolder) {
          return;
        }

        // see if we need a sub-directory
        let projDir: string | undefined = projFolder[0].fsPath;
        projDir = isDirEmpty(projDir)
          ? projDir
          : await projectDirectoryWithSubdir(projDir, 2, 2);
        if (!projDir) {
          return;
        }

        // update the default project parent dir
        this.context_.globalState.update(
          kDefaultProjectParentDir,
          path.dirname(projDir)
        );

        // create the project
        await createAndOpenProject(this.quartoContext_, typePick, projDir);
      }
    );
  }
}

async function createAndOpenProject(
  quartoContext: QuartoContext,
  pick: CreateProjectQuickPickItem,
  projDir: string
) {
  // create the project
  quartoContext.runQuarto({}, "create-project", projDir, "--type", pick.type);

  // write the first run file
  createFirstRun(projDir, pick.firstRun);

  // open the project
  await commands.executeCommand("vscode.openFolder", Uri.file(projDir));
}

interface CreateProjectQuickPickItem extends QuickPickItem {
  type: string;
  name: string;
  firstRun: string[];
}

function selectProjectType(
  step?: number,
  totalSteps?: number
): Promise<CreateProjectQuickPickItem | undefined> {
  return new Promise<CreateProjectQuickPickItem | undefined>((resolve) => {
    const defaultType: CreateProjectQuickPickItem = {
      type: "default",
      name: "Default",
      firstRun: ["$(dirname).qmd"],
      label: "$(gear) Default Project",
      detail: "Simple project with starter document",
      alwaysShow: true,
    };
    const websiteType: CreateProjectQuickPickItem = {
      type: "website",
      name: "Website",
      firstRun: ["index.qmd"],
      label: "$(globe) Website Project",
      detail: "Website with index and about pages",
      alwaysShow: true,
    };
    const blogType: CreateProjectQuickPickItem = {
      type: "website:blog",
      name: "Blog",
      firstRun: ["index.qmd"],
      label: "$(preview) Blog Project",
      detail: "Blog with index/about pages and posts.",
      alwaysShow: true,
    };
    const bookType: CreateProjectQuickPickItem = {
      type: "book",
      name: "Book",
      firstRun: ["index.qmd"],
      label: "$(book) Book Project",
      detail: "Book with chapters and bibliography.",
      alwaysShow: true,
    };
    const quickPick = window.createQuickPick<CreateProjectQuickPickItem>();
    quickPick.title = "Create Project";
    quickPick.placeholder = "Select project type";
    quickPick.step = step;
    quickPick.totalSteps = totalSteps;
    quickPick.items = [defaultType, websiteType, blogType, bookType];
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

function projectDirectoryWithSubdir(
  parentDir: string,
  step?: number,
  totalSteps?: number
): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    const inputBox = window.createInputBox();
    inputBox.title = `Project Subdirectory`;
    inputBox.prompt = parentDir;
    inputBox.placeholder = "New project subdirectory name";
    inputBox.step = step;
    inputBox.totalSteps = totalSteps;
    inputBox.onDidChangeValue((value) => {
      inputBox.prompt = path.join(parentDir, value);
    });
    let accepted = false;
    inputBox.onDidAccept(() => {
      accepted = true;
      inputBox.hide();
      resolve(
        inputBox.value.length ? path.join(parentDir, inputBox.value) : undefined
      );
    });
    inputBox.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
    inputBox.show();
  });
}

function isDirEmpty(dirname: string) {
  const listing = fs
    .readdirSync(dirname)
    .filter((file) => path.basename(file) !== ".DS_Store");
  return listing.length === 0;
}

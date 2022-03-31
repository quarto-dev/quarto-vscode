/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, window, commands } from "vscode";
import { kQuartoLanguageId } from "../../server/src/core/doc";
import { Command } from "../core/command";

export function newDocumentCommands(): Command[] {
  return [
    new NewDocumentCommand("quarto.newDocument"),
    new NewDocumentCommand("quarto.fileNewDocument"),
    new NewPresentationCommand("quarto.newPresentation"),
    new NewPresentationCommand("quarto.fileNewPresentation"),
  ];
}

abstract class NewFileCommand implements Command {
  public readonly id: string;
  constructor(cmdId: string) {
    this.id = cmdId;
  }
  async execute(): Promise<void> {
    const doc = await workspace.openTextDocument({
      language: kQuartoLanguageId,
      content: this.scaffold(),
    });
    await window.showTextDocument(doc, undefined, false);
    await commands.executeCommand("cursorMove", { to: "viewPortBottom" });
  }
  protected abstract scaffold(): string;
}

class NewDocumentCommand extends NewFileCommand {
  constructor(cmdId: string) {
    super(cmdId);
  }
  protected scaffold(): string {
    return `---
title: "Untitled"
format: html
---

`;
  }
}

class NewPresentationCommand extends NewFileCommand {
  constructor(cmdId: string) {
    super(cmdId);
  }
  protected scaffold(): string {
    return `---
title: "Untitled"
format: revealjs
---

`;
  }
}

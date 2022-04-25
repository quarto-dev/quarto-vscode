/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  workspace,
  window,
  commands,
  NotebookData,
  NotebookCellData,
  NotebookCellKind,
  WorkspaceEdit,
  ViewColumn,
} from "vscode";
import { Command } from "../core/command";
import { getWholeRange, kQuartoLanguageId } from "../core/doc";
import { hasRequiredExtension } from "./cell/executors";

export function newDocumentCommands(): Command[] {
  return [
    new NewDocumentCommand("quarto.newDocument"),
    new NewDocumentCommand("quarto.fileNewDocument"),
    new NewPresentationCommand("quarto.newPresentation"),
    new NewPresentationCommand("quarto.fileNewPresentation"),
    new NewNotebookCommand("quarto.newNotebook"),
    new NewNotebookCommand("quarto.fileNewNotebook"),
    new WalkthroughNewDocumentCommand("quarto.walkthrough.newDocument"),
  ];
}

class NewNotebookCommand implements Command {
  public readonly id: string;
  constructor(cmdId: string) {
    this.id = cmdId;
  }
  async execute(): Promise<void> {
    const cells: NotebookCellData[] = [];
    cells.push(
      new NotebookCellData(
        NotebookCellKind.Code,
        kUntitledHtml.trimEnd(),
        "raw"
      )
    );
    cells.push(new NotebookCellData(NotebookCellKind.Code, "1 + 1", "python"));
    const nbData = new NotebookData(cells);
    let notebook = await workspace.openNotebookDocument(
      "jupyter-notebook",
      nbData
    );
    await commands.executeCommand(
      "vscode.openWith",
      notebook.uri,
      "jupyter-notebook"
    );

    const cell = notebook.cellAt(1);
    const edit = new WorkspaceEdit();
    edit.replace(cell.document.uri, getWholeRange(cell.document), "");

    await workspace.applyEdit(edit);
  }
}

abstract class NewFileCommand implements Command {
  public readonly id: string;
  constructor(cmdId: string, private readonly viewColumn_?: ViewColumn) {
    this.id = cmdId;
  }
  async execute(): Promise<void> {
    const doc = await workspace.openTextDocument({
      language: kQuartoLanguageId,
      content: this.scaffold(),
    });
    await window.showTextDocument(doc, this.viewColumn_, false);
    await commands.executeCommand("cursorMove", { to: "viewPortBottom" });
  }
  protected abstract scaffold(): string;
}

class NewDocumentCommand extends NewFileCommand {
  constructor(cmdId: string) {
    super(cmdId);
  }
  protected scaffold(): string {
    return kUntitledHtml;
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

const kUntitledHtml = `---
title: "Untitled"
format: html
---

`;

class WalkthroughNewDocumentCommand extends NewFileCommand {
  constructor(cmdId: string) {
    super(cmdId, ViewColumn.Beside);
  }
  protected scaffold(): string {
    // determine which code block to use (default to python)
    const kPython = {
      lang: "python",
      desc: "a Python",
      code: "import os\nos.cpu_count()",
      suffix: ":",
    };
    const kR = {
      lang: "r",
      desc: "an R",
      code: "summary(cars)",
      suffix: ":",
    };
    const kJulia = {
      lang: "julia",
      desc: "a Julia",
      code: "1 + 1",
      suffix: ":",
    };
    const langBlock = [kPython, kR, kJulia].find((lang) => {
      return hasRequiredExtension(lang.lang);
    }) || {
      ...kPython,
      suffix:
        ".\n\nInstall the VS Code Python Extension to enable\nrunning this cell interactively.",
    };

    return `---
title: "Hello, Quarto"
format: html
---

## Markdown

Markdown is an easy to read and write text format:

- It's _plain text_ so works well with version control
- It can be **rendered** into HTML, PDF, and more
- Learn more at: <https://quarto.org/docs/authoring/>

## Code Cell

Here is ${langBlock.desc} code cell${langBlock.suffix}

\`\`\`{${langBlock.lang}}
${langBlock.code}
\`\`\`

## Equation

Use LaTeX to write equations:

$$
chi' = sum_{i=1}^n k_i s_i^2
$$
`;
  }
}

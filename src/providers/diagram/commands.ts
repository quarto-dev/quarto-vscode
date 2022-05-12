/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, Position, ViewColumn, window } from "vscode";
import { Command } from "../../core/command";
import { isQuartoDoc } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isDiagram,
  isDisplayMath,
  languageBlockAtPosition,
} from "../../markdown/language";
import { QuartoDiagramWebviewManager } from "./diagram-webview";

export function diagramCommands(
  manager: QuartoDiagramWebviewManager,
  engine: MarkdownEngine
): Command[] {
  return [
    new PreviewDiagramCommand(manager, engine),
    new PreviewShortcutCommand(engine),
  ];
}

class PreviewDiagramCommand implements Command {
  constructor(
    private readonly manager_: QuartoDiagramWebviewManager,
    private readonly engine_: MarkdownEngine
  ) {}
  execute(_line?: number): void {
    this.manager_.showWebview("state", {
      preserveFocus: true,
      viewColumn: ViewColumn.Beside,
    });
  }

  private static readonly id = "quarto.previewDiagram";
  public readonly id = PreviewDiagramCommand.id;
}

class PreviewShortcutCommand implements Command {
  constructor(private readonly engine_: MarkdownEngine) {}
  async execute(): Promise<void> {
    // first determine whether this is an alias for preview math or preview diagram
    if (window.activeTextEditor) {
      const doc = window.activeTextEditor.document;
      if (isQuartoDoc(doc)) {
        // are we in a language block?
        const tokens = await this.engine_.parse(doc);
        const line = window.activeTextEditor.selection.start.line;
        const block = languageBlockAtPosition(tokens, new Position(line, 0));
        if (block) {
          if (isDisplayMath(block)) {
            commands.executeCommand("quarto.previewMath", line);
            return;
          } else if (isDiagram(block)) {
            commands.executeCommand("quarto.previewDiagram", line);
            return;
          }
        }
      }
    }
    // info message
    window.showInformationMessage(
      "No preview available (selection not within an equation or diagram)"
    );
  }

  private static readonly id = "quarto.previewShortcut";
  public readonly id = PreviewShortcutCommand.id;
}

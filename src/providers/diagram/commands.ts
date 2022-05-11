/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewColumn } from "vscode";
import { Command } from "../../core/command";
import { MarkdownEngine } from "../../markdown/engine";
import { QuartoDiagramWebviewManager } from "./diagram-webview";

export function diagramCommands(
  manager: QuartoDiagramWebviewManager,
  engine: MarkdownEngine
): Command[] {
  return [
    new PreviewDiagramCommand(manager, engine),
    new PreviewContentCommand(manager, engine),
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

class PreviewContentCommand implements Command {
  constructor(
    private readonly manager_: QuartoDiagramWebviewManager,
    private readonly engine_: MarkdownEngine
  ) {}
  execute(): void {
    this.manager_.showWebview("state", {
      preserveFocus: true,
      viewColumn: ViewColumn.Beside,
    });
  }

  private static readonly id = "quarto.previewShortcut";
  public readonly id = PreviewContentCommand.id;
}

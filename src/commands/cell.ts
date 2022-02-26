import { commands, Position, window } from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { languageNameFromBlock } from "../markdown/language";
import { languageBlockAtPosition } from "../vdoc/vdoc";

export function cellCommands(engine: MarkdownEngine): Command[] {
  return [new RunCurrentCellCommand(engine)];
}

class RunCurrentCellCommand implements Command {
  constructor(engine: MarkdownEngine) {
    this.engine_ = engine;
  }
  private static readonly id = "quarto.runCurrentCell";
  public readonly id = RunCurrentCellCommand.id;
  async execute(line?: number): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
      line = line || editor.selection.start.line;
      const block = languageBlockAtPosition(tokens, new Position(line, 0));
      if (block && languageNameFromBlock(block) === "python") {
        await commands.executeCommand(
          "jupyter.execSelectionInteractive",
          block.content
        );
      } else {
        window.showInformationMessage(
          "Editor selection is not within a Python cell"
        );
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
  }

  private engine_: MarkdownEngine;
}

import Token from "markdown-it/lib/token";
import {
  commands,
  Position,
  Range,
  Selection,
  TextEditor,
  window,
} from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import { languageNameFromBlock } from "../markdown/language";
import { languageBlockAtPosition } from "../vdoc/vdoc";

export function cellCommands(engine: MarkdownEngine): Command[] {
  return [new RunCurrentCellCommand(engine), new RunSelectionCommand(engine)];
}

class RunCommand {
  constructor(engine: MarkdownEngine) {
    this.engine_ = engine;
  }

  public async execute(line?: number): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
      line = line || editor.selection.start.line;
      const block = languageBlockAtPosition(tokens, new Position(line, 0));
      if (block && languageNameFromBlock(block) === "python") {
        this.doExecute(editor, tokens, line, block);
      } else {
        window.showInformationMessage(
          "Editor selection is not within a Python cell"
        );
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
  }

  protected getLine(_arg?: unknown): number | null {
    return null;
  }

  protected async doExecute(
    _editor: TextEditor,
    _tokens: Token[],
    _line: number,
    _block: Token
  ) {}

  private engine_: MarkdownEngine;
}

class RunCurrentCellCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runCurrentCell";
  public readonly id = RunCurrentCellCommand.id;

  override async doExecute(
    _editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block: Token
  ) {
    await commands.executeCommand(
      "jupyter.execSelectionInteractive",
      block.content
    );
  }
}

class RunSelectionCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runLines";
  public readonly id = RunSelectionCommand.id;

  override async doExecute(editor: TextEditor) {
    // determine the selected lines
    const selection = editor.document.getText(
      new Range(
        new Position(editor.selection.start.line, 0),
        new Position(
          editor.selection.end.line,
          editor.document.lineAt(editor.selection.end).text.length
        )
      )
    );

    // for single-line selections we advance to the next line
    if (editor.selection.isSingleLine) {
      const selPos = new Position(editor.selection.start.line + 1, 0);
      editor.selection = new Selection(selPos, selPos);
    }

    // run them
    await commands.executeCommand(
      "jupyter.execSelectionInteractive",
      selection
    );
  }
}

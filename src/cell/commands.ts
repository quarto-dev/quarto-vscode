/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Token from "markdown-it/lib/token";
import { Position, Range, Selection, TextEditor, window } from "vscode";
import { Command } from "../core/command";
import { isQuartoDoc } from "../core/doc";
import { MarkdownEngine } from "../markdown/engine";
import {
  isExecutableLanguageBlockOf,
  languageNameFromBlock,
} from "../markdown/language";
import { languageBlockAtPosition } from "../vdoc/vdoc";
import { blockHasExecutor, executeInteractive } from "./executors";

export function cellCommands(engine: MarkdownEngine): Command[] {
  return [
    new RunCurrentCellCommand(engine),
    new RunSelectionCommand(engine),
    new RunCellsAboveCommand(engine),
  ];
}

abstract class RunCommand {
  constructor(engine: MarkdownEngine) {
    this.engine_ = engine;
  }

  public async execute(line?: number): Promise<void> {
    const editor = window.activeTextEditor;
    const doc = editor?.document;
    if (doc && isQuartoDoc(doc)) {
      const tokens = await this.engine_.parse(doc);
      line = line || editor.selection.start.line;
      const block = languageBlockAtPosition(
        tokens,
        new Position(line, 0),
        this.includeFence()
      );
      if (!this.blockRequired() || blockHasExecutor(block)) {
        this.doExecute(editor, tokens, line, block);
      } else {
        window.showInformationMessage(
          "Editor selection is not within an executable cell"
        );
      }
    } else {
      window.showInformationMessage("Active editor is not a Quarto document");
    }
  }

  protected includeFence() {
    return true;
  }

  protected blockRequired() {
    return true;
  }

  protected abstract doExecute(
    editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ): Promise<void>;

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
    const language = languageNameFromBlock(block);
    await executeInteractive(language, block.content);
  }
}

class RunSelectionCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runLines";
  public readonly id = RunSelectionCommand.id;

  override includeFence() {
    return false;
  }

  override async doExecute(
    editor: TextEditor,
    _tokens: Token[],
    _line: number,
    block: Token
  ) {
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

    // run code
    const language = languageNameFromBlock(block);
    await executeInteractive(language, selection);
  }
}

class RunCellsAboveCommand extends RunCommand implements Command {
  constructor(engine: MarkdownEngine) {
    super(engine);
  }
  private static readonly id = "quarto.runCellsAbove";
  public readonly id = RunCellsAboveCommand.id;

  override blockRequired(): boolean {
    return false;
  }

  override async doExecute(
    _editor: TextEditor,
    tokens: Token[],
    line: number,
    block?: Token
  ) {
    // collect up blocks prior to the active one
    const blocks: Token[] = [];
    for (const block of tokens.filter(blockHasExecutor)) {
      // if the end of this block is past the line then bail
      if (!block.map || block.map[1] > line) {
        break;
      }
      blocks.push(block);
    }

    if (blocks.length > 0) {
      // we need to figure out which language to execute. this is either the language
      // of the passed block (if any) or the language of the block immediately preceding
      // the line this is executed from
      const language = languageNameFromBlock(
        block || blocks[blocks.length - 1]
      );

      // accumulate code
      const code: string[] = [];
      for (const block of blocks.filter(
        isExecutableLanguageBlockOf(language)
      )) {
        code.push(block.content);
      }

      // execute
      await executeInteractive(language, code.join("\n"));
    }
  }
}

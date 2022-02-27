/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  ProviderResult,
  TextDocument,
  Range,
} from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import { languageNameFromBlock } from "../markdown/language";
import { blockHasExecutor, ensureExtensionLoaded } from "./executors";

export function quartoCellExecuteCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parseSync(document);
      const langauges: string[] = [];
      for (const block of tokens.filter(blockHasExecutor)) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }
        // create
        if (block.map) {
          // ensure any required extension is loaded
          const language = languageNameFromBlock(block);
          ensureExtensionLoaded(language, document, engine);

          // push code lens
          const range = new Range(block.map[0], 0, block.map[0], 0);
          lenses.push(
            ...[
              new CodeLens(range, {
                title: "Run Cell",
                tooltip: "Execute the code in this cell",
                command: "quarto.runCurrentCell",
                arguments: [block.map[0] + 1],
              }),
              new CodeLens(range, {
                title: "Run Lines",
                tooltip: "Execute the currently selected line(s)",
                command: "quarto.runLines",
              }),
            ]
          );
          if (langauges.includes(language)) {
            lenses.push(
              new CodeLens(range, {
                title: "Run Above",
                tooltip: "Execute the cells above this cell",
                command: "quarto.runCellsAbove",
                arguments: [block.map[0] + 1],
              })
            );
          }
          langauges.push(language);
        }
      }
      return lenses;
    },
  };
}

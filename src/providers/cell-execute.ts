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
  Position,
} from "vscode";
import { virtualDoc, virtualDocUri } from "../vdoc/vdoc";
import { MarkdownEngine } from "../markdown/engine";
import { isExecutableLanguageBlockOf } from "../markdown/language";

export function quartoCellExecuteCodeLensProvider(
  engine: MarkdownEngine
): CodeLensProvider {
  // one time forced init of python extension
  const pythonLoader = new PythonExtensionLoader(engine);

  return {
    provideCodeLenses(
      document: TextDocument,
      token: CancellationToken
    ): ProviderResult<CodeLens[]> {
      const lenses: CodeLens[] = [];
      const tokens = engine.parseSync(document);

      for (const block of tokens.filter(
        isExecutableLanguageBlockOf("python")
      )) {
        // respect cancellation request
        if (token.isCancellationRequested) {
          return [];
        }
        // create
        if (block.map) {
          // ensure python extension is loaded
          pythonLoader.ensureLoaded(document, block.map[0]);
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
        }
      }
      return lenses;
    },
  };
}

class PythonExtensionLoader {
  constructor(engine: MarkdownEngine) {
    this.engine_ = engine;
  }
  public ensureLoaded(document: TextDocument, pythonBlockBegin: number) {
    if (!this.loaded_) {
      this.loaded_ = true;
      virtualDoc(
        document,
        new Position(pythonBlockBegin + 1, 0),
        this.engine_
      ).then((vdoc) => {
        if (vdoc) {
          // this function executes a dummy hover request to activate the extension
          virtualDocUri(vdoc, document.uri).then(() => {});
        }
      });
    }
  }

  private loaded_ = false;
  private engine_: MarkdownEngine;
}

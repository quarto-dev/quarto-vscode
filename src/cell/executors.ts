/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Token from "markdown-it/lib/token";
import { commands, Position, TextDocument } from "vscode";
import { MarkdownEngine } from "../markdown/engine";
import {
  isExecutableLanguageBlockOf,
  languageNameFromBlock,
} from "../markdown/language";
import { virtualDoc, virtualDocUri } from "../vdoc/vdoc";

export function hasExecutor(language: string) {
  return !!kCellExecutors.find((x) => x.language === language);
}

export function blockHasExecutor(token?: Token) {
  if (token) {
    const language = languageNameFromBlock(token);
    return hasExecutor(language);
  } else {
    return false;
  }
}

export async function executeInteractive(
  language: string,
  code: string
): Promise<void> {
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor) {
    return await executor.execute(code);
  }
}

// ensure language extension is loaded (if required) by creating a
// virtual doc for the language (under the hood this triggers extension
// loading by sending a dummy hover-provider request)
const kLoadedExtensions: string[] = [];
export async function ensureExtensionLoaded(
  language: string,
  document: TextDocument,
  engine: MarkdownEngine
): Promise<void> {
  // only do this once per language
  if (!kLoadedExtensions.includes(language)) {
    const executor = kCellExecutors.find((x) => x.language === language);
    if (executor) {
      // mark language as being loaded
      kLoadedExtensions.push(executor.language);

      // load extension if necessary
      if (executor.usesExtension) {
        const tokens = await engine.parse(document);
        const languageBlock = tokens.find(
          isExecutableLanguageBlockOf(language)
        );
        if (languageBlock?.map) {
          const vdoc = await virtualDoc(
            document,
            new Position(languageBlock.map[0] + 1, 0),
            engine
          );
          if (vdoc) {
            await virtualDocUri(vdoc, document.uri);
          }
        }
      }
    }
  }
}

interface CellExecutor {
  language: string;
  usesExtension: boolean;
  execute: (code: string) => Promise<void>;
}

const pythonCellExecutor: CellExecutor = {
  language: "python",
  usesExtension: true,
  execute: async (code: string) => {
    await commands.executeCommand("jupyter.execSelectionInteractive", code);
  },
};

const kCellExecutors = [pythonCellExecutor];

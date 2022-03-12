/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: implement some terminal based executors
// (e.g. see https://github.com/JeepShen/vscode-markdown-code-runner)

import Token from "markdown-it/lib/token";
import { commands, extensions, Position, TextDocument, window } from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import {
  isExecutableLanguageBlock,
  isExecutableLanguageBlockOf,
  languageNameFromBlock,
} from "../../markdown/language";
import { virtualDoc, virtualDocUri } from "../../vdoc/vdoc";

export function hasExecutor(language: string) {
  return !!kCellExecutors.find((x) => x.language === language);
}

export function blockHasExecutor(token?: Token) {
  if (token) {
    const language = languageNameFromBlock(token);
    return isExecutableLanguageBlock(token) && hasExecutor(language);
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

export function validateRequiredExtension(language: string) {
  const executor = kCellExecutors.find((x) => x.language === language);
  if (executor?.requiredExtension) {
    return !!extensions.getExtension(executor?.requiredExtension);
  } else {
    return true;
  }
}

// ensure language extension is loaded (if required) by creating a
// virtual doc for the language (under the hood this triggers extension
// loading by sending a dummy hover-provider request)
const kLoadedExtensions: string[] = [];
export async function ensureRequiredExtension(
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
      if (executor.requiredExtension) {
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
  requiredExtension?: string;
  execute: (code: string) => Promise<void>;
}

const pythonCellExecutor: CellExecutor = {
  language: "python",
  requiredExtension: "ms-python.python",
  execute: async (code: string) => {
    await commands.executeCommand("jupyter.execSelectionInteractive", code);
  },
};

const rCellExecutor: CellExecutor = {
  language: "r",
  requiredExtension: "Ikuyadeu.r",
  execute: async (code: string) => {
    await commands.executeCommand("r.runSelection", code);
  },
};

const juliaCellExecutor: CellExecutor = {
  language: "julia",
  requiredExtension: "julialang.language-julia",
  execute: async (code: string) => {
    const extension = extensions.getExtension("julialang.language-julia");
    if (extension) {
      extension.exports.executeInREPL(code, {});
    } else {
      window.showErrorMessage("Unable to execute code in Julia REPL");
    }
  },
};

const kCellExecutors = [pythonCellExecutor, rCellExecutor, juliaCellExecutor];

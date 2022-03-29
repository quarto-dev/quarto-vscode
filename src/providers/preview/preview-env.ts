/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See KICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";
import { extensions, TextDocument, workspace } from "vscode";
import { MarkdownEngine } from "../../markdown/engine";
import { isExecutableLanguageBlockOf } from "../../markdown/language";

import { PreviewOutputSink } from "./preview-output";

export interface PreviewEnv {
  QUARTO_LOG: string;
  QUARTO_RENDER_TOKEN: string;
  QUARTO_PYTHON?: string;
  QUARTO_R?: string;
}

export function previewEnvsEqual(a?: PreviewEnv, b?: PreviewEnv) {
  return (
    a !== undefined &&
    b !== undefined &&
    a?.QUARTO_LOG === b?.QUARTO_LOG &&
    a?.QUARTO_RENDER_TOKEN === b?.QUARTO_RENDER_TOKEN &&
    a?.QUARTO_PYTHON === b?.QUARTO_PYTHON &&
    a?.QUARTO_R === b?.QUARTO_R
  );
}

export class PreviewEnvManager {
  constructor(
    outputSink: PreviewOutputSink,
    private readonly renderToken_: string,
    private readonly engine_: MarkdownEngine
  ) {
    this.outputFile_ = outputSink.outputFile();
  }

  public async previewEnv(doc: TextDocument) {
    // base env
    const env: PreviewEnv = {
      QUARTO_LOG: this.outputFile_,
      QUARTO_RENDER_TOKEN: this.renderToken_,
    };
    const tokens = await this.engine_.parse(doc);
    // add QUARTO_PYTHON if there are python code blocks
    if (tokens.find(isExecutableLanguageBlockOf("python"))) {
      const extension = extensions.getExtension("ms-python.python");
      if (extension) {
        if (!extension.isActive) {
          await extension.activate();
        }
        const execDetails = extension.exports.settings.getExecutionDetails(
          doc.uri
        );
        if (Array.isArray(execDetails?.execCommand)) {
          env.QUARTO_PYTHON = execDetails.execCommand[0];
        }
      }
    }
    // add QUARTO_R if there are R code blocks and the user has set a
    // custom r.rpath for this platform
    if (tokens.find(isExecutableLanguageBlockOf("r"))) {
      const extension = extensions.getExtension("Ikuyadeu.r");
      if (extension) {
        const rPath = workspace.getConfiguration("r.rpath", doc.uri);
        let quartoR: string | undefined;
        switch (os.platform()) {
          case "win32": {
            quartoR = rPath.get("windows");
            break;
          }
          case "darwin": {
            quartoR = rPath.get("mac");
            break;
          }
          case "linux": {
            quartoR = rPath.get("linux");
            break;
          }
        }
        if (quartoR) {
          env.QUARTO_R = quartoR;
        }
      }
    }
    return env;
  }
  private readonly outputFile_: string;
}

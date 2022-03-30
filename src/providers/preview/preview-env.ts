/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See KICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";
import { extensions, Uri, workspace } from "vscode";

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
    private readonly renderToken_: string
  ) {
    this.outputFile_ = outputSink.outputFile();
  }

  public async previewEnv(uri: Uri) {
    // get workspace for uri (if any)
    const workspaceFolder = workspace.getWorkspaceFolder(uri);

    // base env
    const env: PreviewEnv = {
      QUARTO_LOG: this.outputFile_,
      QUARTO_RENDER_TOKEN: this.renderToken_,
    };
    // QUARTO_PYTHON
    const pyExtension = extensions.getExtension("ms-python.python");
    if (pyExtension) {
      if (!pyExtension.isActive) {
        await pyExtension.activate();
      }

      const execDetails = pyExtension.exports.settings.getExecutionDetails(
        workspaceFolder?.uri
      );
      if (Array.isArray(execDetails?.execCommand)) {
        env.QUARTO_PYTHON = execDetails.execCommand[0];
      }
    }

    // QUARTO_R
    const rExtension = extensions.getExtension("Ikuyadeu.r");
    if (rExtension) {
      const rPath = workspace.getConfiguration("r.rpath", workspaceFolder?.uri);
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

    return env;
  }
  private readonly outputFile_: string;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import { ExecFileSyncOptions } from "child_process";

export interface QuartoContext {
  available: boolean;
  version: string;
  binPath: string;
  resourcePath: string;
  runQuarto: (options: ExecFileSyncOptions, ...args: string[]) => string;
  runPandoc: (options: ExecFileSyncOptions, ...args: string[]) => string;
}

export function initQuartoContext(
  quartoPath?: string,
  workspaceFolder?: string,
  showWarning?: (msg: string) => void
) {
  // default warning to log
  showWarning = showWarning || console.log;

  try {
    // resolve workspace relative paths
    if (quartoPath && !path.isAbsolute(quartoPath) && workspaceFolder) {
      quartoPath = path.join(workspaceFolder, quartoPath);
    }

    if (quartoPath) {
      if (!fs.existsSync(quartoPath)) {
        showWarning(
          "Unabled to find specified quarto executable: '" +
            quartoPath +
            ". Attemping to use quarto on the PATH."
        );
        quartoPath = "quarto";
      } else if (!fs.statSync(quartoPath).isFile()) {
        showWarning(
          "Specified quarto executable is a directory not a file: '" +
            quartoPath +
            "'. Attemping to use quarto on the PATH."
        );
        quartoPath = "quarto";
      }
    } else {
      quartoPath = "quarto";
    }

    // helper to run a program and capture its output
    const exec = (
      program: string,
      args: string[],
      options?: ExecFileSyncOptions
    ) => {
      return (
        child_process.execFileSync(program, args, {
          encoding: "utf-8",
          ...options,
        }) as unknown as string
      ).trim();
    };

    // discover quarto version and paths
    const version = exec(quartoPath, ["--version"]);
    const paths = exec(quartoPath, ["--paths"]).split(/\r?\n/);

    return {
      available: true,
      version,
      binPath: paths[0],
      resourcePath: paths[1],
      runQuarto: (options: ExecFileSyncOptions, ...args: string[]) =>
        exec(path.join(paths[0], "quarto"), args, options),
      runPandoc: (options: ExecFileSyncOptions, ...args: string[]) =>
        exec(path.join(paths[0], "tools", "pandoc"), args, options),
    };
  } catch (e) {
    console.log(
      "Unable to find quarto on system PATH. Some features disabled."
    );
    return {
      available: false,
      version: "",
      binPath: "",
      resourcePath: "",
      runQuarto: (_options: ExecFileSyncOptions, ..._args: string[]) => "",
      runPandoc: (_options: ExecFileSyncOptions, ..._args: string[]) => "",
    };
  }
}

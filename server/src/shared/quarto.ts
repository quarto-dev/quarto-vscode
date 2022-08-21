/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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
  workspaceFolder?: string
) {
  try {
    // resolve workspace relative paths
    if (quartoPath && !path.isAbsolute(quartoPath) && workspaceFolder) {
      quartoPath = path.join(workspaceFolder, quartoPath);
    }

    if (quartoPath) {
      if (!fs.existsSync(quartoPath)) {
        console.log("Unabled to find specified quarto binary '" + path + "'");
        quartoPath = "quarto";
      }
    } else {
      quartoPath = "quarto";
    }
    const shellCmd = (binary: string, ...args: string[]) => {
      const cmd = [shQuote(binary), ...args];
      const cmdText =
        os.platform() === "win32" ? `cmd /C"${cmd.join(" ")}"` : cmd.join(" ");
      return cmdText;
    };
    const runShellCmd = (
      binary: string,
      options: ExecFileSyncOptions,
      ...args: string[]
    ) => {
      return child_process.execSync(shellCmd(binary, ...args), {
        encoding: "utf-8",
        ...options,
      }) as unknown as string;
    };

    const runQuarto = (options: ExecFileSyncOptions, ...args: string[]) =>
      runShellCmd(quartoPath!, options, ...args);
    const version = runQuarto({}, "--version").trim();
    const paths = runQuarto({}, "--paths").split(/\r?\n/);

    // get the pandoc path
    const toolsDir = path.join(paths[0], "tools");
    const pandocBin = path.join(
      toolsDir,
      os.platform() === "win32" ? "pandoc.exe" : "pandoc"
    );
    const runPandoc = (options: ExecFileSyncOptions, ...args: string[]) =>
      runShellCmd(pandocBin, options, ...args);

    return {
      available: true,
      version,
      binPath: paths[0],
      resourcePath: paths[1],
      runQuarto,
      runPandoc,
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

function shQuote(value: string): string {
  if (os.platform() === "win32") {
    return value.replace(" ", "^ ");
  } else if (/\s/g.test(value)) {
    return `"${value}"`;
  } else {
    return value;
  }
}

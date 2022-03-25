/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";

export interface QuartoContext {
  available: boolean;
  version: string;
  binPath: string;
  resourcePath: string;
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
    const quartoCmd = (...args: string[]) => {
      const cmd = [shQuote(quartoPath!), ...args];
      const cmdText =
        os.platform() === "win32" ? `cmd /C"${cmd.join(" ")}"` : cmd.join(" ");
      return cmdText;
    };

    const version = (
      child_process.execSync(quartoCmd("--version"), {
        encoding: "utf-8",
      }) as unknown as string
    ).trim();
    const paths = (
      child_process.execSync(quartoCmd("--paths"), {
        encoding: "utf-8",
      }) as unknown as string
    ).split(/\r?\n/);
    return {
      available: true,
      version,
      binPath: paths[0],
      resourcePath: paths[1],
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
    };
  }
}

function shQuote(value: string): string {
  return `"${value}"`;
}

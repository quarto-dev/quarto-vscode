/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from "child_process";

export interface QuartoContext {
  available: boolean;
  version: string;
  binPath: string;
  resourcePath: string;
}

export function initQuartoContext() {
  try {
    const version = (
      child_process.execSync("quarto --version", {
        encoding: "utf-8",
      }) as unknown as string
    ).trim();
    const paths = (
      child_process.execSync("quarto --paths", {
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

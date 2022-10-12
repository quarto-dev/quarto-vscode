/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";

export function createFirstRun(projectDir: string, openFiles: string[]) {
  openFiles = openFiles.map((file) =>
    file.replace("$(dirname)", path.basename(projectDir))
  );
  fs.writeFileSync(firstRunFile(projectDir), openFiles.join("\n"), {
    encoding: "utf-8",
  });
}

export function collectFirstRun(projectDir: string): string[] {
  const firstRun = firstRunFile(projectDir);
  if (fs.existsSync(firstRun)) {
    const files = fs.readFileSync(firstRun, { encoding: "utf-8" }).split("\n");
    fs.unlinkSync(firstRun);
    return files;
  } else {
    return [];
  }
}

function firstRunFile(projectDir: string) {
  const kQuartoFirstRun = ".quarto-firstrun";
  return path.join(projectDir, kQuartoFirstRun);
}

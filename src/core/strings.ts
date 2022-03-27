/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from "os";

export function escapeRegExpCharacters(value: string): string {
  return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, "\\$&");
}

export function shQuote(value: string): string {
  if (os.platform() === "win32") {
    return value.replace(" ", "^ ");
  } else if (/\s/g.test(value)) {
    return `"${value}"`;
  } else {
    return value;
  }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function isRStudioWorkbench() {
  // RS_SERVER_URL e.g. https://daily-rsw.soleng.rstudioservices.com/
  // RS_SESSION_URL e.g. /s/eae053c9ab5a71168ee19/
  return process.env.RS_SERVER_URL && process.env.RS_SESSION_URL;
}

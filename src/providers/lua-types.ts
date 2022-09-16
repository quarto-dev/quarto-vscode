/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import { ExtensionContext, workspace, extensions } from "vscode";
import { QuartoContext } from "../shared/quarto";
import { ensureGitignore } from "../core/git";

export async function activateLuaTypes(
  context: ExtensionContext,
  quartoContext: QuartoContext
) {
  // check pref to see if we are syncing types
  const config = workspace.getConfiguration("quarto");
  if (config.get("lua.provideTypes") === false) {
    return;
  }

  // compute path to .luarc.json
  const luarc = workspace.workspaceFolders
    ? path.join(workspace.workspaceFolders[0].uri.fsPath, ".luarc.json")
    : undefined;
  if (!luarc) {
    return;
  }

  // first check for the lua extension
  const luaExtension = extensions.getExtension("sumneko.lua");
  if (luaExtension === undefined) {
    return;
  }

  // TODO: prompt for install?

  // check for glob in workspace
  const workspaceHasFile = async (glob: string) => {
    const kExclude = "**/{node_modules,renv,packrat,venv,env}/**";
    return (await workspace.findFiles(glob, kExclude, 10)).length > 0;
  };

  // check if we have quarto files
  if (
    (await workspaceHasFile("**/*.qmd")) ||
    (await workspaceHasFile("**/_quarto.{yml,yaml}")) ||
    (await workspaceHasFile("**/_extension.{yml,yaml}"))
  ) {
    if (await workspaceHasFile("**/*.lua")) {
      syncLuaTypes(quartoContext, luarc);
    } else {
      const handler = workspace.onDidOpenTextDocument(
        (e) => {
          if (path.extname(e.fileName) === ".lua") {
            if (workspace.asRelativePath(e.fileName) !== e.fileName) {
              syncLuaTypes(quartoContext, luarc);
              handler.dispose();
            }
          }
        },
        null,
        context.subscriptions
      );
    }
  }
}

function syncLuaTypes(quartoContext: QuartoContext, luarc: string) {
  // constants
  const kGenerator = "Generator";
  const kWorkspaceLibrary = "Lua.workspace.library";

  // determine the path to the quarto lua types (bail if we don't have it)
  const luaTypesDir = path.join(quartoContext.resourcePath, "lua-types");
  if (!fs.existsSync(luaTypesDir) || !fs.statSync(luaTypesDir).isDirectory()) {
    return;
  }

  // if there are Lua libraries in the workspace then bail
  const luaConfig = workspace.getConfiguration("Lua");
  const inspectLibrary = luaConfig.inspect("workspace.library");
  if (inspectLibrary?.workspaceValue || inspectLibrary?.workspaceFolderValue) {
    return;
  }

  // read base luarc (provide default if there is none)
  const kDefaultLuaRc = {
    [kGenerator]: [
      "Quarto",
      "Quarto will automatically update Lua.workspace.library to reflect the current path",
      "of your Quarto installation. This file will also be automatically added to .gitignore",
      "(remove the 'Generator' option to manage this manually).",
    ],
    "Lua.diagnostics.disable": ["lowercase-global"],
    "Lua.runtime.version": "Lua 5.3",
    "Lua.workspace.checkThirdParty": false,
    [kWorkspaceLibrary]: [],
  };
  const luarcJson = (
    fs.existsSync(luarc)
      ? JSON.parse(fs.readFileSync(luarc, { encoding: "utf-8" }))
      : kDefaultLuaRc
  ) as Record<string, unknown>;

  // if there is no generator then leave it alone
  if (luarcJson[kGenerator] === undefined) {
    return;
  }

  // if the current workspace library is out of sync then change it and re-write
  if (
    JSON.stringify(luarcJson[kWorkspaceLibrary]) !==
    JSON.stringify([luaTypesDir])
  ) {
    // write the file
    luarcJson[kWorkspaceLibrary] = [luaTypesDir];
    fs.writeFileSync(luarc, JSON.stringify(luarcJson, undefined, 2));
  }

  // ensure gitignore
  ensureGitignore(path.dirname(luarc), ["/" + path.basename(luarc)]);
}

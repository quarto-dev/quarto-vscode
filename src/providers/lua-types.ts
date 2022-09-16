/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import {
  ExtensionContext,
  workspace,
  extensions,
  commands,
  window,
  MessageItem,
} from "vscode";
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

  // if we aren't prompting to install the lua extension then
  // check for it and bail if its not there
  if (!isLuaLspInstalled() && !canPromptForLuaLspInstall(context)) {
    return;
  }

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
      await syncLuaTypes(context, quartoContext, luarc);
    } else {
      const handler = workspace.onDidOpenTextDocument(
        async (e) => {
          if (path.extname(e.fileName) === ".lua") {
            if (workspace.asRelativePath(e.fileName) !== e.fileName) {
              await syncLuaTypes(context, quartoContext, luarc);
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

async function syncLuaTypes(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  luarc: string
) {
  // if we don't have the extension that see if we should prompt to install it
  if (!isLuaLspInstalled() && canPromptForLuaLspInstall(context)) {
    const install: MessageItem = { title: "Install Lua LSP" };
    const neverInstall: MessageItem = { title: "Don't Prompt Again" };
    const result = await window.showInformationMessage<MessageItem>(
      "Quarto can provide completion and diagnostics for Lua scripts if the Lua LSP extension is installed. Do you want to install it now?",
      install,
      neverInstall
    );
    if (result === install) {
      await commands.executeCommand(
        "workbench.extensions.installExtension",
        "sumneko.lua"
      );
    } else {
      if (result === neverInstall) {
        preventPromptForLspInstall(context);
      }
      return;
    }
  }

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

const kPromptForLuaLspInstall = "quarto.lua.promptLspInstall";

function isLuaLspInstalled() {
  return extensions.getExtension("sumneko.lua") !== undefined;
}

function canPromptForLuaLspInstall(context: ExtensionContext) {
  return context.workspaceState.get<boolean>(kPromptForLuaLspInstall) !== false;
}

function preventPromptForLspInstall(context: ExtensionContext) {
  context.workspaceState.update(kPromptForLuaLspInstall, false);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See KICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";

import { TextDocument, Uri, workspace } from "vscode";
import { parseFrontMatterStr } from "../../core/yaml";
import { MarkdownEngine } from "../../markdown/engine";

export function previewDirForDocument(uri: Uri) {
  // first check for a quarto project
  const projectDir = projectDirForDocument(uri);
  if (projectDir) {
    return projectDir;
  } else {
    // now check if we are within a workspace root
    const workspaceDir = workspace.getWorkspaceFolder(uri);
    if (workspaceDir) {
      return workspaceDir.uri.fsPath;
    }
  }
  return undefined;
}

export function projectDirForDocument(uri: Uri) {
  let dir = path.dirname(uri.fsPath);
  while (true) {
    if (hasQuartoProject(dir)) {
      return dir;
    } else {
      const nextDir = path.dirname(dir);
      if (nextDir !== dir) {
        dir = nextDir;
      } else {
        break;
      }
    }
  }
  return undefined;
}

export function hasQuartoProject(dir?: string) {
  if (dir) {
    return (
      fs.existsSync(path.join(dir, "_quarto.yml")) ||
      fs.existsSync(path.join(dir, "_quarto.yaml"))
    );
  } else {
    return false;
  }
}

export async function isQuartoShinyDoc(
  engine: MarkdownEngine,
  doc?: TextDocument
) {
  if (doc) {
    const frontMatter = await documentFrontMatter(engine, doc);
    if (frontMatter["server"] === "shiny") {
      return true;
    } else {
      if (typeof frontMatter["server"] === "object") {
        return (
          (frontMatter["server"] as Record<string, unknown>)["type"] === "shiny"
        );
      }
    }
    return false;
  } else {
    return false;
  }
}

export async function documentFrontMatter(
  engine: MarkdownEngine,
  doc: TextDocument
): Promise<Record<string, unknown>> {
  const tokens = await engine.parse(doc);
  const yaml = tokens.find((token) => token.type === "front_matter");
  if (yaml) {
    const frontMatter = parseFrontMatterStr(yaml.markup);
    if (typeof frontMatter === "object") {
      return frontMatter as Record<string, unknown>;
    } else {
      return {};
    }
  } else {
    return {};
  }
}

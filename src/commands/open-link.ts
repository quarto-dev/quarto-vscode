/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { Command } from "../core/command";
import { MarkdownEngine } from "../markdown/engine";

import { MarkdownTableOfContents } from "../markdown/toc";
import { isQuartoDoc } from "../core/doc";
import { extname } from "../core/path";

export class OpenLinkCommand implements Command {
  private static readonly id = "_quarto.openLink";
  public readonly id = OpenLinkCommand.id;

  public static createCommandUri(
    fromResource: vscode.Uri,
    path: vscode.Uri,
    fragment: string
  ): vscode.Uri {
    const toJson = (uri: vscode.Uri): UriComponents => {
      return {
        scheme: uri.scheme,
        authority: uri.authority,
        path: uri.path,
        fragment: uri.fragment,
        query: uri.query,
      };
    };
    return vscode.Uri.parse(
      `command:${OpenLinkCommand.id}?${encodeURIComponent(
        JSON.stringify(<OpenLinkArgs>{
          parts: toJson(path),
          fragment,
          fromResource: toJson(fromResource),
        })
      )}`
    );
  }

  public constructor(private readonly engine: MarkdownEngine) {}

  public async execute(args: OpenLinkArgs) {
    const fromResource = vscode.Uri.parse("").with(args.fromResource);
    const targetResource = reviveUri(args.parts).with({
      fragment: args.fragment,
    });
    return openDocumentLink(this.engine, targetResource, fromResource);
  }
}

function reviveUri(parts: any) {
  if (parts.scheme === "file") {
    return vscode.Uri.file(parts.path);
  }
  return vscode.Uri.parse("").with(parts);
}

type UriComponents = {
  readonly scheme?: string;
  readonly path: string;
  readonly fragment?: string;
  readonly authority?: string;
  readonly query?: string;
};

interface OpenLinkArgs {
  readonly parts: UriComponents;
  readonly fragment: string;
  readonly fromResource: UriComponents;
}

enum OpenMarkdownLinks {
  beside = "beside",
  currentGroup = "currentGroup",
}

export async function openDocumentLink(
  engine: MarkdownEngine,
  targetResource: vscode.Uri,
  fromResource: vscode.Uri
): Promise<void> {
  const column = getViewColumn(fromResource);

  if (await tryNavigateToFragmentInActiveEditor(engine, targetResource)) {
    return;
  }

  let targetResourceStat: vscode.FileStat | undefined;
  try {
    targetResourceStat = await vscode.workspace.fs.stat(targetResource);
  } catch {
    // noop
  }

  if (typeof targetResourceStat === "undefined") {
    // We don't think the file exists. If it doesn't already have an extension, try tacking on a `.qmd` and using that instead
    if (extname(targetResource.path) === "") {
      const dotMdResource = targetResource.with({
        path: targetResource.path + ".md",
      });
      try {
        const stat = await vscode.workspace.fs.stat(dotMdResource);
        if (stat.type === vscode.FileType.File) {
          await tryOpenMdFile(engine, dotMdResource, column);
          return;
        }
      } catch {
        // noop
      }
    }
  } else if (targetResourceStat.type === vscode.FileType.Directory) {
    return vscode.commands.executeCommand("revealInExplorer", targetResource);
  }

  await tryOpenMdFile(engine, targetResource, column);
}

async function tryOpenMdFile(
  engine: MarkdownEngine,
  resource: vscode.Uri,
  column: vscode.ViewColumn
): Promise<boolean> {
  await vscode.commands.executeCommand(
    "vscode.open",
    resource.with({ fragment: "" }),
    column
  );
  return tryNavigateToFragmentInActiveEditor(engine, resource);
}

async function tryNavigateToFragmentInActiveEditor(
  engine: MarkdownEngine,
  resource: vscode.Uri
): Promise<boolean> {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document.uri.fsPath === resource.fsPath) {
    if (isQuartoDoc(activeEditor.document)) {
      if (
        await tryRevealLineUsingTocFragment(
          engine,
          activeEditor,
          resource.fragment
        )
      ) {
        return true;
      }
    }
    tryRevealLineUsingLineFragment(activeEditor, resource.fragment);
    return true;
  }
  return false;
}

function getViewColumn(resource: vscode.Uri): vscode.ViewColumn {
  const config = vscode.workspace.getConfiguration("markdown", resource);
  const openLinks = config.get<OpenMarkdownLinks>(
    "links.openLocation",
    OpenMarkdownLinks.currentGroup
  );
  switch (openLinks) {
    case OpenMarkdownLinks.beside:
      return vscode.ViewColumn.Beside;
    case OpenMarkdownLinks.currentGroup:
    default:
      return vscode.ViewColumn.Active;
  }
}

async function tryRevealLineUsingTocFragment(
  engine: MarkdownEngine,
  editor: vscode.TextEditor,
  fragment: string
): Promise<boolean> {
  const toc = await MarkdownTableOfContents.create(engine, editor.document);
  const entry = toc.lookup(fragment);
  if (entry) {
    const lineStart = new vscode.Range(entry.line, 0, entry.line, 0);
    editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
    editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
    return true;
  }
  return false;
}

function tryRevealLineUsingLineFragment(
  editor: vscode.TextEditor,
  fragment: string
): boolean {
  const lineNumberFragment = fragment.match(/^L(\d+)$/i);
  if (lineNumberFragment) {
    const line = +lineNumberFragment[1] - 1;
    if (!isNaN(line)) {
      const lineStart = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
      editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
      return true;
    }
  }
  return false;
}

export async function resolveUriToQuartoFile(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  try {
    const doc = await tryResolveUriToQuartoFile(resource);
    if (doc) {
      return doc;
    }
  } catch {
    // Noop
  }

  // If no extension, try with `.qmd` extension
  if (extname(resource.path) === "") {
    return tryResolveUriToQuartoFile(
      resource.with({ path: resource.path + ".qmd" })
    );
  }

  return undefined;
}

async function tryResolveUriToQuartoFile(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(resource);
  } catch {
    return undefined;
  }
  if (isQuartoDoc(document)) {
    return document;
  }
  return undefined;
}

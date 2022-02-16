/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LLICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { MarkdownEngine } from "./engine";
import { isQuartoFile } from "../core/file";
import { pandocAutoIdentifier } from "./auto-id";
import { MarkdownTextDocument } from "./document";

export interface TocEntry {
  readonly slug: string;
  readonly text: string;
  readonly level: number;
  readonly line: number;
  readonly location: vscode.Location;
}

export class MarkdownTableOfContents {
  public static async create(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<MarkdownTableOfContents> {
    const entries = await this.buildToc(engine, document);
    return new MarkdownTableOfContents(entries);
  }

  public static async createForDocumentOrNotebook(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<MarkdownTableOfContents> {
    if (document.uri.scheme === "vscode-notebook-cell") {
      const notebook = vscode.workspace.notebookDocuments.find((notebook) =>
        notebook.getCells().some((cell) => cell.document === document)
      );

      if (notebook) {
        const entries: TocEntry[] = [];

        for (const cell of notebook.getCells()) {
          if (
            cell.kind === vscode.NotebookCellKind.Markup &&
            isQuartoFile(cell.document)
          ) {
            entries.push(...(await this.buildToc(engine, cell.document)));
          }
        }

        return new MarkdownTableOfContents(entries);
      }
    }

    return this.create(engine, document);
  }

  private constructor(public readonly entries: readonly TocEntry[]) {}

  public lookup(fragment: string): TocEntry | undefined {
    const slug = pandocAutoIdentifier(fragment, false);
    return this.entries.find((entry) => entry.slug === slug);
  }

  private static async buildToc(
    engine: MarkdownEngine,
    document: MarkdownTextDocument
  ): Promise<TocEntry[]> {
    const toc: TocEntry[] = [];
    const tokens = await engine.parse(document);

    const existingSlugEntries = new Map<string, { count: number }>();

    for (const heading of tokens.filter(
      (token) => token.type === "heading_open"
    )) {
      if (!heading.map) {
        continue;
      }

      const lineNumber = heading.map[0];
      const line = document.lineAt(lineNumber);

      let slug = pandocAutoIdentifier(line.text);
      const existingSlugEntry = existingSlugEntries.get(slug);
      if (existingSlugEntry) {
        ++existingSlugEntry.count;
        slug = pandocAutoIdentifier(slug + "-" + existingSlugEntry.count);
      } else {
        existingSlugEntries.set(slug, { count: 0 });
      }

      toc.push({
        slug,
        text: MarkdownTableOfContents.getHeaderText(line.text),
        level: MarkdownTableOfContents.getHeaderLevel(heading.markup),
        line: lineNumber,
        location: new vscode.Location(
          document.uri,
          new vscode.Range(lineNumber, 0, lineNumber, line.text.length)
        ),
      });
    }

    // Get full range of section
    return toc.map((entry, startIndex): TocEntry => {
      let end: number | undefined = undefined;
      for (let i = startIndex + 1; i < toc.length; ++i) {
        if (toc[i].level <= entry.level) {
          end = toc[i].line - 1;
          break;
        }
      }
      const endLine = end ?? document.lineCount - 1;
      return {
        ...entry,
        location: new vscode.Location(
          document.uri,
          new vscode.Range(
            entry.location.range.start,
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
          )
        ),
      };
    });
  }

  private static getHeaderLevel(markup: string): number {
    if (markup === "=") {
      return 1;
    } else if (markup === "-") {
      return 2;
    } else {
      // '#', '##', ...
      return markup.length;
    }
  }

  private static getHeaderText(header: string): string {
    return header.replace(/^\s*#+\s*(.*?)(\s+#+)?$/, (_, word) => word.trim());
  }
}

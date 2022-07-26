/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

import { quarto } from "../../../quarto/quarto";
import { shQuote } from "../../../shared/strings";

export async function biblioCompletions(
  token: string,
  frontMatter: Record<string, unknown>,
  docPath: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  // see if we can resolve some bibliographies
  const dir = path.dirname(docPath);
  const bibliographies = bibliographyOption(frontMatter["bibliography"])
    .map((biblio) => {
      return path.normalize(path.join(dir, biblio));
    })
    .filter(fs.existsSync);

  if (bibliographies.length > 0) {
    return [];
  } else {
    return null;
  }
}

type BiblioRef = {
  id: string;
  title?: string;
};

type BiblioFile = {
  path: string;
  cached: number;
  refs: BiblioRef[];
};

const biblioFiles = new Map<string, BiblioFile>();

function biblioFile(path: string) {
  // check cache
  const mtimeMs = fs.statSync(path).mtimeMs;
  if (
    !biblioFiles.has(path) ||
    (biblioFiles.get(path)?.cached || 0) < mtimeMs
  ) {
    // call pandoc to get refs
    const args = [shQuote(path)];
    args.push(...pandocBiblioArgsForFile(path));
    args.push("--to");
    args.push("csljson");
    const output = quarto?.runPandoc(args);

    const refs: BiblioRef[] = [];

    // yaml is --from markdown
    // json is --from csljson
    // bib is nothing

    // update cache
    biblioFiles.set(path, {
      path,
      cached: mtimeMs,
      refs,
    });
  }
  return biblioFiles.get(path);
}

function bibliographyOption(option: unknown): string[] {
  if (typeof option === "string") {
    return [option];
  } else if (Array.isArray(option)) {
    return option.map((value) => String(value));
  } else {
    return [];
  }
}

function pandocBiblioArgsForFile(biblioFile: string) {
  const ext = path.extname(biblioFile).toLowerCase();
  if (ext === ".yml" || ext === ".yaml") {
    return ["--from", "markdown"];
  } else if (ext === "json") {
    return ["--from", "csljson"];
  } else {
    return [];
  }
}

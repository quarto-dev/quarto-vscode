/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import * as yaml from "js-yaml";

import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";

import { quarto } from "../../../quarto/quarto";
import { shQuote } from "../../../shared/strings";
import { metadataFilesForDocument } from "../../../core/doc";

export async function biblioCompletions(
  token: string,
  frontMatter: Record<string, unknown>,
  docPath: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  // bibliography in document metadata
  const dir = path.dirname(docPath);
  const bibliographies = bibliographyOption(frontMatter["bibliography"])
    .map((biblio) => {
      return path.normalize(path.join(dir, biblio));
    })
    .filter(fs.existsSync);

  // bibliographies from project/dir level metadata
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(docPath);
    if (metadataFiles) {
      metadataFiles.forEach((file) => {
        bibliographies.push(...bibliographiesFromMetadataFile(file));
      });
    }
  }

  if (bibliographies.length > 0) {
    return bibliographies.reduce((refs, file) => {
      const bibFile = biblioFile(file);
      if (bibFile) {
        bibFile.refs.forEach((ref) => {
          if (!refs.find((x) => x.label === ref.id)) {
            refs.push({
              kind: CompletionItemKind.Function,
              label: ref.id,
              detail: ref.title,
            });
          }
        });
      }
      return refs;
    }, new Array<CompletionItem>());
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
    quarto &&
    (!biblioFiles.has(path) || (biblioFiles.get(path)?.cached || 0) < mtimeMs)
  ) {
    // call pandoc to get refs
    const refs: BiblioRef[] = [];
    const args = [shQuote(path)];
    args.push(...pandocBiblioArgsForFile(path));
    args.push("--to");
    args.push("csljson");
    try {
      const output = quarto.runPandoc(...args);
      refs.push(...(JSON.parse(output) as BiblioRef[]));
    } catch (err) {
      console.log("Error reading bibliography:");
      console.error(err);
    }

    // update cache
    biblioFiles.set(path, {
      path,
      cached: mtimeMs,
      refs,
    });
  }
  return biblioFiles.get(path);
}

function bibliographiesFromMetadataFile(file: string): string[] {
  const yamlSrc = fs.readFileSync(file, "utf-8");
  try {
    const yamlOpts = yaml.load(yamlSrc) as Record<string, unknown>;
    return bibliographyOption(yamlOpts["bibliography"]);
  } catch (err) {
    console.error(err);
    return [];
  }
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

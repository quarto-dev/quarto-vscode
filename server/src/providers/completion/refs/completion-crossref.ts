/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExecFileSyncOptions } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
tmp.setGracefulCleanup();

import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";

import { quarto } from "../../../quarto/quarto";

export async function crossrefCompletions(
  token: string,
  code: string,
  filePath: string,
  projectDir?: string
): Promise<CompletionItem[] | null> {
  // index the crossrefs using our crossref lua filter

  const xrefs = indexSourceFile(code, path.basename(filePath));

  return xrefs.map(xrefCompletion(!!projectDir));
}

const kFile = "file";
const kType = "type";
const kId = "id";
const kSuffix = "suffix";
const kTitle = "title";

type XRef = {
  [kFile]: string;
  [kType]: string;
  [kId]: string;
  [kSuffix]: string;
  [kTitle]: string;
};

let xrefIndexingDir: string | undefined;

function indexSourceFile(code: string, filename: string): XRef[] {
  // setup the indexing dir if we need to
  if (!xrefIndexingDir) {
    // create dir
    xrefIndexingDir = tmp.dirSync().name;

    // write defaults file
    const defaultsFile = path.join(xrefIndexingDir, "defaults.yml");
    const filtersPath = path.join(quarto!.resourcePath, "filters");
    const defaults = `
from: markdown
to: native
data-dir: "${path.join(quarto!.resourcePath, "pandoc", "datadir")}"
filters:
  - "${path.join(filtersPath, "quarto-init", "quarto-init.lua")}"
  - "${path.join(filtersPath, "crossref", "crossref.lua")}"    
`;
    fs.writeFileSync(defaultsFile, defaults, { encoding: "utf-8" });
  }

  // create filter params
  const filterParams = Buffer.from(
    JSON.stringify({
      ["crossref-index-file"]: "index.json",
      ["crossref-input-type"]: "qmd",
    }),
    "utf8"
  ).toString("base64");

  // setup options for calling pandoc
  const options: ExecFileSyncOptions = {
    input: code,
    cwd: xrefIndexingDir,
    env: {
      QUARTO_FILTER_PARAMS: filterParams,
      QUARTO_SHARE_PATH: quarto!.resourcePath,
    },
  };

  // call pandoc
  const result = quarto!.runPandoc(options, "--defaults", "defaults.yml");
  if (result) {
    return readXRefIndex(path.join(xrefIndexingDir, "index.json"), filename);
  } else {
    return [];
  }
}

function readXRefIndex(indexPath: string, filename: string) {
  const xrefs: XRef[] = [];
  const indexJson = fs.readFileSync(indexPath, { encoding: "utf-8" });
  const index = JSON.parse(indexJson) as {
    entries: Array<{ key: string; caption?: string }>;
  };
  for (const entry of index.entries) {
    const match = entry.key.match(/^(\w+)-(.*?)(-\d+)?$/);
    if (match) {
      xrefs.push({
        [kFile]: filename,
        [kType]: match[1],
        [kId]: match[2],
        [kSuffix]: match[3] || "",
        [kTitle]: entry.caption || "",
      });
    }
  }
  return xrefs;
}

function xrefCompletion(includeFilename: boolean) {
  return (xref: XRef): CompletionItem => ({
    kind: CompletionItemKind.Function,
    label: `${xref[kType]}-${xref.id}${
      xref[kSuffix] ? "-" + xref[kSuffix] : ""
    }`,
    documentation: xref[kTitle]
      ? {
          kind: MarkupKind.Markdown,
          value:
            xref[kTitle] + (includeFilename ? " — _" + xref[kFile] + "_" : ""),
        }
      : undefined,
  });
}

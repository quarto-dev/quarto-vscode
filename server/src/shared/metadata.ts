/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import path from "path";
import fs from "fs";

import * as yaml from "js-yaml";

export function parseFrontMatterStr(str: string) {
  str = str.replace(/---\s*$/, "");
  try {
    return yaml.load(str);
  } catch (error) {
    return undefined;
  }
}

export function projectDirForDocument(doc: string) {
  let dir = path.dirname(doc);
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

export function metadataFilesForDocument(doc: string) {
  const files: string[] = [];

  let dir = path.dirname(doc);
  while (true) {
    if (hasQuartoProject(dir)) {
      files.push(
        ...["_quarto.yml", "_quarto.yaml"]
          .map((file) => path.join(dir, file))
          .filter(fs.existsSync)
      );
      return files;
    } else {
      files.push(
        ...["_metadata.yml", "_metadata.yaml"]
          .map((file) => path.join(dir, file))
          .filter(fs.existsSync)
      );
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

export function yamlFromMetadataFile(file: string): Record<string, unknown> {
  const yamlSrc = fs.readFileSync(file, "utf-8");
  try {
    if (yamlSrc.trim().length > 0) {
      const yamlOpts = yaml.load(yamlSrc) as Record<string, unknown>;
      return yamlOpts;
    }
  } catch (err) {
    console.error(err);
  }
  return {};
}

export function quartoProjectConfig(dir: string): { [key: string]: any } {
  for (const config of ["_quarto.yml", "_quarto.yaml"]) {
    const configFile = path.join(dir, config);
    if (fs.existsSync(configFile)) {
      const yamlSrc = fs.readFileSync(configFile, "utf-8");
      if (yamlSrc.trim().length > 0) {
        const yamlOpts = yaml.load(yamlSrc) as { [key: string]: any };
        return yamlOpts;
      }
    }
  }
  return {};
}

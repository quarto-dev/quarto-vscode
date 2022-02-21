/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import Token from "markdown-it/lib/token";
import { Position } from "vscode";

export function isEmbeddedContentLanguage(langauge: string) {
  const kEmbeddedContentLanguages = [
    "html",
    "css",
    "ts",
    "typescript",
    "js",
    "javascript",
  ];
  return kEmbeddedContentLanguages.includes(langauge);
}

export function extensionForLanguage(language: string) {
  switch (language) {
    case "python":
      return "py";
    case "ruby":
      return "rb";
    case "typescript":
      return "ts";
    case "javascript":
      return "js";
    case "html":
      return "html";
    case "sql":
      return "sql";
    case "r":
      return "r";
    case "css":
      return "css";
    case "cpp":
    case "rcpp":
      return "cpp";
    case "go":
      return "go";
    case "java":
      return "java";
    case "latex":
    case "tex":
      return "tex";
    case "rust":
      return "rs";
    default:
      return language;
  }
}

export function languageAtPosition(tokens: Token[], position: Position) {
  for (const fencedCode of tokens.filter(isFencedCode)) {
    if (
      fencedCode.map &&
      position.line > fencedCode.map[0] &&
      position.line <= fencedCode.map[1]
    ) {
      return languageFromFenceToken(fencedCode);
    }
  }
  return undefined;
}

export function languageFromFenceToken(token: Token) {
  return token.info.replace(/^[^\w]*/, "").replace(/[^\w]$/, "");
}

export function isFencedCode(token: Token) {
  return token.type === "fence";
}

export function isFencedCodeOf(language: string) {
  return (token: Token) => {
    return isFencedCode(token) && languageFromFenceToken(token) === language;
  };
}

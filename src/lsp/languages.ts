/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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

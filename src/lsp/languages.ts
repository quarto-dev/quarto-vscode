/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

export interface EmbeddedLanguage {
  ids: string[];
  extension: string;
  type: "content" | "tempfile";
  trigger?: string[];
  inject?: string;
}

export function embeddedLanguage(langauge: string) {
  return kEmbededLanguages.find((lang) => lang.ids.includes(langauge));
}

const kEmbededLanguages = [
  defineLanguage("python", { ext: "py", inject: "# type: ignore" }),
  defineLanguage("r"),
  defineLanguage("juila", { ext: "jl" }),
  defineLanguage(["tex", "latex"]),
  defineLanguage("html", { type: "content" }),
  defineLanguage("sql"),
  defineLanguage("bash", { ext: "sh" }),
  defineLanguage("css", { type: "content" }),
  defineLanguage(["cpp"]),
  defineLanguage(["ts", "typescript"], { ext: "ts", type: "content" }),
  defineLanguage(["js", "javascript", "d3"], { ext: "js", type: "content" }),
  defineLanguage("jsx"),
  defineLanguage("ruby", { ext: "rb" }),
  defineLanguage("rust", { ext: "rs" }),
  defineLanguage("java"),
  defineLanguage("go"),
  defineLanguage("cpp"),
];

interface LanguageOptions {
  ext?: string;
  type?: "content" | "tempfile";
  trigger?: string[];
  inject?: string;
}

function defineLanguage(
  language: string | string[],
  options?: LanguageOptions
) {
  language = Array.isArray(language) ? language : [language];
  return {
    ids: language,
    extension: options?.ext || language[0],
    type: options?.type || "tempfile",
    trigger: options?.trigger,
    inject: options?.inject,
  };
}

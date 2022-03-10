/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Token from "markdown-it/lib/token";

export function isLanguageBlock(token: Token) {
  return isFencedCode(token) || isDisplayMath(token);
}

// a language block that will be executed with its results
// inclued in the document (either by an engine or because
// it is a raw or display math block)
export function isExecutableLanguageBlock(token: Token) {
  return (
    (isFencedCode(token) &&
      token.info.match(/^\{=?([a-zA-Z0-9_]+)(?: *[ ,].*?)?\}$/)) ||
    isDisplayMath(token)
  );
}

export function isFencedCode(token: Token) {
  return token.type === "fence";
}

export function isDisplayMath(token: Token) {
  return token.type === "math_block";
}

export function languageNameFromBlock(token: Token) {
  if (isDisplayMath(token)) {
    return "tex";
  } else {
    const name = token.info.replace(/^[^\w]*/, "").replace(/[^\w]$/, "");
    return name;
  }
}

export function isExecutableLanguageBlockOf(language: string) {
  return (token: Token) => {
    return (
      isExecutableLanguageBlock(token) &&
      languageNameFromBlock(token) === language
    );
  };
}

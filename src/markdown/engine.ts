/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MarkdownIt = require("markdown-it");
import Token = require("markdown-it/lib/token");
import * as vscode from "vscode";
import { MarkdownTextDocument } from "./document";

const UNICODE_NEWLINE_REGEX = /\u2028|\u2029/g;

export class MarkdownEngine {
  private md?: Promise<MarkdownIt>;

  private _tokenCache = new TokenCache();

  public constructor() {}

  public async parse(document: MarkdownTextDocument): Promise<Token[]> {
    const engine = await this.getEngine();
    return this.tokenizeDocument(document, engine);
  }

  public cleanCache(): void {
    this._tokenCache.clean();
  }

  private async getEngine(): Promise<MarkdownIt> {
    if (!this.md) {
      this.md = (async () => {
        const markdownIt = await import("markdown-it");
        return markdownIt.default();
      })();
    }

    const md = await this.md!;
    return md;
  }

  private tokenizeDocument(
    document: MarkdownTextDocument,
    engine: MarkdownIt
  ): Token[] {
    const cached = this._tokenCache.tryGetCached(document);
    if (cached) {
      return cached;
    }

    const tokens = this.tokenizeString(document.getText(), engine);
    this._tokenCache.update(document, tokens);
    return tokens;
  }

  private tokenizeString(text: string, engine: MarkdownIt) {
    return engine.parse(text.replace(UNICODE_NEWLINE_REGEX, ""), {});
  }
}

class TokenCache {
  private cachedDocument?: {
    readonly uri: vscode.Uri;
    readonly version: number;
  };
  private tokens?: Token[];

  public tryGetCached(document: MarkdownTextDocument): Token[] | undefined {
    if (
      this.cachedDocument &&
      this.cachedDocument.uri.toString() === document.uri.toString() &&
      this.cachedDocument.version === document.version
    ) {
      return this.tokens;
    }
    return undefined;
  }

  public update(document: MarkdownTextDocument, tokens: Token[]) {
    this.cachedDocument = {
      uri: document.uri,
      version: document.version,
    };
    this.tokens = tokens;
  }

  public clean(): void {
    this.cachedDocument = undefined;
    this.tokens = undefined;
  }
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, window } from "vscode";
import { Command } from "../../core/command";
import { MarkdownEngine } from "../../markdown/engine";
import { QuartoActivityBarViewProvider } from "./webview";

export function activateQuartoActivityBarPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  const provider = new QuartoActivityBarViewProvider(context, engine);
  context.subscriptions.push(provider);

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      QuartoActivityBarViewProvider.viewType,
      provider
    )
  );

  return [];
}

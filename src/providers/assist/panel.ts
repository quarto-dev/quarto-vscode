/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) 2020 Matt Bierner
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, window, languages } from "vscode";
import { Command } from "../../core/command";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { quartoLensCodeLensProvider } from "./codelens";
import { PreviewMathCommand } from "./commands";
import { QuartoAssistViewProvider } from "./webview";

export function activateQuartoLensPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
): Command[] {
  const provider = new QuartoAssistViewProvider(context, engine);
  context.subscriptions.push(provider);

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      QuartoAssistViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoLensCodeLensProvider(engine)
    )
  );

  return [new PreviewMathCommand(provider)];
}

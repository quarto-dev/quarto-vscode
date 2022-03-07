/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) 2020 Matt Bierner
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, window, languages } from "vscode";
import { kQuartoDocSelector } from "../../core/doc";
import { MarkdownEngine } from "../../markdown/engine";
import { quartoLensCodeLensProvider } from "./codelens";
import { QuartoLensViewProvider } from "./webview";

export function activateQuartoLensPanel(
  context: ExtensionContext,
  engine: MarkdownEngine
) {
  const provider = new QuartoLensViewProvider(context, engine);
  context.subscriptions.push(provider);

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      QuartoLensViewProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      kQuartoDocSelector,
      quartoLensCodeLensProvider(engine)
    )
  );
}
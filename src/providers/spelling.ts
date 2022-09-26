/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget, extensions, workspace } from "vscode";

export async function activateSpelling() {
  // see if we are auto-configuring spelling settings
  const config = workspace.getConfiguration("quarto");
  if (config.get("spelling.autoConfigure") === false) {
    return;
  }

  // verify that Spell Right is installed
  if (extensions.getExtension("ban.spellright") === undefined) {
    return;
  }

  // get spellright config
  const spellrightConfig = workspace.getConfiguration("spellright");

  // ensure we are checking the quarto document type
  if (spellrightConfig.has("documentTypes")) {
    const inspectDocumentTypes = spellrightConfig.inspect("documentTypes");
    const globalDocumentTypes = inspectDocumentTypes?.globalValue as
      | string[]
      | undefined;
    const addQuartoToDocTypes = async (baseTypes: string[]) => {
      await spellrightConfig.update(
        "documentTypes",
        [...baseTypes, "quarto"],
        ConfigurationTarget.Global
      );
    };
    if (!globalDocumentTypes) {
      const defaultDocumentTypes = (inspectDocumentTypes?.defaultValue || [
        "markdown",
        "latex",
        "plaintext",
      ]) as string[];
      await addQuartoToDocTypes(defaultDocumentTypes);
    } else if (!globalDocumentTypes.includes("quarto")) {
      await addQuartoToDocTypes(globalDocumentTypes);
    }
  }

  // ensure quarto uses the markdown parser
  if (spellrightConfig.has("parserByClass")) {
    if (!spellrightConfig.get("parserByClass.quarto")) {
      const inspectParserByClass = spellrightConfig.inspect("parserByClass");
      await spellrightConfig.update(
        "parserByClass",
        {
          ...((inspectParserByClass?.globalValue as Record<string, unknown>) ||
            {}),
          quarto: { parser: "markdown" },
        },
        ConfigurationTarget.Global
      );
    }
  }

  // ensure we have the right installRegExpsByClass value
  if (spellrightConfig.has("ignoreRegExpsByClass")) {
    if (!spellrightConfig.get("ignoreRegExpsByClass.quarto")) {
      const inspectIgnoreRegExps = spellrightConfig.inspect(
        "ignoreRegExpsByClass"
      );
      await spellrightConfig.update(
        "ignoreRegExpsByClass",
        {
          ...((inspectIgnoreRegExps?.globalValue as Record<string, unknown>) ||
            {}),
          quarto: ["/\\{.+\\}/", "/@[^ ]+/", "/\\n\\s*[^\\s\\:]+\\:/"],
        },

        ConfigurationTarget.Global
      );
    }
  }
}

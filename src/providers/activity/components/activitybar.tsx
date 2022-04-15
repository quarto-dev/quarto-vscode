/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";

export interface ActivityBarProps {
  document?: {
    name: string;
    path: string;
  };
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ["vscode-button"]: any;
      ["vscode-dropdown"]: any;
      ["vscode-option"]: any;
    }
  }
}

const ActivityBar = (props: ActivityBarProps) => {
  return (
    <>
      {props.document ? (
        <>
          <a href={"command:quarto.render"}>
            <vscode-button>Render</vscode-button>
          </a>
          <vscode-dropdown>
            <vscode-option>HTML</vscode-option>
            <vscode-option>PDF</vscode-option>
            <vscode-option>DOCX</vscode-option>
          </vscode-dropdown>
        </>
      ) : null}
    </>
  );
};

export default ActivityBar;

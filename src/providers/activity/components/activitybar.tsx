/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";

export interface ActivityBarProps {
  render: string;
}

const ActivityBar = (props: ActivityBarProps) => {
  return (
    <>
      <h1>Hello World!</h1>
      <a href={"command:" + props.render}>
        <vscode-button id="howdy">
          Render It
          <span slot="start" className="codicon codicon-add"></span>
        </vscode-button>
      </a>
    </>
  );
};

export default ActivityBar;

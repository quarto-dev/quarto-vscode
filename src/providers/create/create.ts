/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import { QuartoContext } from "../../shared/quarto";
import { CreateProjectCommand } from "./project";

export function activateCreate(quartoContext: QuartoContext) {
  return [new CreateProjectCommand(quartoContext)];
}

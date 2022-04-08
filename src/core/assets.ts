/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function assetPath(parts: string[]): string[] {
  return ["assets", ...parts];
}

export function wwwAssetPath(parts: string[]) {
  return assetPath(["www", ...parts]);
}

export function wwwSharedAssetPath(parts: string[]) {
  return wwwAssetPath(["shared", ...parts]);
}

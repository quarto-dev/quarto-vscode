/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import type { SupportedExtension } from "mathjax-full";

export class ExtensionConfig {
  public previewMathJaxExtensions(): SupportedExtension[] {
    return this.previewMathJaxExtensions_;
  }

  public previewMathJaxScale(): number {
    return this.previewMathJaxScale_;
  }

  public previewMathJaxTheme(): "light" | "dark" {
    return this.previewMathJaxTheme_;
  }

  public update(configuration: Record<string, any>) {
    this.previewMathJaxExtensions_ =
      configuration?.preview?.mathjax?.extensions ||
      this.previewMathJaxExtensions_;
    this.previewMathJaxScale_ =
      configuration?.preview?.mathjax?.scale || this.previewMathJaxScale_;
    this.previewMathJaxTheme_ =
      configuration?.preview?.mathjax?.theme || this.previewMathJaxTheme_;
  }

  private previewMathJaxExtensions_: SupportedExtension[] = [];
  private previewMathJaxScale_: number = 1;
  private previewMathJaxTheme_: "light" | "dark" = "dark";
}

export const config = new ExtensionConfig();

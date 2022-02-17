# quarto-vscode

VS Code extension for the Quarto scientific and technical publishing system (https://quarto.org).

This extension provides language support for Quarto `.qmd` files, including:

- Syntax highlighting
- Code folding and outline navigation
- Code snippets for common markdown constructs
- Clickable links within documents
- Code completion for link and image paths

### Installation

The easiest way to install is directly from within VS Code (search extensions for "quarto").

You can also install from the [VS Code Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=quarto.quarto).

Alternatively, you can download and install the extension from the command line as follows:

1. Download the extension file: [Quarto VS Code (VISX)](https://github.com/quarto-dev/quarto-vscode/raw/main/dist/quarto-1.2.0.vsix)

2. Install from the command line with:

   ```bash
   code --install-extension quarto-1.2.0.vsix
   ```

Note that in order to use the `code` command to perform the installation you may need to open the VS Code
Command Palette (Ctrl+Shift+P) and type "shell command" to execute the `Shell Command: Install 'code' command in PATH` command.
This will make sure that `code` can be invoked from the command line on your system.

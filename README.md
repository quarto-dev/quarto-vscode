# quarto-vscode

VS Code extension for the [Quarto](https://quarto.org) scientific and technical publishing system. This extension provides language support for Quarto `.qmd` files, including:

- Render command with integrated preview pane
- Syntax highlighting for markdown and embedded languages
- Completion for embedded languages (e.g. Python, R, Julia, LaTeX, etc.)
- Completion and diagnostics for project files and document/cell options
- Commands and key-bindings for running cells and selected line(s)
- Assist panel for contextual help, image preview, and math preview.
- Code snippets for common markdown constructs
- Code folding and document outline for navigation within documents
- Workspace symbol provider for navigation across project files

## Installation

The easiest way to install is directly from within VS Code (search extensions for "quarto").

You can also install from the [VS Code Extension Marketplace](https://marketplace.visualstudio.com/items?itemName=quarto.quarto) or directly from a [VISX extension file](#visx-install).

## Features

### Render and Preview

Render documents or projects using the `Quarto: Render Document` command (`Ctrl+Shift+K` or `Cmd+Shift+K` on the Mac). An integrated preview window displays the rendered document and automatically updates on re-render:

![](https://quarto.org/docs/tools/images/vscode-render.png)

### Code Cells

There are a variety of tools that make it easier to edit and execute code cells. Editing tools include syntax highlighting, code folding, code completion, and signature tips:

![](https://quarto.org/docs/tools/images/vscode-code-cell.png)

For Python, R, and Julia cells, commands are available to execute the current cell, previous cells, or the currently selected line(s). Cell output is shown side by side in the Jupyter interactive console:

![](https://quarto.org/docs/tools/images/vscode-execute-cell.png)

Execute the current cell with `Ctrl+Shift+Enter`, the current line(s) with `Ctrl+Enter`, or previous cells with `Ctrl+Alt+P` (note that on the Mac you should use `Cmd` rather than `Ctrl` as the prefix for all Quarto keyboard shortcuts).

Enhanced features for embedded languages (e.g. completion, code execution) can be enabled by installing the most recent version(s) of these extensions:

- [Python Extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [R Extension](https://marketplace.visualstudio.com/items?itemName=Ikuyadeu.r)
- [Julia Extension](https://marketplace.visualstudio.com/items?itemName=julialang.language-julia)

### YAML Intelligence

YAML code completion is available for project files, YAML front matter, and executable cell options:

![](https://quarto.org/docs/tools/images/vscode-yaml-completion.png)

If you have incorrect YAML it will also be highlighted when documents are saved:

![](https://quarto.org/docs/tools/images/vscode-yaml-diagnostics.png)

Note that YAML intelligence features require version 0.9.44 or later of the [Quarto CLI](https://github.com/quarto-dev/quarto-cli/releases/latest).

### Code Snippets

Code snippets are templates that make it easier to enter repeating code patterns (e.g. code blocks, callouts, divs, etc.). Execute the `Insert Snippet` command within a Quarto document to insert a markdown snippet:

![](https://quarto.org/docs/tools/images/vscode-snippets.png)

### Document Navigation

If you have a large document use the outline view for quick navigation between sections:

![](https://quarto.org/docs/tools/images/vscode-outline.png)

You can also use the `Go to Symbol in Editor` command (`Ctrl+Shift+O`) keyboard shortcut for type-ahead navigation of the current document's outline.

Use the `Go to File` command (`Ctrl+P`) to navigate to other files and the `Go to Symbol in Workspace` command (`Ctrl+T`) for type-ahead navigation to all headings in the workspace:

![](https://quarto.org/docs/tools/images/vscode-workspace-symbols.png)

## VISX Install

You can alternatively download and install the extension from the command line as follows:

1.  Download the extension file: [Quarto VS Code (VISX)](https://github.com/quarto-dev/quarto-vscode/raw/main/visx/quarto-1.12.1.vsix)

2.  Install from the command line with:

    ```bash
    code --install-extension quarto-1.12.1.vsix
    ```

Note that in order to use the `code` command to perform the installation you may need to open the VS Code Command Palette (Ctrl+Shift+P) and type "shell command" to execute the `Shell Command: Install 'code' command in PATH` command. This will make sure that `code` can be invoked from the command line on your system.

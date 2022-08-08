# Changelog

## 1.30.0

- Support validation and completion of `_extension.yml` files

## 1.29.0 (Release on 26 July 2022)

- Correct shell quoting for quarto preview on windows

## 1.28.0 (Release on 20 July 2022)

- Use terminal for quarto preview

## 1.27.0 (Release on 16 July 2022)

- Set LANG environment variable for quarto render/preview

## 1.26.0 (Release on 9 July 2022)

- Use output channel for quarto preview
- Fix syntax highlighting for strikethrough

## 1.25.0 (Release on 2 July 2022)

- Improve detection of current slide for revealjs preview
- Automatically disable terminal shell integration for workspace

## 1.24.0 (Release on 3 June 2022)

- Automatically insert option comment prefix in executable cells
- Remove 'Focus Lock' indicator from preview
- Fix for document outline display when there are empty headings

## 1.23.0 (Release on 29 May 2022)

- Support VS Code command keyboard shortcuts while preview is focused
- Support clipboard operations within preview iframe
- Prevent flake8 diagnostics from appearing in intellisense temp file
- Register Quarto assist panel as an explorer view

## 1.22.0 (Release on 23 May 2022)

- Improve math highlighting rules (delegate to builtin rules)

## 1.21.0 (Release on 20 May 2022)

- Move Quarto Assist panel to activity bar

## 1.20.2 (Release on 19 May 2022)

- Run preview from workspace root if there is no project
- Tolerate space between # and | for yaml option completion
- Trim trailing newline from selection for R execution

## 1.20.1 (Release on 13 May 2022)

- Debounce reporting of errors in diagram preview
- Correct path for graphviz language configuration

## 1.20.0 (Release on 12 May 2022)

- Syntax highlighting, snippets and live preview for diagrams
- Run preview for project files from project root directory
- Run cell for cells using inline knitr chunk options

## 1.19.1 (Release on 5 May 2022)

- Open file preview externally for non-localhost

## 1.19.0 (Release on 4 May 2022)

- Prompt for installation on render if quarto not found
- Print full proxied session URL when running under RSW

## 1.18.1 (Release on 3 May 2022)

- Support old and new (reditorsupport.r) R extension ids

## 1.18.0 (Release on 30 April 2022)

- Revert to using terminal for quarto preview
- Improved editor handling of shortcodes (autoclose, snippet)

## 1.17.0 (Release on 25 April 2022)

- Getting started with Quarto walkthrough
- Warn when files are saved with invalid extensions

## 1.16.0 (Release on 23 April 2022)

- Improved math syntax highlighting
- Don't include callout headers in toc

## 1.15.0 (Release on 22 April 2022)

- Icon for qmd file type
- Terminate preview command
- Don't auto-pair backticks

## 1.14.0 (Release on 19 April 2022)

- Format specific render commands (HTML, PDF, Word)
- Use output channel rather than terminal for preview
- Clear Cache command for Jupyter & Knitr caches
- Auto-closing pair behavior for quotes
- Preference to control preview location

## 1.13.0 (Release on 14 April 2022)

- Render button on editor toolbar
- Improved webview focus management
- Activate when executing new notebook command

## 1.12.1 (Release on 4 April 2022)

- Disable snippet suggestions by default

## 1.12.0 (Release on 3 April 2022)

- Insert code cell command (Ctrl+Shift+I)
- Navigate revealjs preview to slide at cursor
- Commands for creating documents and presentations
- Code folding for divs and front matter

## 1.11.2 (Release on 30 March 2022)

- Don't show preview in Hugo projects (hugo serve provides preview)
- Render Project command for full render of all documents in project
- Improved compatibility with VS Code web mode

## 1.11.1 (Release on 29 March 2022)

- Use Ctrl+Shift+K as keyboard shortcut for render
- Match current dark/light theme for text format preview

## 1.11.0 (Release on 29 March 2022)

- Render command with integrated preview pane
- Use same versions of Python and R as configured for their respective extensions
- Preference to use alternate quarto binary

## 1.10.0 (Release on 15 March 2022)

- Message when extensions required for cell execution aren't installed
- Scroll to top when setting assist pane contents

## 1.9.0 (Release on 13 March 2022)

- Syntax highlighting, completion, and cell execution for Julia
- Hover and assist preview for markdown images
- Assist panel content can now be pinned/unpinned

## 1.8.0 (Release on 11 March 2022)

- Syntax highlighting for embedded LaTeX
- Completion for MathJax-compatible LaTeX commands
- Hover and assist preview for MathJax equations

## 1.7.0 (Release on 8 March 2022)

- Quarto Assist panel for contextual help as you edit
- Code Lens to execute code from R executable code blocks
- Hover help provider for Quarto YAML options
- Additional language features (outline, folding, etc) in VS code for the web

## 1.6.0 (Release on 3 March 2022)

- Completion for Quarto markdown classes and attributes
- Commands and keyboard shortcuts for cell execution and navigation
- Improved markdown parsing performance
- VS code for the web compatibility (synatx highlighting and snippets)

## 1.5.2 (Release on 28 February 2022)

- Improved embedded completions for R (keep R LSP alive across requests)

## 1.5.0 (Release on 27 February 2022)

- Code completion and diagnostics for YAML front matter and cell options
- Commands and keybindings for running current cell, previous cells, and selected line(s)
- Code Lens to execute code from Python executable code blocks
- Workspace symbol provider for quick navigation to documents/headings

## 1.4.0 (Release on 23 February 2022)

- Completion, hover, and signature help for embedded languages, including
  Python, R, LaTeX, and HTML

## 1.3.0 (Release on 17 February 2022)

- Background highlighting for code cells
- Syntax highlighting for citations, divs, callouts, and code cells
- Snippets for divs, callouts, and code cells
- Improved TOC display (better icon, exclude heading markers)
- Improved completion defaults (enable quick suggestions, disable snippet and word-based suggestions)
- Use commonmark mode for markdown-it parsing

## 1.2.0 (Release on 15 February 2022)

- Clickable links within documents
- Code completion for link and image paths

## 1.1.0 (Release on 15 February 2022)

- Code folding and table of contents
- Workspace and document symbol providers
- Selection range provider

## 1.0.1 (Release on 10 February 2022)

- Minor patch to improve extension metadata and marketplace listing

## 1.0.0 (Release on 10 February 2022)

- Synatx highlighting for `.qmd` files
- Snippets for `.qmd` files

# Port Verification Checklist

Reference project: `/Users/steipete/Projects/pi-mono/packages/tui`
Comparison date: November 15, 2025

## Source files
- [x] src/index.ts — Swift’s module system exposes the same public API surface; `Sources/TauTUI/TauTUI.swift` anchors the namespace for future helpers.
- [x] src/terminal.ts — `Sources/TauTUI/Terminal/Terminal.swift` implements the `Terminal` protocol plus `ProcessTerminal`/`VirtualTerminal`, including bracketed paste, cursor control, and modifier-aware key parsing missing from pi’s version.
- [x] src/tui.ts — `Sources/TauTUI/Core/TUI.swift` and `Sources/TauTUI/Core/Component.swift` mirror the container model and differential renderer (full render on first frame/resize, partial diff otherwise) while adding a pluggable render scheduler.
- [x] src/autocomplete.ts — `Sources/TauTUI/Autocomplete/Autocomplete.swift` now exposes forced file completion + Tab heuristics (`forceFileSuggestions`/`shouldTriggerFileCompletion`) and supports registering plain `AutocompleteItem` commands alongside `SlashCommand` types.
- [x] src/utils.ts — `Sources/TauTUI/Utilities/VisibleWidth.swift` + `Sources/TauTUI/Utilities/Ansi.swift` provide the same tab-normalization and ANSI-stripping behavior backed by `swift-displaywidth`.
- [x] src/components/editor.ts — `Sources/TauTUI/Components/Editor.swift` implements Tab-aware slash/file completion (including forced file suggestions) and sanitizes large pastes by expanding tabs + stripping non-printable characters before inserting markers.
- [x] src/components/input.ts — `Sources/TauTUI/Components/Input.swift` supports the same single-line editing features (home/end, delete/backspace, cursor windowing) with structured `TerminalInput` events and VisibleWidth-aware padding.
- [x] src/components/loader.ts — `Sources/TauTUI/Components/Loader.swift` ports the spinner frames, leading spacer line, message updates, and auto render requests (via weak `TUI` callbacks or injectable closures for tests).
- [x] src/components/markdown.ts — `Sources/TauTUI/Components/MarkdownComponent.swift` supports both RGB backgrounds and the new foreground tint to mirror pi’s `fgColor` support.
- [x] src/components/select-list.ts — `Sources/TauTUI/Components/SelectList.swift` handles filtering, scrolling windows, descriptions, and arrow/enter/escape handling; selection reset-on-filter is slightly different but covered because autocomplete creates a fresh list each update.
- [x] src/components/spacer.ts — `Sources/TauTUI/Components/Spacer.swift` keeps the configurable empty-line behavior with bounds checking.
- [x] src/components/text.ts — `Sources/TauTUI/Components/Text.swift` mirrors wrapping, caching, padding, and optional RGB background tinting (using `Text.Background` instead of `chalk.bgRgb`).

## Tests
- [x] test/markdown.test.ts — The suites in `Tests/TauTUITests/MarkdownTests.swift` and `MarkdownCodeTests.swift` assert the same nested list/table/code behavior with ANSI stripping expectations.
- [x] test/chat-simple.ts — `Examples/ChatDemo/main.swift` now supports `/clear` and `/delete`, adds Markdown output, and mutates the `messages` container directly to mirror the Node demo.
- [x] test/virtual-terminal.ts — `Sources/TauTUI/Terminal/VirtualTerminal.swift` tracks scrollback, pending lines, viewport snapshots, cursor position, and exposes `flush()/getViewport()/getScrollBuffer()` so Swift tests can assert rendered frames like the xterm harness.
- [x] test/key-tester.ts — `Examples/KeyTester/main.swift` is the Swift port of the Node key tester, logging raw hex codes, modifiers, and escape sequences while requesting renders on every event.

## Tooling & metadata
- [x] package.json — `Package.swift` defines the library, internal test helper target, ChatDemo executable, and pulls in `swift-markdown`, `swift-system`, and `swift-displaywidth`, covering pi’s dependency + distribution metadata.
- [x] tsconfig.build.json — Swift Package Manager handles build settings, so there’s no direct analogue; the package manifest already defines targets/sources to compile, satisfying the intent of `tsconfig`.
- [x] README.md — Updated to describe the completed runtime, enumerate features, and point to the ChatDemo + KeyTester examples (instead of the old WIP notice).

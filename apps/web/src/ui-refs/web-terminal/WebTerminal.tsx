import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import { Terminal, ITerminalOptions, ITerminalAddon } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon } from '@xterm/addon-image';
import { CanvasAddon } from '@xterm/addon-canvas';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';

import { useTerminalConnection } from '../../hooks/useTerminalConnection';
import { useTerminalResize } from '../../hooks/useTerminalResize';
import { useTerminalHistory } from '../../hooks/useTerminalHistory';
import { useTerminalSearch } from '../../hooks/useTerminalSearch';
import { TerminalTheme, defaultThemes } from '../../themes';
import { TerminalToolbar } from '../TerminalToolbar/TerminalToolbar';
import { SearchDialog } from '../SearchDialog/SearchDialog';
import { ConnectionStatus } from '../ConnectionStatus/ConnectionStatus';

import type {
  WebTerminalProps,
  WebTerminalRef,
  TerminalConnectionConfig,
  TerminalEvent,
  TerminalWriteOptions,
  AddonConfig,
} from '../../types';

import './WebTerminal.css';

/**
 * WebTerminal - A comprehensive xterm.js wrapper for React with Radix UI integration
 * 
 * Features:
 * - Full xterm.js integration with all major addons
 * - WebSocket/HTTP connection management
 * - Radix UI context menus, tooltips, and dialogs
 * - Theming support with CSS variables
 * - Command history with persistence
 * - Search functionality
 * - Resize handling with debouncing
 * - Clipboard integration
 * - Comprehensive event system
 * - TypeScript support
 */
export const WebTerminal = forwardRef<WebTerminalRef, WebTerminalProps>(
  (
    {
      // Connection
      connectionConfig,
      autoConnect = true,
      reconnectAttempts = 3,
      reconnectDelay = 1000,

      // Terminal Options
      terminalOptions = {},
      theme = 'dark',
      customTheme,
      fontSize = 14,
      fontFamily = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      cursorStyle = 'block',
      cursorBlink = true,
      scrollback = 10000,
      tabStopWidth = 4,

      // Addons
      addons = {},
      enableWebGL = true,
      enableWebLinks = true,
      enableSearch = true,
      enableUnicode = true,
      enableImageSupport = false,
      enableClipboard = true,

      // UI Configuration
      showToolbar = true,
      showConnectionStatus = true,
      showScrollbar = true,
      toolbarPosition = 'top',
      contextMenuEnabled = true,
      customContextMenuItems = [],

      // Behavior
      focusOnMount = true,
      preserveHistory = true,
      maxHistorySize = 1000,
      localEcho = false,
      bracketedPasteMode = true,

      // Dimensions
      width = '100%',
      height = '400px',
      minHeight = '200px',
      maxHeight,

      // Events
      onConnect,
      onDisconnect,
      onReconnect,
      onError,
      onData,
      onBinary,
      onResize,
      onTitleChange,
      onSelectionChange,
      onLineFeed,
      onScroll,
      onKey,
      onCursorMove,
      onBell,
      onRender,
      onWriteParsed,

      // Custom Renderers
      renderToolbar,
      renderContextMenu,
      renderConnectionStatus,

      // Accessibility
      ariaLabel = 'Terminal',
      screenReaderMode = false,

      // Styling
      className,
      style,
      containerClassName,
      terminalClassName,

      // Children for custom overlays
      children,
    },
    ref
  ) => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const addonsRef = useRef<Map<string, ITerminalAddon>>(new Map());

    // State
    const [isInitialized, setIsInitialized] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [currentTitle, setCurrentTitle] = useState('Terminal');
    const [selection, setSelection] = useState<string>('');

    // Custom hooks
    const {
      connectionState,
      connect,
      disconnect,
      send,
      sendBinary,
      reconnect,
    } = useTerminalConnection({
      config: connectionConfig,
      autoConnect,
      reconnectAttempts,
      reconnectDelay,
      onConnect: () => {
        onConnect?.();
      },
      onDisconnect: (reason) => {
        onDisconnect?.(reason);
      },
      onReconnect: (attempt) => {
        onReconnect?.(attempt);
      },
      onError: (error) => {
        onError?.(error);
      },
      onData: (data) => {
        terminalRef.current?.write(data);
        onData?.(data);
      },
      onBinary: (data) => {
        terminalRef.current?.write(data);
        onBinary?.(data);
      },
    });

    const { fitTerminal, dimensions } = useTerminalResize({
      terminal: terminalRef.current,
      container: containerRef.current,
      fitAddon: addonsRef.current.get('fit') as FitAddon,
      onResize: (cols, rows) => {
        onResize?.(cols, rows);
        // Notify server of resize
        if (connectionState.status === 'connected') {
          send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      },
    });

    const {
      history,
      historyIndex,
      addToHistory,
      navigateHistory,
      clearHistory,
      searchHistory,
    } = useTerminalHistory({
      maxSize: maxHistorySize,
      persist: preserveHistory,
      storageKey: `terminal-history-${connectionConfig?.id || 'default'}`,
    });

    const {
      searchResults,
      currentMatch,
      findNext,
      findPrevious,
      findAll,
      clearSearch,
    } = useTerminalSearch({
      searchAddon: addonsRef.current.get('search') as SearchAddon,
    });

    // Initialize terminal
    useEffect(() => {
      if (!containerRef.current || terminalRef.current) {return;}

      const resolvedTheme: TerminalTheme =
        customTheme || defaultThemes[theme] || defaultThemes.dark;

      const options: ITerminalOptions = {
        fontSize,
        fontFamily,
        cursorStyle,
        cursorBlink,
        scrollback,
        tabStopWidth,
        theme: resolvedTheme,
        allowProposedApi: true,
        convertEol: true,
        screenReaderMode,
        ...terminalOptions,
      };

      const terminal = new Terminal(options);
      terminalRef.current = terminal;

      // Initialize addons
      initializeAddons(terminal);

      // Open terminal in container
      terminal.open(containerRef.current);

      // Set up event listeners
      setupEventListeners(terminal);

      // Initial fit
      const fitAddon = addonsRef.current.get('fit') as FitAddon;
      if (fitAddon) {
        setTimeout(() => fitAddon.fit(), 0);
      }

      // Focus if requested
      if (focusOnMount) {
        terminal.focus();
      }

      setIsInitialized(true);

      // Write welcome message
      terminal.writeln('\x1b[1;34m╔══════════════════════════════════════════╗\x1b[0m');
      terminal.writeln('\x1b[1;34m║\x1b[0m   \x1b[1;37mWeb Terminal\x1b[0m - \x1b[90mPower User Mode\x1b[0m          \x1b[1;34m║\x1b[0m');
      terminal.writeln('\x1b[1;34m╚══════════════════════════════════════════╝\x1b[0m');
      terminal.writeln('');

      return () => {
        terminal.dispose();
        terminalRef.current = null;
        addonsRef.current.clear();
      };
    }, []);

    // Initialize addons
    const initializeAddons = useCallback((terminal: Terminal) => {
      // Fit Addon (always enabled)
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      addonsRef.current.set('fit', fitAddon);

      // WebGL Addon (hardware acceleration)
      if (enableWebGL) {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
            // Fallback to canvas renderer
            const canvasAddon = new CanvasAddon();
            terminal.loadAddon(canvasAddon);
            addonsRef.current.set('canvas', canvasAddon);
          });
          terminal.loadAddon(webglAddon);
          addonsRef.current.set('webgl', webglAddon);
        } catch (e) {
          console.warn('WebGL addon failed, falling back to canvas:', e);
          const canvasAddon = new CanvasAddon();
          terminal.loadAddon(canvasAddon);
          addonsRef.current.set('canvas', canvasAddon);
        }
      }

      // Web Links Addon
      if (enableWebLinks) {
        const webLinksAddon = new WebLinksAddon((event, uri) => {
          window.open(uri, '_blank', 'noopener,noreferrer');
        });
        terminal.loadAddon(webLinksAddon);
        addonsRef.current.set('weblinks', webLinksAddon);
      }

      // Search Addon
      if (enableSearch) {
        const searchAddon = new SearchAddon();
        terminal.loadAddon(searchAddon);
        addonsRef.current.set('search', searchAddon);
      }

      // Unicode11 Addon
      if (enableUnicode) {
        const unicodeAddon = new Unicode11Addon();
        terminal.loadAddon(unicodeAddon);
        terminal.unicode.activeVersion = '11';
        addonsRef.current.set('unicode', unicodeAddon);
      }

      // Serialize Addon (for getting terminal content)
      const serializeAddon = new SerializeAddon();
      terminal.loadAddon(serializeAddon);
      addonsRef.current.set('serialize', serializeAddon);

      // Image Addon
      if (enableImageSupport) {
        const imageAddon = new ImageAddon();
        terminal.loadAddon(imageAddon);
        addonsRef.current.set('image', imageAddon);
      }

      // Clipboard Addon
      if (enableClipboard) {
        const clipboardAddon = new ClipboardAddon();
        terminal.loadAddon(clipboardAddon);
        addonsRef.current.set('clipboard', clipboardAddon);
      }

      // Load custom addons
      Object.entries(addons).forEach(([name, addonConfig]) => {
        if (addonConfig.addon && addonConfig.enabled !== false) {
          terminal.loadAddon(addonConfig.addon);
          addonsRef.current.set(name, addonConfig.addon);
        }
      });
    }, [enableWebGL, enableWebLinks, enableSearch, enableUnicode, enableImageSupport, enableClipboard, addons]);

    // Set up event listeners
    const setupEventListeners = useCallback((terminal: Terminal) => {
      terminal.onData((data) => {
        if (connectionState.status === 'connected') {
          send(data);
        } else if (localEcho) {
          terminal.write(data);
        }
      });

      terminal.onBinary((data) => {
        if (connectionState.status === 'connected') {
          sendBinary(data);
        }
      });

      terminal.onTitleChange((title) => {
        setCurrentTitle(title);
        onTitleChange?.(title);
      });

      terminal.onSelectionChange(() => {
        const sel = terminal.getSelection();
        setSelection(sel);
        onSelectionChange?.(sel);
      });

      terminal.onLineFeed(() => {
        onLineFeed?.();
      });

      terminal.onScroll((position) => {
        onScroll?.(position);
      });

      terminal.onKey(({ key, domEvent }) => {
        onKey?.(key, domEvent);

        // Handle search shortcut
        if ((domEvent.ctrlKey || domEvent.metaKey) && domEvent.key === 'f') {
          domEvent.preventDefault();
          setSearchOpen(true);
        }
      });

      terminal.onCursorMove(() => {
        onCursorMove?.();
      });

      terminal.onBell(() => {
        onBell?.();
      });

      terminal.onRender((event) => {
        onRender?.(event);
      });

      terminal.onWriteParsed(() => {
        onWriteParsed?.();
      });
    }, [connectionState.status, send, sendBinary, localEcho, onTitleChange, onSelectionChange, onLineFeed, onScroll, onKey, onCursorMove, onBell, onRender, onWriteParsed]);

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      // Terminal instance access
      getTerminal: () => terminalRef.current,
      getAddon: <T extends ITerminalAddon>(name: string) => addonsRef.current.get(name) as T | undefined,

      // Connection management
      connect,
      disconnect,
      reconnect,
      getConnectionState: () => connectionState,

      // Writing
      write: (data: string, options?: TerminalWriteOptions) => {
        if (options?.newLine) {
          terminalRef.current?.writeln(data);
        } else {
          terminalRef.current?.write(data);
        }
      },
      writeln: (data: string) => terminalRef.current?.writeln(data),
      writeError: (message: string) => {
        terminalRef.current?.writeln(`\x1b[1;31mError: ${message}\x1b[0m`);
      },
      writeWarning: (message: string) => {
        terminalRef.current?.writeln(`\x1b[1;33mWarning: ${message}\x1b[0m`);
      },
      writeSuccess: (message: string) => {
        terminalRef.current?.writeln(`\x1b[1;32m${message}\x1b[0m`);
      },
      writeInfo: (message: string) => {
        terminalRef.current?.writeln(`\x1b[1;34m${message}\x1b[0m`);
      },

      // Terminal control
      clear: () => terminalRef.current?.clear(),
      reset: () => terminalRef.current?.reset(),
      focus: () => terminalRef.current?.focus(),
      blur: () => terminalRef.current?.blur(),
      scrollToTop: () => terminalRef.current?.scrollToTop(),
      scrollToBottom: () => terminalRef.current?.scrollToBottom(),
      scrollToLine: (line: number) => terminalRef.current?.scrollToLine(line),

      // Selection
      getSelection: () => terminalRef.current?.getSelection() || '',
      selectAll: () => terminalRef.current?.selectAll(),
      clearSelection: () => terminalRef.current?.clearSelection(),
      hasSelection: () => terminalRef.current?.hasSelection() || false,

      // Copy/Paste
      copy: async () => {
        const sel = terminalRef.current?.getSelection();
        if (sel) {
          await navigator.clipboard.writeText(sel);
        }
        return sel || '';
      },
      paste: async () => {
        const text = await navigator.clipboard.readText();
        if (text) {
          terminalRef.current?.paste(text);
        }
        return text;
      },

      // Search
      findNext: (term: string) => findNext(term),
      findPrevious: (term: string) => findPrevious(term),
      findAll: (term: string) => findAll(term),
      clearSearch,
      openSearch: () => setSearchOpen(true),
      closeSearch: () => setSearchOpen(false),

      // History
      getHistory: () => history,
      clearHistory,
      searchHistory,

      // Serialization
      serialize: () => {
        const addon = addonsRef.current.get('serialize') as SerializeAddon;
        return addon?.serialize() || '';
      },
      serializeAsHTML: () => {
        const addon = addonsRef.current.get('serialize') as SerializeAddon;
        return addon?.serializeAsHTML() || '';
      },

      // Dimensions
      fit: () => fitTerminal(),
      getDimensions: () => dimensions,
      resize: (cols: number, rows: number) => {
        terminalRef.current?.resize(cols, rows);
      },

      // Options
      setOption: <K extends keyof ITerminalOptions>(key: K, value: ITerminalOptions[K]) => {
        if (terminalRef.current) {
          terminalRef.current.options[key] = value;
        }
      },
      getOption: <K extends keyof ITerminalOptions>(key: K) => {
        return terminalRef.current?.options[key];
      },

      // Theme
      setTheme: (newTheme: TerminalTheme) => {
        if (terminalRef.current) {
          terminalRef.current.options.theme = newTheme;
        }
      },

      // Raw send
      send,
      sendBinary,
    }), [
      connectionState,
      connect,
      disconnect,
      reconnect,
      send,
      sendBinary,
      fitTerminal,
      dimensions,
      history,
      clearHistory,
      searchHistory,
      findNext,
      findPrevious,
      findAll,
      clearSearch,
    ]);

    // Context menu actions
    const handleCopy = useCallback(async () => {
      const sel = terminalRef.current?.getSelection();
      if (sel) {
        await navigator.clipboard.writeText(sel);
      }
    }, []);

    const handlePaste = useCallback(async () => {
      const text = await navigator.clipboard.readText();
      if (text && terminalRef.current) {
        terminalRef.current.paste(text);
      }
    }, []);

    const handleClear = useCallback(() => {
      terminalRef.current?.clear();
    }, []);

    const handleSelectAll = useCallback(() => {
      terminalRef.current?.selectAll();
    }, []);

    // Render context menu
    const renderDefaultContextMenu = () => (
      <ContextMenu.Content className="web-terminal-context-menu">
        <ContextMenu.Item
          className="web-terminal-context-menu-item"
          onSelect={handleCopy}
          disabled={!selection}
        >
          <span className="web-terminal-context-menu-icon">📋</span>
          Copy
          <span className="web-terminal-context-menu-shortcut">⌘C</span>
        </ContextMenu.Item>
        <ContextMenu.Item
          className="web-terminal-context-menu-item"
          onSelect={handlePaste}
        >
          <span className="web-terminal-context-menu-icon">📄</span>
          Paste
          <span className="web-terminal-context-menu-shortcut">⌘V</span>
        </ContextMenu.Item>
        <ContextMenu.Separator className="web-terminal-context-menu-separator" />
        <ContextMenu.Item
          className="web-terminal-context-menu-item"
          onSelect={handleSelectAll}
        >
          <span className="web-terminal-context-menu-icon">📑</span>
          Select All
          <span className="web-terminal-context-menu-shortcut">⌘A</span>
        </ContextMenu.Item>
        <ContextMenu.Item
          className="web-terminal-context-menu-item"
          onSelect={handleClear}
        >
          <span className="web-terminal-context-menu-icon">🗑️</span>
          Clear Terminal
        </ContextMenu.Item>
        <ContextMenu.Separator className="web-terminal-context-menu-separator" />
        <ContextMenu.Item
          className="web-terminal-context-menu-item"
          onSelect={() => setSearchOpen(true)}
        >
          <span className="web-terminal-context-menu-icon">🔍</span>
          Find
          <span className="web-terminal-context-menu-shortcut">⌘F</span>
        </ContextMenu.Item>
        {customContextMenuItems.map((item, index) => (
          <ContextMenu.Item
            key={item.id || index}
            className="web-terminal-context-menu-item"
            onSelect={item.onSelect}
            disabled={item.disabled}
          >
            {item.icon && <span className="web-terminal-context-menu-icon">{item.icon}</span>}
            {item.label}
            {item.shortcut && <span className="web-terminal-context-menu-shortcut">{item.shortcut}</span>}
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    );

    const containerStyle: React.CSSProperties = {
      width,
      height,
      minHeight,
      maxHeight,
      ...style,
    };

    return (
      <Tooltip.Provider>
        <div
          className={`web-terminal-container ${containerClassName || ''} ${className || ''}`}
          style={containerStyle}
          data-theme={theme}
        >
          {showToolbar && toolbarPosition === 'top' && (
            renderToolbar ? (
              renderToolbar({
                title: currentTitle,
                connectionState,
                onConnect: connect,
                onDisconnect: disconnect,
                onClear: handleClear,
                onSearch: () => setSearchOpen(true),
              })
            ) : (
              <TerminalToolbar
                title={currentTitle}
                connectionState={connectionState}
                onConnect={connect}
                onDisconnect={disconnect}
                onClear={handleClear}
                onSearch={() => setSearchOpen(true)}
                onCopy={handleCopy}
                hasSelection={!!selection}
              />
            )
          )}

          {showConnectionStatus && (
            renderConnectionStatus ? (
              renderConnectionStatus(connectionState)
            ) : (
              <ConnectionStatus state={connectionState} />
            )
          )}

          <ContextMenu.Root>
            <ContextMenu.Trigger asChild disabled={!contextMenuEnabled}>
              <div
                ref={containerRef}
                className={`web-terminal ${terminalClassName || ''} ${!showScrollbar ? 'hide-scrollbar' : ''}`}
                aria-label={ariaLabel}
                role="application"
              />
            </ContextMenu.Trigger>
            {contextMenuEnabled && (
              renderContextMenu ? (
                renderContextMenu({
                  selection,
                  onCopy: handleCopy,
                  onPaste: handlePaste,
                  onClear: handleClear,
                  onSelectAll: handleSelectAll,
                  onSearch: () => setSearchOpen(true),
                })
              ) : (
                renderDefaultContextMenu()
              )
            )}
          </ContextMenu.Root>

          {showToolbar && toolbarPosition === 'bottom' && (
            renderToolbar ? (
              renderToolbar({
                title: currentTitle,
                connectionState,
                onConnect: connect,
                onDisconnect: disconnect,
                onClear: handleClear,
                onSearch: () => setSearchOpen(true),
              })
            ) : (
              <TerminalToolbar
                title={currentTitle}
                connectionState={connectionState}
                onConnect={connect}
                onDisconnect={disconnect}
                onClear={handleClear}
                onSearch={() => setSearchOpen(true)}
                onCopy={handleCopy}
                hasSelection={!!selection}
                position="bottom"
              />
            )
          )}

          <SearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onFindNext={findNext}
            onFindPrevious={findPrevious}
            results={searchResults}
            currentMatch={currentMatch}
          />

          {children}
        </div>
      </Tooltip.Provider>
    );
  }
);

WebTerminal.displayName = 'WebTerminal';

export default WebTerminal;

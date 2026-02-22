# @your-saas/web-terminal

A comprehensive, production-ready xterm.js React wrapper with Radix UI integration. Built for SaaS applications that need to provide power users with secure terminal access to isolated containers.

## Features

- 🚀 **Full xterm.js Integration** - All terminal capabilities including WebGL rendering, Unicode support, image display
- 🔌 **Multiple Connection Protocols** - WebSocket, HTTP polling, SSH proxy, or custom connections
- 🎨 **11 Built-in Themes** - Dark, Light, Monokai, Dracula, Nord, Solarized, GitHub, One Dark, Gruvbox
- 🔍 **Integrated Search** - Find text in terminal buffer with regex support
- 📋 **Clipboard Support** - Copy/paste with keyboard shortcuts and context menu
- 🤖 **Agent Loop Hook** - Built-in support for AI/automation command execution
- ♿ **Accessible** - Screen reader support, keyboard navigation, ARIA labels
- 🎯 **Radix UI Components** - Context menus, dialogs, tooltips with full customization
- 📦 **TypeScript First** - Comprehensive type definitions for all APIs
- 🔧 **Fully Customizable** - Custom themes, toolbars, context menus, and more

## Installation

```bash
npm install @your-saas/web-terminal
# or
yarn add @your-saas/web-terminal
# or
pnpm add @your-saas/web-terminal
```

## Quick Start

```tsx
import { WebTerminal, WebTerminalRef } from '@your-saas/web-terminal';
import '@your-saas/web-terminal/styles.css';

function App() {
  const terminalRef = useRef<WebTerminalRef>(null);

  return (
    <WebTerminal
      ref={terminalRef}
      connectionConfig={{
        protocol: 'websocket',
        websocket: {
          url: 'wss://your-api.com/terminal/ws',
        },
      }}
      theme="dracula"
      height="500px"
      onConnect={() => console.log('Connected!')}
    />
  );
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WebTerminal                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Toolbar   │  │ Connection   │  │   Context Menu      │ │
│  │  (Radix)    │  │   Status     │  │     (Radix)         │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    xterm.js Terminal                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Addons: WebGL | FitAddon | Search | WebLinks |     │   │
│  │          Unicode | Serialize | Image | Clipboard    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                        Hooks Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────┐ │
│  │ Connection  │ │   Resize    │ │   History   │ │ Search│ │
│  │    Hook     │ │    Hook     │ │    Hook     │ │ Hook  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     Backend (Your Server)     │
              │   WebSocket / HTTP / SSH      │
              └───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │   Isolated Container (gVisor) │
              │         User Session          │
              └───────────────────────────────┘
```

## API Reference

### WebTerminal Props

#### Connection Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `connectionConfig` | `TerminalConnectionConfig` | - | Connection configuration (WebSocket/HTTP/SSH/Custom) |
| `autoConnect` | `boolean` | `true` | Automatically connect on mount |
| `reconnectAttempts` | `number` | `3` | Number of reconnection attempts |
| `reconnectDelay` | `number` | `1000` | Delay between reconnection attempts (ms) |

#### Terminal Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `terminalOptions` | `ITerminalOptions` | `{}` | Raw xterm.js options |
| `theme` | `BuiltInTheme` | `'dark'` | Built-in theme name |
| `customTheme` | `TerminalTheme` | - | Custom theme colors |
| `fontSize` | `number` | `14` | Font size in pixels |
| `fontFamily` | `string` | `'JetBrains Mono', ...` | Font family |
| `cursorStyle` | `'block' \| 'underline' \| 'bar'` | `'block'` | Cursor style |
| `cursorBlink` | `boolean` | `true` | Enable cursor blinking |
| `scrollback` | `number` | `10000` | Scrollback buffer size |
| `tabStopWidth` | `number` | `4` | Tab width |

#### Addon Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `addons` | `AddonsConfig` | `{}` | Custom addons to load |
| `enableWebGL` | `boolean` | `true` | Enable WebGL renderer (falls back to canvas) |
| `enableWebLinks` | `boolean` | `true` | Enable clickable links |
| `enableSearch` | `boolean` | `true` | Enable search functionality |
| `enableUnicode` | `boolean` | `true` | Enable Unicode 11 support |
| `enableImageSupport` | `boolean` | `false` | Enable inline image display |
| `enableClipboard` | `boolean` | `true` | Enable clipboard addon |

#### UI Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showToolbar` | `boolean` | `true` | Show the toolbar |
| `showConnectionStatus` | `boolean` | `true` | Show connection status indicator |
| `showScrollbar` | `boolean` | `true` | Show scrollbar |
| `toolbarPosition` | `'top' \| 'bottom'` | `'top'` | Toolbar position |
| `contextMenuEnabled` | `boolean` | `true` | Enable right-click context menu |
| `customContextMenuItems` | `ContextMenuItem[]` | `[]` | Additional context menu items |

#### Behavior

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `focusOnMount` | `boolean` | `true` | Focus terminal on mount |
| `preserveHistory` | `boolean` | `true` | Persist command history to localStorage |
| `maxHistorySize` | `number` | `1000` | Maximum history entries |
| `localEcho` | `boolean` | `false` | Echo input locally when disconnected |
| `bracketedPasteMode` | `boolean` | `true` | Enable bracketed paste mode |

#### Dimensions

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `string \| number` | `'100%'` | Terminal width |
| `height` | `string \| number` | `'400px'` | Terminal height |
| `minHeight` | `string \| number` | `'200px'` | Minimum height |
| `maxHeight` | `string \| number` | - | Maximum height |

#### Events

| Prop | Type | Description |
|------|------|-------------|
| `onConnect` | `() => void` | Called when connection is established |
| `onDisconnect` | `(reason?: string) => void` | Called when disconnected |
| `onReconnect` | `(attempt: number) => void` | Called on reconnection attempt |
| `onError` | `(error: Error) => void` | Called on error |
| `onData` | `(data: string) => void` | Called when data is received |
| `onBinary` | `(data: string) => void` | Called when binary data is received |
| `onResize` | `(cols: number, rows: number) => void` | Called when terminal resizes |
| `onTitleChange` | `(title: string) => void` | Called when title changes |
| `onSelectionChange` | `(selection: string) => void` | Called when selection changes |
| `onKey` | `(key: string, event: KeyboardEvent) => void` | Called on key press |
| `onBell` | `() => void` | Called when bell character is received |

#### Custom Renderers

| Prop | Type | Description |
|------|------|-------------|
| `renderToolbar` | `(props: ToolbarProps) => ReactNode` | Custom toolbar renderer |
| `renderContextMenu` | `(props: ContextMenuProps) => ReactNode` | Custom context menu renderer |
| `renderConnectionStatus` | `(state: ConnectionState) => ReactNode` | Custom status renderer |

### WebTerminalRef (Imperative API)

Access via `ref`:

```tsx
const terminalRef = useRef<WebTerminalRef>(null);

// Later...
terminalRef.current?.write('Hello World');
```

#### Terminal Access

| Method | Returns | Description |
|--------|---------|-------------|
| `getTerminal()` | `Terminal \| null` | Get raw xterm.js instance |
| `getAddon<T>(name)` | `T \| undefined` | Get loaded addon by name |

#### Connection

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Establish connection |
| `disconnect()` | `void` | Close connection |
| `reconnect()` | `Promise<void>` | Reconnect |
| `getConnectionState()` | `ConnectionState` | Get current connection state |

#### Writing

| Method | Description |
|--------|-------------|
| `write(data, options?)` | Write text to terminal |
| `writeln(data)` | Write text with newline |
| `writeError(message)` | Write red error message |
| `writeWarning(message)` | Write yellow warning message |
| `writeSuccess(message)` | Write green success message |
| `writeInfo(message)` | Write blue info message |

#### Terminal Control

| Method | Description |
|--------|-------------|
| `clear()` | Clear terminal buffer |
| `reset()` | Reset terminal to initial state |
| `focus()` | Focus the terminal |
| `blur()` | Blur the terminal |
| `scrollToTop()` | Scroll to top |
| `scrollToBottom()` | Scroll to bottom |
| `scrollToLine(line)` | Scroll to specific line |

#### Selection & Clipboard

| Method | Returns | Description |
|--------|---------|-------------|
| `getSelection()` | `string` | Get selected text |
| `selectAll()` | `void` | Select all text |
| `clearSelection()` | `void` | Clear selection |
| `hasSelection()` | `boolean` | Check if has selection |
| `copy()` | `Promise<string>` | Copy selection to clipboard |
| `paste()` | `Promise<string>` | Paste from clipboard |

#### Search

| Method | Returns | Description |
|--------|---------|-------------|
| `findNext(term)` | `boolean` | Find next occurrence |
| `findPrevious(term)` | `boolean` | Find previous occurrence |
| `findAll(term)` | `number` | Find all and return count |
| `clearSearch()` | `void` | Clear search highlighting |
| `openSearch()` | `void` | Open search dialog |
| `closeSearch()` | `void` | Close search dialog |

#### Serialization

| Method | Returns | Description |
|--------|---------|-------------|
| `serialize()` | `string` | Get terminal content as text |
| `serializeAsHTML()` | `string` | Get terminal content as HTML |

#### Dimensions

| Method | Returns | Description |
|--------|---------|-------------|
| `fit()` | `void` | Fit terminal to container |
| `getDimensions()` | `TerminalDimensions \| null` | Get current dimensions |
| `resize(cols, rows)` | `void` | Resize to specific size |

## Connection Configuration

### WebSocket Connection

```tsx
const config: TerminalConnectionConfig = {
  protocol: 'websocket',
  websocket: {
    url: 'wss://api.example.com/terminal/ws',
    protocols: ['terminal-v1'],
    binaryType: 'arraybuffer',
  },
  auth: {
    type: 'token',
    token: 'your-jwt-token',
  },
  heartbeat: {
    enabled: true,
    interval: 30000,
    message: 'ping',
    responseTimeout: 5000,
  },
};
```

### HTTP Polling Connection

```tsx
const config: TerminalConnectionConfig = {
  protocol: 'http',
  http: {
    baseUrl: 'https://api.example.com/terminal',
    inputEndpoint: '/input',
    outputEndpoint: '/output',
    pollInterval: 100,
    headers: {
      'Authorization': 'Bearer token',
    },
  },
};
```

### Custom Connection

```tsx
const config: TerminalConnectionConfig = {
  protocol: 'custom',
  custom: {
    connect: async () => {
      // Your connection logic
    },
    disconnect: async () => {
      // Your disconnection logic
    },
    send: (data) => {
      // Send data to your backend
    },
    sendBinary: (data) => {
      // Send binary data
    },
    onData: (callback) => {
      // Register data callback
    },
    onBinary: (callback) => {
      // Register binary callback
    },
  },
};
```

## Hooks

### useTerminalConnection

Manage terminal connections independently:

```tsx
import { useTerminalConnection } from '@your-saas/web-terminal';

const { connectionState, connect, disconnect, send } = useTerminalConnection({
  config: connectionConfig,
  autoConnect: true,
  onData: (data) => console.log('Received:', data),
});
```

### useTerminalHistory

Manage command history:

```tsx
import { useTerminalHistory } from '@your-saas/web-terminal';

const { history, addToHistory, navigateHistory, searchHistory } = useTerminalHistory({
  maxSize: 1000,
  persist: true,
  storageKey: 'my-terminal-history',
});
```

### useTerminalSearch

Manage search functionality:

```tsx
import { useTerminalSearch } from '@your-saas/web-terminal';

const { findNext, findPrevious, clearSearch, searchResults } = useTerminalSearch({
  searchAddon: searchAddonRef.current,
});
```

### useAgentLoop

Execute commands programmatically (for AI/automation):

```tsx
import { useAgentLoop } from '@your-saas/web-terminal';

const { executeCommand, cancelCommand, isProcessing } = useAgentLoop({
  connectionState,
  send,
  config: {
    maxConcurrentCommands: 1,
    defaultTimeout: 30000,
    onResponse: (response) => {
      console.log('Command completed:', response.exitCode);
    },
  },
});

// Execute a command and wait for result
const result = await executeCommand('ls -la', {
  cwd: '/home/user',
  timeout: 10000,
});
```

## Theming

### Built-in Themes

- `dark` - Default dark theme
- `light` - Light theme
- `monokai` - Monokai color scheme
- `dracula` - Dracula color scheme
- `nord` - Nord color scheme
- `solarized-dark` - Solarized Dark
- `solarized-light` - Solarized Light
- `github-dark` - GitHub Dark
- `github-light` - GitHub Light
- `one-dark` - Atom One Dark
- `gruvbox` - Gruvbox color scheme

### Custom Theme

```tsx
import { createTheme } from '@your-saas/web-terminal';

const myTheme = createTheme('dark', {
  background: '#0a0a0f',
  foreground: '#e0e0e0',
  cursor: '#ff6b6b',
  selectionBackground: 'rgba(255, 107, 107, 0.3)',
  // ... override any color
});

<WebTerminal customTheme={myTheme} />
```

### Theme with CSS Variables

```tsx
import { getThemeWithCSSVariables } from '@your-saas/web-terminal';

const cssVars = getThemeWithCSSVariables(myTheme);
// Returns: { '--terminal-background': '#0a0a0f', ... }
```

## Custom Context Menu

```tsx
<WebTerminal
  customContextMenuItems={[
    {
      id: 'run-script',
      label: 'Run Deployment Script',
      icon: '🚀',
      shortcut: '⌘R',
      onSelect: () => {
        terminalRef.current?.send('./deploy.sh\n');
      },
    },
    {
      id: 'export',
      label: 'Export Logs',
      icon: '📥',
      onSelect: async () => {
        const content = terminalRef.current?.serialize();
        // Download as file...
      },
    },
  ]}
/>
```

## Custom Toolbar

```tsx
<WebTerminal
  renderToolbar={({ title, connectionState, onConnect, onDisconnect, onClear }) => (
    <div className="my-custom-toolbar">
      <span>{title}</span>
      <span className={`status-${connectionState.status}`}>
        {connectionState.status}
      </span>
      <button onClick={onClear}>Clear</button>
      {connectionState.status === 'connected' ? (
        <button onClick={onDisconnect}>Disconnect</button>
      ) : (
        <button onClick={onConnect}>Connect</button>
      )}
    </div>
  )}
/>
```

## Server Protocol

The WebTerminal expects your backend to communicate using JSON messages for the agent loop functionality:

### Message Types

```typescript
// Client -> Server
interface ClientMessage {
  id: string;
  type: 'command' | 'control';
  payload: {
    // For 'command' type:
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    interactive?: boolean;
    
    // For 'control' type:
    action?: 'cancel' | 'cancelAll' | 'input' | 'signal' | 'keepAlive' | 'resize';
    commandId?: string;
    data?: string;
    signal?: string;
    cols?: number;
    rows?: number;
  };
  timestamp: Date;
}

// Server -> Client
interface ServerMessage {
  id: string;
  type: 'response' | 'status' | 'error';
  payload: {
    // For 'response' type:
    commandId?: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    duration?: number;
    
    // For 'error' type:
    commandId?: string;
    message?: string;
  };
  timestamp: Date;
}
```

### Example Server (Node.js)

```javascript
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  let pty = null;

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.type === 'command') {
      pty = spawn('bash', [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: message.payload.cwd || process.env.HOME,
        env: { ...process.env, ...message.payload.env },
      });
      
      pty.onData((data) => {
        ws.send(data); // Raw PTY output
      });
      
      pty.onExit(({ exitCode }) => {
        ws.send(JSON.stringify({
          type: 'response',
          payload: { commandId: message.id, exitCode },
        }));
      });
      
      if (message.payload.command) {
        pty.write(message.payload.command + '\n');
      }
    }
    
    if (message.type === 'control') {
      if (message.payload.action === 'resize' && pty) {
        pty.resize(message.payload.cols, message.payload.rows);
      }
      if (message.payload.action === 'input' && pty) {
        pty.write(message.payload.data);
      }
    }
  });

  ws.on('close', () => {
    if (pty) pty.kill();
  });
});
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + C` | Copy selection |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + F` | Open search |
| `Ctrl/Cmd + K` | Clear terminal (customizable) |
| `Escape` | Close search dialog |
| `Enter` | Find next (in search) |
| `Shift + Enter` | Find previous (in search) |

## Accessibility

The WebTerminal component includes:

- ARIA labels and roles
- Screen reader mode support
- Keyboard navigation
- Focus management
- Reduced motion support

Enable screen reader mode for enhanced accessibility:

```tsx
<WebTerminal
  screenReaderMode={true}
  ariaLabel="Container Terminal for project-123"
/>
```

## TypeScript

All types are exported:

```tsx
import type {
  WebTerminalProps,
  WebTerminalRef,
  TerminalConnectionConfig,
  ConnectionState,
  TerminalTheme,
  TerminalDimensions,
  AgentCommand,
  AgentResponse,
} from '@your-saas/web-terminal';
```

## License

MIT © Your SaaS Team

## Contributing

Contributions welcome! Please read our contributing guidelines first.

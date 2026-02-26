import { ITerminalOptions, ITerminalAddon, Terminal } from '@xterm/xterm';
import { ReactNode } from 'react';

// ============================================================================
// Connection Types
// ============================================================================

export type ConnectionProtocol = 'websocket' | 'http' | 'ssh' | 'custom';

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  binaryType?: BinaryType;
}

export interface HTTPConfig {
  baseUrl: string;
  inputEndpoint?: string;
  outputEndpoint?: string;
  pollInterval?: number;
  headers?: Record<string, string>;
}

export interface SSHConfig {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface CustomConnectionConfig {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (data: string) => void;
  sendBinary: (data: string) => void;
  onData: (callback: (data: string) => void) => void;
  onBinary: (callback: (data: string) => void) => void;
}

export interface TerminalConnectionConfig {
  id?: string;
  protocol: ConnectionProtocol;
  websocket?: WebSocketConfig;
  http?: HTTPConfig;
  ssh?: SSHConfig;
  custom?: CustomConnectionConfig;
  auth?: {
    type: 'token' | 'basic' | 'custom';
    token?: string;
    username?: string;
    password?: string;
    customAuth?: () => Promise<Record<string, string>>;
  };
  heartbeat?: {
    enabled: boolean;
    interval?: number;
    message?: string;
    responseTimeout?: number;
  };
}

export type ConnectionStateStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface ConnectionState {
  status: ConnectionStateStatus;
  error?: Error;
  lastConnected?: Date;
  reconnectAttempt?: number;
  latency?: number;
}

// ============================================================================
// Terminal Event Types
// ============================================================================

export interface TerminalEvent<T = unknown> {
  type: string;
  timestamp: Date;
  data?: T;
}

export interface TerminalResizeEvent {
  cols: number;
  rows: number;
  width: number;
  height: number;
}

export interface TerminalKeyEvent {
  key: string;
  domEvent: KeyboardEvent;
}

export interface TerminalRenderEvent {
  start: number;
  end: number;
}

// ============================================================================
// Addon Types
// ============================================================================

export interface AddonConfig<T extends ITerminalAddon = ITerminalAddon> {
  addon: T;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

export interface AddonsConfig {
  [key: string]: AddonConfig;
}

// ============================================================================
// Theme Types
// ============================================================================

export interface TerminalTheme {
  foreground?: string;
  background?: string;
  cursor?: string;
  cursorAccent?: string;
  selectionBackground?: string;
  selectionForeground?: string;
  selectionInactiveBackground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
  extendedAnsi?: string[];
}

export type BuiltInTheme = 'dark' | 'light' | 'monokai' | 'dracula' | 'nord' | 'solarized-dark' | 'solarized-light' | 'github-dark' | 'github-light' | 'one-dark' | 'gruvbox';

// ============================================================================
// UI Types
// ============================================================================

export interface ContextMenuItem {
  id?: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export interface ToolbarProps {
  title: string;
  connectionState: ConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onClear: () => void;
  onSearch: () => void;
}

export interface ContextMenuProps {
  selection: string;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onSelectAll: () => void;
  onSearch: () => void;
}

export interface ConnectionStatusProps {
  state: ConnectionState;
}

// ============================================================================
// Write Options
// ============================================================================

export interface TerminalWriteOptions {
  newLine?: boolean;
  style?: 'error' | 'warning' | 'success' | 'info' | 'default';
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// ============================================================================
// History Types
// ============================================================================

export interface HistoryEntry {
  command: string;
  timestamp: Date;
  exitCode?: number;
  duration?: number;
}

export interface HistoryOptions {
  maxSize: number;
  persist: boolean;
  storageKey: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  incremental?: boolean;
  decorations?: {
    activeMatchBackground?: string;
    activeMatchBorder?: string;
    matchBackground?: string;
    matchBorder?: string;
    matchOverviewRuler?: string;
  };
}

export interface SearchResult {
  term: string;
  totalMatches: number;
  currentMatch: number;
}

// ============================================================================
// Dimension Types
// ============================================================================

export interface TerminalDimensions {
  cols: number;
  rows: number;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
}

// ============================================================================
// Main Component Props
// ============================================================================

export interface WebTerminalProps {
  // Connection
  connectionConfig?: TerminalConnectionConfig;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;

  // Terminal Options
  terminalOptions?: ITerminalOptions;
  theme?: BuiltInTheme;
  customTheme?: TerminalTheme;
  fontSize?: number;
  fontFamily?: string;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollback?: number;
  tabStopWidth?: number;

  // Addons
  addons?: AddonsConfig;
  enableWebGL?: boolean;
  enableWebLinks?: boolean;
  enableSearch?: boolean;
  enableUnicode?: boolean;
  enableImageSupport?: boolean;
  enableClipboard?: boolean;

  // UI Configuration
  showToolbar?: boolean;
  showConnectionStatus?: boolean;
  showScrollbar?: boolean;
  toolbarPosition?: 'top' | 'bottom';
  contextMenuEnabled?: boolean;
  customContextMenuItems?: ContextMenuItem[];

  // Behavior
  focusOnMount?: boolean;
  preserveHistory?: boolean;
  maxHistorySize?: number;
  localEcho?: boolean;
  bracketedPasteMode?: boolean;

  // Dimensions
  width?: string | number;
  height?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;

  // Events
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Error) => void;
  onData?: (data: string) => void;
  onBinary?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTitleChange?: (title: string) => void;
  onSelectionChange?: (selection: string) => void;
  onLineFeed?: () => void;
  onScroll?: (position: number) => void;
  onKey?: (key: string, event: KeyboardEvent) => void;
  onCursorMove?: () => void;
  onBell?: () => void;
  onRender?: (event: TerminalRenderEvent) => void;
  onWriteParsed?: () => void;

  // Custom Renderers
  renderToolbar?: (props: ToolbarProps) => ReactNode;
  renderContextMenu?: (props: ContextMenuProps) => ReactNode;
  renderConnectionStatus?: (state: ConnectionState) => ReactNode;

  // Accessibility
  ariaLabel?: string;
  screenReaderMode?: boolean;

  // Styling
  className?: string;
  style?: React.CSSProperties;
  containerClassName?: string;
  terminalClassName?: string;

  // Children
  children?: ReactNode;
}

// ============================================================================
// Ref Types (Imperative API)
// ============================================================================

export interface WebTerminalRef {
  // Terminal instance
  getTerminal: () => Terminal | null;
  getAddon: <T extends ITerminalAddon>(name: string) => T | undefined;

  // Connection
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  getConnectionState: () => ConnectionState;

  // Writing
  write: (data: string, options?: TerminalWriteOptions) => void;
  writeln: (data: string) => void;
  writeError: (message: string) => void;
  writeWarning: (message: string) => void;
  writeSuccess: (message: string) => void;
  writeInfo: (message: string) => void;

  // Terminal control
  clear: () => void;
  reset: () => void;
  focus: () => void;
  blur: () => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  scrollToLine: (line: number) => void;

  // Selection
  getSelection: () => string;
  selectAll: () => void;
  clearSelection: () => void;
  hasSelection: () => boolean;

  // Clipboard
  copy: () => Promise<string>;
  paste: () => Promise<string>;

  // Search
  findNext: (term: string) => boolean;
  findPrevious: (term: string) => boolean;
  findAll: (term: string) => number;
  clearSearch: () => void;
  openSearch: () => void;
  closeSearch: () => void;

  // History
  getHistory: () => HistoryEntry[];
  clearHistory: () => void;
  searchHistory: (query: string) => HistoryEntry[];

  // Serialization
  serialize: () => string;
  serializeAsHTML: () => string;

  // Dimensions
  fit: () => void;
  getDimensions: () => TerminalDimensions | null;
  resize: (cols: number, rows: number) => void;

  // Options
  setOption: <K extends keyof ITerminalOptions>(key: K, value: ITerminalOptions[K]) => void;
  getOption: <K extends keyof ITerminalOptions>(key: K) => ITerminalOptions[K] | undefined;

  // Theme
  setTheme: (theme: TerminalTheme) => void;

  // Raw send
  send: (data: string) => void;
  sendBinary: (data: string) => void;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseTerminalConnectionReturn {
  connectionState: ConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  send: (data: string) => void;
  sendBinary: (data: string) => void;
}

export interface UseTerminalResizeReturn {
  fitTerminal: () => void;
  dimensions: TerminalDimensions | null;
}

export interface UseTerminalHistoryReturn {
  history: HistoryEntry[];
  historyIndex: number;
  addToHistory: (entry: HistoryEntry) => void;
  navigateHistory: (direction: 'up' | 'down') => HistoryEntry | null;
  clearHistory: () => void;
  searchHistory: (query: string) => HistoryEntry[];
}

export interface UseTerminalSearchReturn {
  searchResults: SearchResult | null;
  currentMatch: number;
  findNext: (term: string) => boolean;
  findPrevious: (term: string) => boolean;
  findAll: (term: string) => number;
  clearSearch: () => void;
}

// ============================================================================
// Agent Loop Types
// ============================================================================

export interface AgentMessage {
  id: string;
  type: 'command' | 'response' | 'status' | 'error' | 'control';
  payload: unknown;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentCommand {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  interactive?: boolean;
}

export interface AgentResponse {
  commandId: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
  duration: number;
  truncated?: boolean;
}

export interface AgentLoopConfig {
  maxConcurrentCommands?: number;
  defaultTimeout?: number;
  keepAliveInterval?: number;
  bufferSize?: number;
  onCommand?: (command: AgentCommand) => void;
  onResponse?: (response: AgentResponse) => void;
  onStatus?: (status: string) => void;
  onError?: (error: Error) => void;
}

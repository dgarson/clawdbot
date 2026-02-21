/**
 * WebTerminal Usage Examples
 * 
 * This file demonstrates various ways to use the WebTerminal component
 * for different use cases in your SaaS application.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  WebTerminal,
  WebTerminalRef,
  TerminalConnectionConfig,
  defaultThemes,
  createTheme,
  useAgentLoop,
} from '@your-saas/web-terminal';

// Don't forget to import styles
import '@your-saas/web-terminal/styles.css';

// ============================================================================
// Example 1: Basic Usage with WebSocket Connection
// ============================================================================

export function BasicTerminal() {
  const terminalRef = useRef<WebTerminalRef>(null);

  const connectionConfig: TerminalConnectionConfig = {
    id: 'user-container-123',
    protocol: 'websocket',
    websocket: {
      url: 'wss://your-api.com/terminal/ws',
      protocols: ['terminal'],
    },
    auth: {
      type: 'token',
      token: 'your-jwt-token',
    },
    heartbeat: {
      enabled: true,
      interval: 30000,
      message: 'ping',
    },
  };

  return (
    <WebTerminal
      ref={terminalRef}
      connectionConfig={connectionConfig}
      theme="dracula"
      height="500px"
      onConnect={() => console.log('Connected!')}
      onDisconnect={(reason) => console.log('Disconnected:', reason)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}

// ============================================================================
// Example 2: Full Featured Power User Terminal
// ============================================================================

export function PowerUserTerminal() {
  const terminalRef = useRef<WebTerminalRef>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const connectionConfig: TerminalConnectionConfig = {
    id: 'power-user-session',
    protocol: 'websocket',
    websocket: {
      url: `wss://api.your-saas.com/containers/${process.env.CONTAINER_ID}/terminal`,
      binaryType: 'arraybuffer',
    },
    auth: {
      type: 'custom',
      customAuth: async () => {
        // Fetch a fresh token before connecting
        const response = await fetch('/api/terminal/token');
        const { token } = await response.json();
        return { Authorization: `Bearer ${token}` };
      },
    },
    heartbeat: {
      enabled: true,
      interval: 15000,
      responseTimeout: 5000,
    },
  };

  // Custom theme extending one-dark
  const customTheme = createTheme('one-dark', {
    cursor: '#61afef',
    cursorAccent: '#282c34',
    selectionBackground: 'rgba(97, 175, 239, 0.3)',
  });

  // Custom context menu items
  const customContextMenuItems = [
    {
      id: 'run-diagnostics',
      label: 'Run Diagnostics',
      icon: '🔧',
      shortcut: '⌘D',
      onSelect: () => {
        terminalRef.current?.write('\n$ run-diagnostics\n');
        terminalRef.current?.send('run-diagnostics\n');
      },
    },
    {
      id: 'export-logs',
      label: 'Export Logs',
      icon: '📥',
      onSelect: async () => {
        const content = terminalRef.current?.serialize() || '';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `terminal-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      },
    },
  ];

  const handleResize = (cols: number, rows: number) => {
    console.log(`Terminal resized: ${cols}x${rows}`);
    // You might want to notify your backend about the resize
  };

  const handleKey = (key: string, event: KeyboardEvent) => {
    // Handle custom keyboard shortcuts
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      terminalRef.current?.clear();
    }
  };

  return (
    <div className={`terminal-wrapper ${isFullscreen ? 'fullscreen' : ''}`}>
      <WebTerminal
        ref={terminalRef}
        connectionConfig={connectionConfig}
        
        // Terminal options
        customTheme={customTheme}
        fontSize={14}
        fontFamily="'Fira Code', 'JetBrains Mono', monospace"
        cursorStyle="bar"
        cursorBlink={true}
        scrollback={50000}
        
        // Addons
        enableWebGL={true}
        enableWebLinks={true}
        enableSearch={true}
        enableUnicode={true}
        enableClipboard={true}
        
        // UI Configuration
        showToolbar={true}
        showConnectionStatus={true}
        toolbarPosition="top"
        contextMenuEnabled={true}
        customContextMenuItems={customContextMenuItems}
        
        // Behavior
        focusOnMount={true}
        preserveHistory={true}
        maxHistorySize={5000}
        
        // Dimensions
        height={isFullscreen ? '100vh' : '600px'}
        width="100%"
        
        // Events
        onConnect={() => {
          terminalRef.current?.writeSuccess('Connected to container!');
        }}
        onDisconnect={(reason) => {
          terminalRef.current?.writeError(`Disconnected: ${reason}`);
        }}
        onResize={handleResize}
        onKey={handleKey}
        onTitleChange={(title) => {
          document.title = `Terminal: ${title}`;
        }}
        
        // Accessibility
        ariaLabel="Power User Terminal"
        
        // Styling
        className="power-user-terminal"
      />
      
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="fullscreen-toggle"
      >
        {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>
    </div>
  );
}

// ============================================================================
// Example 3: Agent Loop / AI Assistant Integration
// ============================================================================

export function AgentTerminal() {
  const terminalRef = useRef<WebTerminalRef>(null);
  const [commands, setCommands] = useState<string[]>([]);

  const connectionConfig: TerminalConnectionConfig = {
    id: 'agent-session',
    protocol: 'websocket',
    websocket: {
      url: 'wss://api.your-saas.com/agent/terminal',
    },
  };

  // Use the agent loop hook for command execution
  const {
    isProcessing,
    executeCommand,
    cancelCommand,
    cancelAll,
    activeCommands,
    completedCommands,
  } = useAgentLoop({
    connectionState: { status: 'connected' },
    send: (data) => terminalRef.current?.send(data),
    config: {
      maxConcurrentCommands: 1,
      defaultTimeout: 60000,
      onCommand: (cmd) => {
        console.log('Executing:', cmd.command);
        setCommands((prev) => [...prev, cmd.command]);
      },
      onResponse: (response) => {
        console.log('Command completed:', response.exitCode);
        if (response.exitCode !== 0) {
          terminalRef.current?.writeError(`Exit code: ${response.exitCode}`);
        }
      },
      onStatus: (status) => {
        terminalRef.current?.writeInfo(status);
      },
      onError: (error) => {
        terminalRef.current?.writeError(error.message);
      },
    },
  });

  // Execute a series of commands (like an AI agent would)
  const runAgentWorkflow = async () => {
    try {
      // Step 1: Check system info
      terminalRef.current?.writeInfo('🤖 Starting agent workflow...\n');
      
      const sysInfo = await executeCommand('uname -a');
      terminalRef.current?.writeln(`System: ${sysInfo.stdout}`);

      // Step 2: List files
      const files = await executeCommand('ls -la', { cwd: '/home/user' });
      terminalRef.current?.writeln(files.stdout || '');

      // Step 3: Run a task
      const result = await executeCommand('npm run build', {
        cwd: '/home/user/project',
        timeout: 120000,
        env: { NODE_ENV: 'production' },
      });

      if (result.exitCode === 0) {
        terminalRef.current?.writeSuccess('✅ Build completed successfully!');
      } else {
        terminalRef.current?.writeError(`❌ Build failed: ${result.stderr}`);
      }
    } catch (error) {
      terminalRef.current?.writeError(`Workflow failed: ${(error as Error).message}`);
    }
  };

  return (
    <div className="agent-terminal-container">
      <div className="agent-controls">
        <button 
          onClick={runAgentWorkflow} 
          disabled={isProcessing}
        >
          {isProcessing ? 'Running...' : 'Run Agent Workflow'}
        </button>
        
        <button 
          onClick={cancelAll} 
          disabled={!isProcessing}
        >
          Cancel All
        </button>

        <div className="status">
          Active: {activeCommands.length} | 
          Completed: {completedCommands.length}
        </div>
      </div>

      <WebTerminal
        ref={terminalRef}
        connectionConfig={connectionConfig}
        theme="github-dark"
        height="400px"
        showToolbar={true}
      />

      <div className="command-history">
        <h4>Command History</h4>
        <ul>
          {commands.map((cmd, i) => (
            <li key={i}>{cmd}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Custom Toolbar and Rendering
// ============================================================================

export function CustomizedTerminal() {
  const terminalRef = useRef<WebTerminalRef>(null);

  const connectionConfig: TerminalConnectionConfig = {
    protocol: 'websocket',
    websocket: {
      url: 'wss://api.your-saas.com/terminal',
    },
  };

  // Custom toolbar renderer
  const renderCustomToolbar = ({ title, connectionState, onConnect, onDisconnect, onClear, onSearch }) => (
    <div className="custom-toolbar">
      <div className="custom-toolbar-left">
        <span className="terminal-icon">⚡</span>
        <span className="terminal-title">{title}</span>
        <span className={`status-badge status-${connectionState.status}`}>
          {connectionState.status}
        </span>
      </div>
      
      <div className="custom-toolbar-right">
        <button onClick={onSearch} title="Search">🔍</button>
        <button onClick={onClear} title="Clear">🗑️</button>
        <button onClick={() => {
          const content = terminalRef.current?.serialize();
          console.log('Terminal content:', content);
        }} title="Export">📤</button>
        {connectionState.status === 'connected' ? (
          <button onClick={onDisconnect} className="disconnect-btn">Disconnect</button>
        ) : (
          <button onClick={onConnect} className="connect-btn">Connect</button>
        )}
      </div>
    </div>
  );

  // Custom connection status renderer
  const renderCustomConnectionStatus = (state) => (
    <div className={`custom-status custom-status-${state.status}`}>
      <div className="status-indicator" />
      <span>
        {state.status === 'connected' && `Connected • ${state.latency || '?'}ms`}
        {state.status === 'connecting' && 'Establishing connection...'}
        {state.status === 'reconnecting' && `Reconnecting (${state.reconnectAttempt})...`}
        {state.status === 'disconnected' && 'Offline'}
        {state.status === 'error' && `Error: ${state.error?.message}`}
      </span>
    </div>
  );

  return (
    <WebTerminal
      ref={terminalRef}
      connectionConfig={connectionConfig}
      theme="monokai"
      height="500px"
      renderToolbar={renderCustomToolbar}
      renderConnectionStatus={renderCustomConnectionStatus}
    />
  );
}

// ============================================================================
// Example 5: Multiple Terminals (Split View)
// ============================================================================

export function SplitTerminals() {
  const terminal1Ref = useRef<WebTerminalRef>(null);
  const terminal2Ref = useRef<WebTerminalRef>(null);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');

  const createConnection = (id: string): TerminalConnectionConfig => ({
    id,
    protocol: 'websocket',
    websocket: {
      url: `wss://api.your-saas.com/terminal/${id}`,
    },
  });

  // Sync scroll between terminals
  const syncScroll = (sourceRef: React.RefObject<WebTerminalRef>, targetRef: React.RefObject<WebTerminalRef>) => {
    // This would require listening to scroll events and syncing
    // Implementation depends on your needs
  };

  return (
    <div className={`split-terminals split-${layout}`}>
      <div className="split-controls">
        <button onClick={() => setLayout('horizontal')}>Horizontal</button>
        <button onClick={() => setLayout('vertical')}>Vertical</button>
      </div>
      
      <div className="terminal-pane">
        <WebTerminal
          ref={terminal1Ref}
          connectionConfig={createConnection('terminal-1')}
          theme="one-dark"
          height={layout === 'horizontal' ? '300px' : '100%'}
          showToolbar={true}
        />
      </div>
      
      <div className="terminal-pane">
        <WebTerminal
          ref={terminal2Ref}
          connectionConfig={createConnection('terminal-2')}
          theme="one-dark"
          height={layout === 'horizontal' ? '300px' : '100%'}
          showToolbar={true}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Read-Only Terminal (Logs Viewer)
// ============================================================================

export function LogsViewer({ containerId }: { containerId: string }) {
  const terminalRef = useRef<WebTerminalRef>(null);

  useEffect(() => {
    // Connect to logs stream
    const eventSource = new EventSource(`/api/containers/${containerId}/logs`);
    
    eventSource.onmessage = (event) => {
      const log = JSON.parse(event.data);
      
      // Color-code based on log level
      switch (log.level) {
        case 'error':
          terminalRef.current?.writeError(log.message);
          break;
        case 'warn':
          terminalRef.current?.writeWarning(log.message);
          break;
        case 'info':
          terminalRef.current?.writeInfo(log.message);
          break;
        default:
          terminalRef.current?.writeln(log.message);
      }
    };

    return () => eventSource.close();
  }, [containerId]);

  return (
    <WebTerminal
      ref={terminalRef}
      // No connection config - we're handling data manually
      autoConnect={false}
      theme="github-dark"
      height="400px"
      
      // Make it read-only by not sending input
      terminalOptions={{
        disableStdin: true,
        cursorBlink: false,
      }}
      cursorStyle="underline"
      
      // UI
      showToolbar={true}
      contextMenuEnabled={true}
      
      // Allow copy but not paste
      enableClipboard={true}
    />
  );
}

// ============================================================================
// Example 7: Using Imperative API
// ============================================================================

export function ImperativeApiExample() {
  const terminalRef = useRef<WebTerminalRef>(null);

  const runDemo = async () => {
    const terminal = terminalRef.current;
    if (!terminal) {return;}

    // Write styled output
    terminal.writeln('');
    terminal.writeSuccess('✓ Connection established');
    terminal.writeInfo('ℹ Starting demo...');
    terminal.writeln('');

    // Simulate command execution
    terminal.write('$ ');
    
    // Type effect
    const command = 'npm install --save @your-saas/web-terminal';
    for (const char of command) {
      terminal.write(char);
      await sleep(50);
    }
    terminal.writeln('');
    
    // Show progress
    terminal.writeInfo('Installing packages...');
    
    for (let i = 0; i <= 100; i += 10) {
      terminal.write(`\r[${progressBar(i)}] ${i}%`);
      await sleep(100);
    }
    terminal.writeln('');
    
    terminal.writeSuccess('✓ Installation complete!');
    terminal.writeln('');
    
    // Search for something
    terminal.openSearch();
    setTimeout(() => {
      terminal.findAll('npm');
    }, 500);
  };

  return (
    <div>
      <button onClick={runDemo}>Run Demo</button>
      
      <button onClick={() => terminalRef.current?.clear()}>
        Clear
      </button>
      
      <button onClick={async () => {
        const html = terminalRef.current?.serializeAsHTML();
        console.log('HTML output:', html);
      }}>
        Export HTML
      </button>
      
      <button onClick={() => {
        const dims = terminalRef.current?.getDimensions();
        alert(`Terminal: ${dims?.cols} columns × ${dims?.rows} rows`);
      }}>
        Get Dimensions
      </button>

      <WebTerminal
        ref={terminalRef}
        autoConnect={false}
        theme="nord"
        height="400px"
        focusOnMount={true}
      />
    </div>
  );
}

// Utility functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const progressBar = (percent: number) => {
  const filled = Math.floor(percent / 5);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
};

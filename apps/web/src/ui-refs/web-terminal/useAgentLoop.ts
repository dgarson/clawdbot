import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  AgentLoopConfig,
  AgentMessage,
  AgentCommand,
  AgentResponse,
  ConnectionState,
} from '../types';

interface UseAgentLoopOptions {
  connectionState: ConnectionState;
  send: (data: string) => void;
  config?: AgentLoopConfig;
}

interface AgentLoopState {
  isProcessing: boolean;
  pendingCommands: AgentCommand[];
  activeCommands: Map<string, AgentCommand>;
  completedCommands: AgentResponse[];
  error: Error | null;
}

export function useAgentLoop({
  connectionState,
  send,
  config = {},
}: UseAgentLoopOptions) {
  const {
    maxConcurrentCommands = 1,
    defaultTimeout = 30000,
    keepAliveInterval = 30000,
    bufferSize = 1024 * 1024, // 1MB default
    onCommand,
    onResponse,
    onStatus,
    onError,
  } = config;

  const [state, setState] = useState<AgentLoopState>({
    isProcessing: false,
    pendingCommands: [],
    activeCommands: new Map(),
    completedCommands: [],
    error: null,
  });

  const commandIdCounter = useRef(0);
  const outputBuffers = useRef<Map<string, string[]>>(new Map());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);

  // Generate unique command ID
  const generateCommandId = useCallback(() => {
    return `cmd_${Date.now()}_${++commandIdCounter.current}`;
  }, []);

  // Clear timeout for a command
  const clearCommandTimeout = useCallback((commandId: string) => {
    const timeout = timeoutRefs.current.get(commandId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(commandId);
    }
  }, []);

  // Set timeout for a command
  const setCommandTimeout = useCallback((command: AgentCommand) => {
    const timeout = command.timeout || defaultTimeout;
    
    const timeoutId = setTimeout(() => {
      handleCommandTimeout(command.id);
    }, timeout);

    timeoutRefs.current.set(command.id, timeoutId);
  }, [defaultTimeout]);

  // Handle command timeout
  const handleCommandTimeout = useCallback((commandId: string) => {
    const error = new Error(`Command ${commandId} timed out`);
    
    setState((prev) => {
      const activeCommands = new Map(prev.activeCommands);
      const command = activeCommands.get(commandId);
      activeCommands.delete(commandId);

      if (command) {
        const response: AgentResponse = {
          commandId,
          exitCode: -1,
          stderr: 'Command timed out',
          duration: command.timeout || defaultTimeout,
          truncated: false,
        };
        onResponse?.(response);
      }

      return {
        ...prev,
        activeCommands,
        error,
      };
    });

    onError?.(error);
    outputBuffers.current.delete(commandId);
  }, [defaultTimeout, onError, onResponse]);

  // Execute a single command
  const executeCommand = useCallback(async (
    command: string,
    options: Partial<Omit<AgentCommand, 'id' | 'command'>> = {}
  ): Promise<AgentResponse> => {
    if (connectionState.status !== 'connected') {
      throw new Error('Not connected');
    }

    const commandId = generateCommandId();
    const agentCommand: AgentCommand = {
      id: commandId,
      command,
      ...options,
    };

    return new Promise((resolve, reject) => {
      // Store resolve/reject for later
      const commandWithHandlers = {
        ...agentCommand,
        resolve,
        reject,
      };

      setState((prev) => ({
        ...prev,
        pendingCommands: [...prev.pendingCommands, commandWithHandlers],
      }));

      // Process queue
      processQueue();
    });
  }, [connectionState.status, generateCommandId]);

  // Process the command queue
  const processQueue = useCallback(() => {
    setState((prev) => {
      if (prev.activeCommands.size >= maxConcurrentCommands) {
        return prev;
      }

      const pendingCommands = [...prev.pendingCommands];
      const activeCommands = new Map(prev.activeCommands);
      
      while (
        pendingCommands.length > 0 &&
        activeCommands.size < maxConcurrentCommands
      ) {
        const command = pendingCommands.shift()!;
        activeCommands.set(command.id, command);
        
        // Initialize output buffer
        outputBuffers.current.set(command.id, []);
        
        // Set timeout
        setCommandTimeout(command);
        
        // Send command to server
        const message: AgentMessage = {
          id: command.id,
          type: 'command',
          payload: {
            command: command.command,
            args: command.args,
            env: command.env,
            cwd: command.cwd,
            interactive: command.interactive,
          },
          timestamp: new Date(),
        };
        
        send(JSON.stringify(message));
        onCommand?.(command);
        onStatus?.(`Executing: ${command.command}`);
      }

      return {
        ...prev,
        isProcessing: activeCommands.size > 0,
        pendingCommands,
        activeCommands,
      };
    });
  }, [maxConcurrentCommands, send, setCommandTimeout, onCommand, onStatus]);

  // Handle incoming data from server
  const handleServerMessage = useCallback((data: string) => {
    try {
      const message: AgentMessage = JSON.parse(data);
      
      switch (message.type) {
        case 'response': {
          const response = message.payload as AgentResponse;
          const commandId = response.commandId;
          
          clearCommandTimeout(commandId);
          
          setState((prev) => {
            const activeCommands = new Map(prev.activeCommands);
            const command = activeCommands.get(commandId) as any;
            activeCommands.delete(commandId);
            
            // Resolve the promise
            if (command?.resolve) {
              command.resolve(response);
            }

            return {
              ...prev,
              isProcessing: activeCommands.size > 0 || prev.pendingCommands.length > 0,
              activeCommands,
              completedCommands: [...prev.completedCommands, response].slice(-100),
            };
          });
          
          onResponse?.(response);
          outputBuffers.current.delete(commandId);
          
          // Process next command in queue
          processQueue();
          break;
        }
        
        case 'status': {
          onStatus?.(message.payload as string);
          break;
        }
        
        case 'error': {
          const errorPayload = message.payload as { commandId?: string; message: string };
          const error = new Error(errorPayload.message);
          
          if (errorPayload.commandId) {
            clearCommandTimeout(errorPayload.commandId);
            
            setState((prev) => {
              const activeCommands = new Map(prev.activeCommands);
              const command = activeCommands.get(errorPayload.commandId!) as any;
              activeCommands.delete(errorPayload.commandId!);
              
              if (command?.reject) {
                command.reject(error);
              }

              return {
                ...prev,
                isProcessing: activeCommands.size > 0 || prev.pendingCommands.length > 0,
                activeCommands,
                error,
              };
            });
            
            outputBuffers.current.delete(errorPayload.commandId);
          }
          
          onError?.(error);
          processQueue();
          break;
        }
        
        case 'control': {
          // Handle control messages (e.g., resize, signal)
          break;
        }
      }
    } catch (error) {
      console.error('Failed to parse server message:', error);
    }
  }, [clearCommandTimeout, onResponse, onStatus, onError, processQueue]);

  // Cancel a specific command
  const cancelCommand = useCallback((commandId: string) => {
    clearCommandTimeout(commandId);
    
    // Send cancel signal to server
    const message: AgentMessage = {
      id: generateCommandId(),
      type: 'control',
      payload: { action: 'cancel', commandId },
      timestamp: new Date(),
    };
    send(JSON.stringify(message));
    
    setState((prev) => {
      const activeCommands = new Map(prev.activeCommands);
      const command = activeCommands.get(commandId) as any;
      activeCommands.delete(commandId);
      
      if (command?.reject) {
        command.reject(new Error('Command cancelled'));
      }

      const pendingCommands = prev.pendingCommands.filter(
        (cmd) => cmd.id !== commandId
      );

      return {
        ...prev,
        pendingCommands,
        activeCommands,
        isProcessing: activeCommands.size > 0 || pendingCommands.length > 0,
      };
    });

    outputBuffers.current.delete(commandId);
  }, [clearCommandTimeout, generateCommandId, send]);

  // Cancel all commands
  const cancelAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach((_, commandId) => {
      clearCommandTimeout(commandId);
    });

    // Send cancel all signal
    const message: AgentMessage = {
      id: generateCommandId(),
      type: 'control',
      payload: { action: 'cancelAll' },
      timestamp: new Date(),
    };
    send(JSON.stringify(message));

    setState((prev) => {
      // Reject all pending and active commands
      prev.pendingCommands.forEach((cmd: any) => {
        cmd.reject?.(new Error('All commands cancelled'));
      });
      prev.activeCommands.forEach((cmd: any) => {
        cmd.reject?.(new Error('All commands cancelled'));
      });

      return {
        ...prev,
        isProcessing: false,
        pendingCommands: [],
        activeCommands: new Map(),
      };
    });

    outputBuffers.current.clear();
  }, [clearCommandTimeout, generateCommandId, send]);

  // Send input to an interactive command
  const sendInput = useCallback((commandId: string, input: string) => {
    if (!state.activeCommands.has(commandId)) {
      console.warn(`No active command with id ${commandId}`);
      return;
    }

    const message: AgentMessage = {
      id: generateCommandId(),
      type: 'control',
      payload: { action: 'input', commandId, data: input },
      timestamp: new Date(),
    };
    send(JSON.stringify(message));
  }, [state.activeCommands, generateCommandId, send]);

  // Send signal to a command
  const sendSignal = useCallback((commandId: string, signal: string) => {
    const message: AgentMessage = {
      id: generateCommandId(),
      type: 'control',
      payload: { action: 'signal', commandId, signal },
      timestamp: new Date(),
    };
    send(JSON.stringify(message));
  }, [generateCommandId, send]);

  // Setup keep-alive
  useEffect(() => {
    if (connectionState.status === 'connected' && keepAliveInterval > 0) {
      keepAliveRef.current = setInterval(() => {
        const message: AgentMessage = {
          id: generateCommandId(),
          type: 'control',
          payload: { action: 'keepAlive' },
          timestamp: new Date(),
        };
        send(JSON.stringify(message));
      }, keepAliveInterval);
    }

    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
    };
  }, [connectionState.status, keepAliveInterval, generateCommandId, send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
    };
  }, []);

  return {
    // State
    isProcessing: state.isProcessing,
    pendingCommands: state.pendingCommands,
    activeCommands: Array.from(state.activeCommands.values()),
    completedCommands: state.completedCommands,
    error: state.error,
    
    // Actions
    executeCommand,
    cancelCommand,
    cancelAll,
    sendInput,
    sendSignal,
    handleServerMessage,
  };
}

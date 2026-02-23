// ============================================================================
// API ROUTE FOR VERCEL AI SDK - /api/chat/route.ts
// Handles streaming chat with tool calls, multi-provider support
// ============================================================================

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { streamText, tool, convertToCoreMessages, generateId } from 'ai';
import { z } from 'zod';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const tools = {
  web_search: tool({
    description: 'Search the internet for current information',
    parameters: z.object({
      query: z.string().describe('The search query'),
      maxResults: z.number().optional().default(5).describe('Maximum number of results'),
    }),
    execute: async ({ query, maxResults }) => {
      // Simulated web search - replace with actual implementation
      console.log(`[Tool] Web search: "${query}" (max: ${maxResults})`);
      return {
        results: [
          { title: 'Result 1', snippet: `Information about ${query}...`, url: 'https://example.com/1' },
          { title: 'Result 2', snippet: `More details on ${query}...`, url: 'https://example.com/2' },
        ],
        totalResults: 2,
      };
    },
  }),

  web_scrape: tool({
    description: 'Extract content from a web page',
    parameters: z.object({
      url: z.string().url().describe('The URL to scrape'),
      selector: z.string().optional().describe('CSS selector for specific content'),
    }),
    execute: async ({ url, selector }) => {
      console.log(`[Tool] Web scrape: ${url} (selector: ${selector || 'full page'})`);
      return {
        title: 'Page Title',
        content: `Content extracted from ${url}...`,
        metadata: { url, scrapedAt: new Date().toISOString() },
      };
    },
  }),

  code_execute: tool({
    description: 'Execute code in a sandboxed environment',
    parameters: z.object({
      language: z.enum(['javascript', 'python', 'typescript']).describe('Programming language'),
      code: z.string().describe('The code to execute'),
      timeout: z.number().optional().default(30000).describe('Execution timeout in ms'),
    }),
    execute: async ({ language, code, timeout }) => {
      console.log(`[Tool] Code execution (${language}):`, code.substring(0, 100));
      // In production, this would use a sandboxed execution environment
      return {
        stdout: 'Hello, World!',
        stderr: '',
        exitCode: 0,
        executionTime: 150,
      };
    },
  }),

  code_analyze: tool({
    description: 'Analyze code for issues, patterns, and suggestions',
    parameters: z.object({
      code: z.string().describe('The code to analyze'),
      language: z.string().describe('Programming language'),
      checks: z.array(z.string()).optional().describe('Specific checks to run'),
    }),
    execute: async ({ code, language, checks }) => {
      console.log(`[Tool] Code analysis (${language})`);
      return {
        issues: [],
        suggestions: [
          { line: 5, message: 'Consider using const instead of let', severity: 'info' },
        ],
        complexity: { cyclomatic: 3, cognitive: 2 },
      };
    },
  }),

  file_read: tool({
    description: 'Read the contents of a file',
    parameters: z.object({
      path: z.string().describe('Path to the file'),
      encoding: z.string().optional().default('utf-8').describe('File encoding'),
    }),
    execute: async ({ path, encoding }) => {
      console.log(`[Tool] File read: ${path}`);
      return {
        content: `Contents of ${path}...`,
        size: 1024,
        encoding,
      };
    },
  }),

  file_write: tool({
    description: 'Write content to a file',
    parameters: z.object({
      path: z.string().describe('Path to the file'),
      content: z.string().describe('Content to write'),
      mode: z.enum(['overwrite', 'append']).optional().default('overwrite'),
    }),
    execute: async ({ path, content, mode }) => {
      console.log(`[Tool] File write: ${path} (${mode})`);
      return {
        success: true,
        path,
        bytesWritten: content.length,
      };
    },
  }),

  db_query: tool({
    description: 'Query a database',
    parameters: z.object({
      query: z.string().describe('SQL query or database command'),
      database: z.string().optional().describe('Database name'),
      params: z.array(z.any()).optional().describe('Query parameters'),
    }),
    execute: async ({ query, database, params }) => {
      console.log(`[Tool] Database query: ${query}`);
      return {
        rows: [
          { id: 1, name: 'Example', value: 100 },
          { id: 2, name: 'Sample', value: 200 },
        ],
        rowCount: 2,
        executionTime: 45,
      };
    },
  }),

  db_mutate: tool({
    description: 'Insert, update, or delete database records',
    parameters: z.object({
      operation: z.enum(['insert', 'update', 'delete']).describe('Operation type'),
      table: z.string().describe('Table name'),
      data: z.record(z.any()).optional().describe('Data for insert/update'),
      where: z.record(z.any()).optional().describe('Where clause for update/delete'),
    }),
    execute: async ({ operation, table, data, where }) => {
      console.log(`[Tool] Database ${operation}: ${table}`);
      return {
        success: true,
        affectedRows: 1,
        operation,
      };
    },
  }),

  shell_exec: tool({
    description: 'Execute a shell command',
    parameters: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory'),
      timeout: z.number().optional().default(60000).describe('Timeout in ms'),
    }),
    execute: async ({ command, cwd, timeout }) => {
      console.log(`[Tool] Shell exec: ${command}`);
      // In production, this would be heavily sandboxed
      return {
        stdout: 'Command output...',
        stderr: '',
        exitCode: 0,
      };
    },
  }),

  ai_embed: tool({
    description: 'Generate embeddings for text',
    parameters: z.object({
      text: z.union([z.string(), z.array(z.string())]).describe('Text to embed'),
      model: z.string().optional().default('text-embedding-3-small'),
    }),
    execute: async ({ text, model }) => {
      const texts = Array.isArray(text) ? text : [text];
      console.log(`[Tool] AI embed: ${texts.length} texts`);
      return {
        embeddings: texts.map(() => Array(1536).fill(0).map(() => Math.random())),
        model,
        dimensions: 1536,
      };
    },
  }),

  ai_generate: tool({
    description: 'Generate content using AI',
    parameters: z.object({
      prompt: z.string().describe('Generation prompt'),
      type: z.enum(['text', 'image', 'code']).describe('Type of content to generate'),
      options: z.record(z.any()).optional().describe('Generation options'),
    }),
    execute: async ({ prompt, type, options }) => {
      console.log(`[Tool] AI generate (${type}): ${prompt.substring(0, 50)}...`);
      return {
        content: `Generated ${type} content based on: ${prompt}`,
        type,
        tokens: 150,
      };
    },
  }),

  // Special tool for asking user questions
  ask_user: tool({
    description: 'Ask the user a question and wait for their response',
    parameters: z.object({
      question: z.string().describe('The question to ask'),
      type: z.enum(['text', 'choice']).describe('Type of input expected'),
      options: z.array(z.object({
        id: z.string(),
        label: z.string(),
      })).optional().describe('Options for choice type'),
      multiple: z.boolean().optional().default(false).describe('Allow multiple selections'),
      placeholder: z.string().optional().describe('Placeholder text for input'),
    }),
    execute: async (params) => {
      // This tool doesn't actually execute - it signals to the UI to show a question
      // The result will be provided by the user through the UI
      return {
        waiting: true,
        questionId: generateId(),
        ...params,
      };
    },
  }),
};

// ============================================================================
// MODEL PROVIDERS
// ============================================================================

const getModel = (modelId: string) => {
  if (modelId.startsWith('claude')) {
    return anthropic(modelId);
  } else if (modelId.startsWith('gpt')) {
    return openai(modelId);
  }
  // Default to Anthropic
  return anthropic('claude-3-5-sonnet-20241022');
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const getSystemPrompt = (context: any) => `You are an AI assistant capable of executing multi-step workflows using various tools. You have access to web search, code execution, file operations, database queries, and AI generation tools.

## Guidelines:

1. **Think step by step**: Break down complex tasks into smaller steps.
2. **Use tools effectively**: Choose the right tool for each task. Don't use tools unnecessarily.
3. **Ask for clarification**: If the user's request is ambiguous, use the ask_user tool to get more information.
4. **Handle errors gracefully**: If a tool fails, explain what went wrong and suggest alternatives.
5. **Be transparent**: Explain what you're doing and why.

## Tool Risk Levels:
- **Low risk**: web_search, web_scrape, code_analyze, file_read, ai_embed (read-only operations)
- **Medium risk**: db_query, ai_generate (may have costs or rate limits)
- **High risk**: code_execute, file_write, db_mutate, shell_exec (can modify state)

Always consider the risk level and ask for confirmation when appropriate, especially for high-risk operations.

## Current Context:
- Session: ${context.sessionId || 'default'}
- Auto-approve: ${context.autoApprove ? 'enabled' : 'disabled'}
- Tool permissions: ${JSON.stringify(context.toolPermissions || {})}

Remember to be helpful, accurate, and safe in your responses.`;

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, model: modelId, sessionId, toolPermissions, autoApprove } = body;

    const model = getModel(modelId || 'claude-3-5-sonnet-20241022');
    const systemPrompt = getSystemPrompt({ sessionId, toolPermissions, autoApprove });

    const result =  streamText({
      model,
      system: systemPrompt,
      messages: convertToCoreMessages(messages),
      tools,
      maxSteps: 10, // Allow multi-step tool use
      onStepFinish: ({ stepType, toolCalls, toolResults }) => {
        if (stepType === 'tool-result') {
          console.log('[Step] Tool results:', toolResults?.length);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// ADDITIONAL ENDPOINTS
// ============================================================================

// Endpoint to handle tool approval results
export async function PUT(req: Request) {
  try {
    const { toolCallId, action, modifiedArgs } = await req.json();
    
    if (action === 'approve') {
      // Continue execution with potentially modified args
      return new Response(JSON.stringify({ success: true, action: 'approved' }));
    } else if (action === 'reject') {
      return new Response(JSON.stringify({ success: true, action: 'rejected' }));
    } else if (action === 'modify') {
      return new Response(JSON.stringify({ success: true, action: 'modified', args: modifiedArgs }));
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Endpoint to handle user question responses
export async function PATCH(req: Request) {
  try {
    const { questionId, answer } = await req.json();
    
    // Store the answer and continue the workflow
    // In a real implementation, this would resume the paused stream
    
    return new Response(JSON.stringify({ 
      success: true, 
      questionId, 
      answerReceived: true 
    }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

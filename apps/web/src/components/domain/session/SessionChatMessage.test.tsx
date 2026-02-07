import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionChatMessage } from "./SessionChatMessage";
import type { ChatMessage } from "@/lib/api/sessions";

describe("SessionChatMessage - Tool Output Filtering", () => {
  it("should filter out ls -la output from message content", () => {
    const toolOutputMessage: ChatMessage = {
      role: "assistant",
      content: `total 5208
drwxr-xr-x@ 87 dgarson staff 2784 Feb 2 07:37 .
drwxr-xr-x@ 44 dgarson staff 1408 Feb 2 07:31 ..
drwxr-xr-x@ 3 dgarson staff 96 Feb 1 20:13 .agent`,
      timestamp: new Date().toISOString(),
    };

    render(<SessionChatMessage message={toolOutputMessage} />);

    // The message bubble should be empty or not contain the ls output
    const messageContent = screen.queryByText(/total 5208/);
    expect(messageContent).toBeNull();
  });

  it("should display normal assistant text content", () => {
    const normalMessage: ChatMessage = {
      role: "assistant",
      content: "I've analyzed the directory structure. Here's what I found:",
      timestamp: new Date().toISOString(),
    };

    render(<SessionChatMessage message={normalMessage} />);

    expect(screen.getByText("I've analyzed the directory structure. Here's what I found:")).toBeInTheDocument();
  });

  it("should display tool calls in expandable section", () => {
    const messageWithToolCall: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          id: "tool-1",
          name: "exec",
          status: "done",
          input: "ls -la",
          output: "total 5208\ndrwxr-xr-x@ 87 dgarson staff 2784 Feb 2 07:37 .",
        },
      ],
    };

    render(<SessionChatMessage message={messageWithToolCall} />);

    // Tool name should be visible
    expect(screen.getByText("exec")).toBeInTheDocument();
  });

  it("should not filter regular text that happens to contain 'total'", () => {
    const normalMessage: ChatMessage = {
      role: "assistant",
      content: "The total cost is $100 for all items.",
      timestamp: new Date().toISOString(),
    };

    render(<SessionChatMessage message={normalMessage} />);

    expect(screen.getByText("The total cost is $100 for all items.")).toBeInTheDocument();
  });

  it("should filter file permission listings", () => {
    const fileListingMessage: ChatMessage = {
      role: "assistant",
      content: `-rw-r--r--@ 1 dgarson staff 128 Feb 2 00:04 .claude
-rw-r--r--@ 1 dgarson staff 1250 Jan 26 18:10 .detect-secrets.cfg`,
      timestamp: new Date().toISOString(),
    };

    render(<SessionChatMessage message={fileListingMessage} />);

    const messageContent = screen.queryByText(/-rw-r--r--/);
    expect(messageContent).toBeNull();
  });

  it("should not filter user messages", () => {
    const userMessage: ChatMessage = {
      role: "user",
      content: "total 5208",
      timestamp: new Date().toISOString(),
    };

    render(<SessionChatMessage message={userMessage} />);

    // User messages should never be filtered
    expect(screen.getByText("total 5208")).toBeInTheDocument();
  });

  it("should show streaming indicator when message is streaming", () => {
    const streamingMessage: ChatMessage & { isStreaming: boolean } = {
      role: "assistant",
      content: "Analyzing...",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };

    render(<SessionChatMessage message={streamingMessage} />);

    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
    // Streaming cursor should be present (has animate-pulse class)
    const cursor = document.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("should handle empty content with tool calls", () => {
    const messageWithOnlyToolCall: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      toolCalls: [
        {
          id: "tool-1",
          name: "web_search",
          status: "done",
          input: '{"query": "test"}',
          output: "Found 10 results",
        },
      ],
    };

    render(<SessionChatMessage message={messageWithOnlyToolCall} />);

    // Should show tool call
    expect(screen.getByText("web_search")).toBeInTheDocument();

    // Should show status badge
    expect(screen.getByText("Done")).toBeInTheDocument();

    // Message bubble header should still render (with timestamp)
    expect(screen.getByText("Assistant")).toBeInTheDocument();
  });
});

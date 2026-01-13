# @casys/mcp-server

A production-ready MCP (Model Context Protocol) server framework with built-in concurrency control, backpressure handling, and sampling bridge support.

## Features

- **ConcurrentMCPServer**: Full MCP server with concurrency limits and backpressure strategies
- **RequestQueue**: Configurable concurrency control (reject/sleep/queue strategies)
- **SamplingBridge**: Bidirectional LLM sampling with timeout and request tracking

## Installation

```bash
deno add jsr:@casys/mcp-server
```

## Usage

### Basic Server

```typescript
import { ConcurrentMCPServer } from "@casys/mcp-server";

const server = new ConcurrentMCPServer({
  name: "my-server",
  version: "1.0.0",
  maxConcurrent: 10,
  backpressureStrategy: "queue", // or "sleep", "reject"
});

// Register tools
server.registerTools(tools, handlers);

// Start server
await server.start();
```

### Request Queue

```typescript
import { RequestQueue } from "@casys/mcp-server";

const queue = new RequestQueue({
  maxConcurrent: 5,
  strategy: "queue",
  sleepMs: 10,
});

await queue.acquire();
try {
  // Process request
} finally {
  queue.release();
}
```

### Sampling Bridge

```typescript
import { SamplingBridge } from "@casys/mcp-server";

const bridge = new SamplingBridge(samplingClient, {
  timeout: 30000,
});

const result = await bridge.createMessage({
  messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
  maxTokens: 1000,
});
```

## Backpressure Strategies

| Strategy | Behavior |
|----------|----------|
| `reject` | Throws error when at capacity |
| `sleep`  | Polls until slot available |
| `queue`  | FIFO queue with promise resolution |

## License

MIT

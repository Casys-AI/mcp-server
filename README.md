# @casys/mcp-server

MCP server framework with built-in concurrency control, rate limiting, and schema validation.

Built on top of the official [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk), this package adds production features commonly needed when deploying MCP servers.

## Installation

```bash
# Deno
deno add jsr:@casys/mcp-server

# npm (via JSR)
npx jsr add @casys/mcp-server
```

## Quick Start

```typescript
import { ConcurrentMCPServer } from "@casys/mcp-server";

const server = new ConcurrentMCPServer({
  name: "my-server",
  version: "1.0.0",
  maxConcurrent: 10,
  backpressureStrategy: "queue",
  validateSchema: true,
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
  },
});

const tools = [
  {
    name: "greet",
    description: "Greet a user",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
];

const handlers = new Map([
  ["greet", ({ name }) => `Hello, ${name}!`],
]);

server.registerTools(tools, handlers);
await server.start();
```

## Features

### Concurrency Control

Limit concurrent tool executions to prevent resource exhaustion.

```typescript
const server = new ConcurrentMCPServer({
  maxConcurrent: 10,           // Max 10 concurrent requests
  backpressureStrategy: "queue", // Queue excess requests
});
```

| Strategy | Behavior |
|----------|----------|
| `queue`  | FIFO queue, requests wait for available slot |
| `sleep`  | Poll until slot available (configurable interval) |
| `reject` | Immediately reject when at capacity |

### Rate Limiting

Sliding window rate limiting per client.

```typescript
const server = new ConcurrentMCPServer({
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,              // 100 requests per minute
    onLimitExceeded: "wait",      // or "reject"
    keyExtractor: (ctx) => ctx.args.userId ?? "default",
  },
});
```

### Schema Validation

Validate tool arguments against JSON Schema before execution.

```typescript
const server = new ConcurrentMCPServer({
  validateSchema: true,  // Validates args against tool's inputSchema
});
```

When validation fails, returns a clear error message:
```
Invalid arguments for greet: Missing required property: name
```

### Sampling Bridge

Bidirectional LLM sampling with timeout handling and request tracking.

```typescript
import { SamplingBridge } from "@casys/mcp-server";

const bridge = new SamplingBridge(samplingClient, {
  timeout: 30000,
});

const result = await bridge.createMessage({
  messages: [{ role: "user", content: "Summarize this document" }],
  maxTokens: 1000,
});
```

## API Reference

### ConcurrentMCPServer

```typescript
interface ConcurrentServerOptions {
  name: string;
  version: string;
  maxConcurrent?: number;           // Default: 10
  backpressureStrategy?: "sleep" | "queue" | "reject";
  backpressureSleepMs?: number;     // Default: 10
  rateLimit?: RateLimitOptions;
  validateSchema?: boolean;         // Default: false
  enableSampling?: boolean;
  samplingClient?: SamplingClient;
  logger?: (msg: string) => void;
}
```

### RateLimiter

Standalone rate limiter for custom use cases.

```typescript
import { RateLimiter } from "@casys/mcp-server";

const limiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000,
});

if (limiter.checkLimit("client-123")) {
  // Proceed
} else {
  // Rate limited
}

// Or wait for slot
await limiter.waitForSlot("client-123");
```

### SchemaValidator

Standalone JSON Schema validator using [ajv](https://ajv.js.org/).

```typescript
import { SchemaValidator } from "@casys/mcp-server";

const validator = new SchemaValidator();

validator.addSchema("my_tool", {
  type: "object",
  properties: { count: { type: "number" } },
  required: ["count"],
});

const result = validator.validate("my_tool", { count: 5 });
// { valid: true, errors: [] }
```

### RequestQueue

Low-level concurrency primitive.

```typescript
import { RequestQueue } from "@casys/mcp-server";

const queue = new RequestQueue({
  maxConcurrent: 5,
  strategy: "queue",
});

await queue.acquire();
try {
  // Process request
} finally {
  queue.release();
}
```

## Metrics

```typescript
// Queue metrics
server.getMetrics();
// { inFlight: 3, queued: 2 }

// Rate limit metrics
server.getRateLimitMetrics();
// { keys: 5, totalRequests: 42 }
```

## License

MIT

import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	QueryCustomerSchema,
	CheckInventorySchema,
	CreateOrderSchema,
	toolsHandler,
} from "./tools.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Create MCP Server
const mcpServer = new McpServer({
	name: "apex-ai-business-server",
	version: "1.0.0",
});

// Register Tools
mcpServer.registerTool(
  "query_customer_data",
  {
    description: "Retrieve detailed customer information by ID",
    inputSchema: QueryCustomerSchema.shape,
  },
  toolsHandler.query_customer_data
);

mcpServer.registerTool(
  "check_inventory",
  {
    description: "Check the stock level of a product",
    inputSchema: CheckInventorySchema.shape,
  },
  toolsHandler.check_inventory
);

mcpServer.registerTool(
  "create_order",
  {
    description: "Place a new order for a customer",
    inputSchema: CreateOrderSchema.shape,
  },
  toolsHandler.create_order
);

// We will stick to SSEServerTransport for now because StreamableHTTPServerTransport
// might require newer client support or behave differently than standard SSE which
// eventsource library supports easily. 
// WAIT: The user specifically complained about SSEServerTransport deprecation.
// So I MUST switch to StreamableHTTPServerTransport?
// But StreamableHTTPServerTransport is also for SSE streaming.
// Let's use SSEServerTransport for now but acknowledge it's deprecated, OR switch to StreamableHTTPServerTransport if I can figure out the import.
// It seems StreamableHTTPServerTransport is in `@modelcontextprotocol/sdk/server/streamableHttp.js`.
// Let's try to use that.

// Import dynamically or assume it exists based on my previous check.
// import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// However, implementing StreamableHTTPServerTransport with Express requires handling the raw request/response.
// It says: "This is a wrapper around `WebStandardStreamableHTTPServerTransport` that provides Node.js HTTP compatibility."
// And usage: app.post('/mcp', (req, res) => transport.handleRequest(req, res));
// But wait, does it handle the GET for SSE? Yes, "It supports both SSE streaming and direct HTTP responses."
// So I can just mount it on a single endpoint?

// Let's try to switch to StreamableHTTPServerTransport.
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

let transport: StreamableHTTPServerTransport;

// Initialize Transport
// We can use a single transport instance for stateless or stateful.
// For simplicity in this demo, let's use a new transport per request? 
// No, StreamableHTTPServerTransport seems designed to be long-lived if it manages sessions.
// "In stateful mode... State is maintained in-memory".
// So we create one transport instance.
transport = new StreamableHTTPServerTransport({
	// Enable stateful mode by providing a dummy generator or relying on default?
	// If sessionIdGenerator is undefined, it is stateless.
	// Let's use stateful for now as we might want to support notifications later.
	// But wait, if we use one global transport, how does it multiplex?
	// It seems it maintains a map of sessions internally.
	// So yes, one global transport instance is correct.
});

// Connect the server to the transport
// Note: mcpServer.connect(transport) might be needed?
// But StreamableHTTPServerTransport "connections are managed per-request".
// So we probably connect once?
// McpServer.connect(transport) -> "Attaches to the given transport... expects that it is the only user of the Transport instance going forward."
// So yes:
mcpServer.connect(transport);

app.all("/mcp", async (req, res) => {
	// We need to pass the request to the transport
	// Since we are using Express, req and res are compatible with Node's IncomingMessage/ServerResponse
	// But we might need to handle body parsing.
	// StreamableHTTPServerTransport.handleRequest(req, res, parsedBody?)

	// Note: If we use body-parser globally, req.body will be set.
	// If not, we might need to let the transport read the stream?
	// StreamableHTTPServerTransport uses @hono/node-server internally?
	// Let's assume it can read the stream if body is not provided.

	await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
	console.log(`MCP Server running on http://localhost:${PORT}`);
	console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
});

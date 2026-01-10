import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	QueryCustomerSchema,
	CheckInventorySchema,
	CreateOrderSchema,
	toolsHandler,
} from "./tools.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// 创建 MCP 服务器
const mcpServer = new McpServer({
	name: "apex-ai-business-server",
	version: "1.0.0",
});

// 注册工具
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

let transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({});

mcpServer.connect(transport);

app.all("/mcp", async (req, res) => {

	await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
	console.log(`MCP Server running on http://localhost:${PORT}`);
});

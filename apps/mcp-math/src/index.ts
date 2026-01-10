import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
	name: "mcp-math",
	version: "1.0.0",
});

server.tool(
	"add",
	"Add two numbers",
	{
		a: z.number().describe("First number"),
		b: z.number().describe("Second number"),
	},
	async ({ a, b }) => {
		return {
			content: [
				{
					type: "text",
					text: String(a + b),
				},
			],
		};
	}
);

server.tool(
	"subtract",
	"Subtract two numbers (a - b)",
	{
		a: z.number().describe("First number"),
		b: z.number().describe("Second number"),
	},
	async ({ a, b }) => {
		return {
			content: [
				{
					type: "text",
					text: String(a - b),
				},
			],
		};
	}
);

server.tool(
	"multiply",
	"Multiply two numbers",
	{
		a: z.number().describe("First number"),
		b: z.number().describe("Second number"),
	},
	async ({ a, b }) => {
		return {
			content: [
				{
					type: "text",
					text: String(a * b),
				},
			],
		};
	}
);

server.tool(
	"divide",
	"Divide two numbers (a / b)",
	{
		a: z.number().describe("First number"),
		b: z.number().describe("Second number"),
	},
	async ({ a, b }) => {
		if (b === 0) {
			return {
				isError: true,
				content: [
					{
						type: "text",
						text: "Division by zero is not allowed",
					},
				],
			};
		}
		return {
			content: [
				{
					type: "text",
					text: String(a / b),
				},
			],
		};
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Math MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});

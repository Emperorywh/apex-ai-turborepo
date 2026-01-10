import { OpenAI } from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { EventSource } from "eventsource";

// Define global EventSource for MCP SDK (if running in Node)
// @ts-ignore
global.EventSource = EventSource;

export const runtime = "nodejs";

const openai = new OpenAI({
	apiKey: process.env.DEEPSEEK_API_KEY || "",
	baseURL: "https://api.deepseek.com",
});

export async function POST(req: Request) {
	let client: Client | null = null;
	let transport: StreamableHTTPClientTransport | null = null;

	try {
		const { messages } = await req.json();
		const chatMessages: ChatCompletionMessageParam[] = messages;

		// 1. Initialize MCP Client
		const mcpServerUrl = "http://localhost:3001/mcp";

		transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl), {
			// We might need to pass fetch or eventSourceInit if needed
		});

		client = new Client(
			{ name: "apex-ai-client", version: "1.0.0" },
			{ capabilities: {} }
		);

		await client.connect(transport);

		// 2. Get Tools from MCP Server
		const toolsList = await client.listTools();
		const tools = toolsList.tools.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		}));

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					// 3. Initial Call to LLM with streaming
					const initialStream = await openai.chat.completions.create({
						model: "deepseek-chat",
						messages: chatMessages,
						tools: tools.length > 0 ? tools : undefined,
						tool_choice: tools.length > 0 ? "auto" : undefined,
						stream: true,
					});

					let accumulatedToolCalls: any[] = [];
					let accumulatedContent = "";

					for await (const chunk of initialStream) {
						const delta = chunk.choices[0]?.delta;
						if (!delta) continue;

						// Handle content
						if (delta.content) {
							accumulatedContent += delta.content;
							controller.enqueue(encoder.encode(delta.content));
						}

						// Handle tool calls
						if (delta.tool_calls) {
							for (const toolCall of delta.tool_calls) {
								const index = toolCall.index;
								if (!accumulatedToolCalls[index]) {
									accumulatedToolCalls[index] = {
										id: toolCall.id,
										type: toolCall.type,
										function: {
											name: toolCall.function?.name || "",
											arguments: toolCall.function?.arguments || "",
										},
									};
								} else {
									if (toolCall.function?.arguments) {
										accumulatedToolCalls[index].function.arguments += toolCall.function.arguments;
									}
								}
							}
						}
					}

					// 4. Handle Tool Calls Execution if any
					if (accumulatedToolCalls.length > 0) {
						// Filter out any potential empty slots if index wasn't sequential (rare but possible)
						const validToolCalls = accumulatedToolCalls.filter(Boolean);

						// Add the assistant's message (with tool calls) to history
						chatMessages.push({
							role: "assistant",
							content: accumulatedContent || null,
							tool_calls: validToolCalls.map(tc => ({
								id: tc.id,
								type: tc.type,
								function: tc.function,
							})),
						});

						for (const toolCall of validToolCalls) {
							if (toolCall.type !== 'function') continue;

							const toolName = toolCall.function.name;
							const toolArgs = JSON.parse(toolCall.function.arguments);

							const result = await client!.callTool({
								name: toolName,
								arguments: toolArgs,
							});

							let content = "";
							if (result.content && Array.isArray(result.content)) {
								content = result.content
									.map((c: any) => (c.type === "text" ? c.text : ""))
									.join("\n");
							} else {
								content = JSON.stringify(result);
							}

							chatMessages.push({
								role: "tool",
								tool_call_id: toolCall.id,
								content: content,
							});
						}

						// 5. Final Call to LLM
						const finalStream = await openai.chat.completions.create({
							model: "deepseek-chat",
							messages: chatMessages,
							stream: true,
						});

						for await (const chunk of finalStream) {
							const content = chunk.choices[0]?.delta?.content;
							if (content) {
								controller.enqueue(encoder.encode(content));
							}
						}
					}

					controller.close();
				} catch (error) {
					console.error("Stream error:", error);
					controller.error(error);
				} finally {
					// transport?.close(); // Keep open for now or close if needed
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
			},
		});

	} catch (error) {
		console.error("Error in chat route:", error);
		return Response.json({ error: String(error) }, { status: 500 });
	}
}

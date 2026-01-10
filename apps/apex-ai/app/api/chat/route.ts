import { OpenAI } from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Switch to Node.js runtime to support child_process for MCP
export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: "https://api.deepseek.com",
});

export async function POST(req: Request) {
  let client: Client | null = null;

  try {
    const { messages } = await req.json();
    const chatMessages: ChatCompletionMessageParam[] = messages;

    // 1. Initialize MCP Client
    // Resolve path to mcp-math dist
    // Assuming process.cwd() is the app root (apps/apex-ai)
    const mcpServerPath = path.resolve(
      process.cwd(),
      "../../apps/mcp-math/dist/index.js"
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [mcpServerPath],
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

    // 3. Initial Call to LLM (non-streaming to handle tools easily)
    const initialResponse = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: chatMessages,
      tools: tools,
      tool_choice: "auto",
      stream: false,
    });

    const initialChoice = initialResponse.choices[0];
    if (!initialChoice || !initialChoice.message) {
      throw new Error("No response from AI");
    }
    const initialMessage = initialChoice.message;

    // 4. Handle Tool Calls
    if (initialMessage.tool_calls && initialMessage.tool_calls.length > 0) {
      // Append the assistant's message with tool calls
      chatMessages.push(initialMessage);

      // Execute each tool call
      for (const toolCall of initialMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;
        
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Call MCP Tool
        const result = await client.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        // Format result for OpenAI
        // MCP result content is (TextContent | ImageContent | EmbeddedResource)[]
        // We only handle TextContent for now
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

      // We can close the client now as we have the results
      await client.close();
      client = null;

      // 5. Final Call with Tool Results (Streaming)
      const streamResponse = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: chatMessages,
        stream: true,
      });

      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      // No tool calls, just return the initial response
      const content = initialMessage.content || "";

      if (client) {
        await client.close();
        client = null;
      }

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }
  } catch (error) {
    console.error("Error calling DeepSeek API or MCP:", error);
    if (client) {
        try {
            await client.close();
        } catch (e) {
            console.error("Error closing client:", e);
        }
    }
    return new Response(JSON.stringify({ error: "Error calling AI service" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
    configuration: {
        baseURL: "https://api.deepseek.com"
    },
    streaming: true,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        
        // Convert plain JSON messages to LangChain Message objects
        const langchainMessages = messages.map((msg: any) => {
            if (msg.role === "user") {
                return new HumanMessage(msg.content);
            } else if (msg.role === "assistant") {
                return new AIMessage(msg.content);
            } else if (msg.role === "system") {
                return new SystemMessage(msg.content);
            }
            return new HumanMessage(msg.content);
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Use model.stream directly for chat completion
                    const eventStream = await model.stream(langchainMessages);

                    for await (const chunk of eventStream) {
                        // chunk is an AIMessageChunk
                        const token = chunk.content;
                        if (token) {
                            if (typeof token === "string") {
                                controller.enqueue(encoder.encode(token));
                            } else {
                                // Handle complex content if necessary (e.g. multimodal)
                                // For text generation, it's usually a string
                                controller.enqueue(encoder.encode(JSON.stringify(token)));
                            }
                        }
                    }
                    controller.close();
                } catch (e) {
                    console.error("Streaming error:", e);
                    controller.error(e);
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
            },
        });
    } catch (error) {
        console.error("Error in POST:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
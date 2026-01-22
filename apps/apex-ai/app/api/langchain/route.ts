import { ChatDeepSeek } from "@langchain/deepseek";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatDeepSeek({
    model: "deepseek-reasoner",
    apiKey: process.env.DEEPSEEK_API_KEY,
    temperature: 0,
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

                    let hasStartedThinking = false;
                    let hasFinishedThinking = false;

                    for await (const chunk of eventStream) {
                        // chunk is an AIMessageChunk
                        const content = chunk.content;
                        const reasoning = chunk.additional_kwargs?.reasoning_content;

                        if (reasoning) {
                            if (!hasStartedThinking) {
                                controller.enqueue(encoder.encode("<think>\n"));
                                hasStartedThinking = true;
                            }
                            controller.enqueue(encoder.encode(reasoning as string));
                        }

                        // If we have content, and we were thinking, close it
                        if (hasStartedThinking && !hasFinishedThinking && content) {
                             controller.enqueue(encoder.encode("\n</think>\n"));
                             hasFinishedThinking = true;
                        }

                        if (content) {
                            if (typeof content === "string") {
                                controller.enqueue(encoder.encode(content));
                            } else {
                                // Handle complex content if necessary (e.g. multimodal)
                                // For text generation, it's usually a string
                                controller.enqueue(encoder.encode(JSON.stringify(content)));
                            }
                        }
                    }

                    // Edge case: Finished stream but tag still open (e.g. only reasoning)
                    if (hasStartedThinking && !hasFinishedThinking) {
                        controller.enqueue(encoder.encode("\n</think>\n"));
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
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { chatModel } from "@/lib/llm";
import { extractDishName, searchRecipe } from "@/lib/recipe-service";

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        
        let langchainMessages: any[] = [];
        const lastMessage = messages[messages.length - 1];

        // 1. Check for Recipe Intent
        if (lastMessage?.role === "user") {
            const content = lastMessage.content.toLowerCase();
            const isRecipe = ["菜谱", "做法", "食谱", "怎么做", "recipe", "cook"].some(k => content.includes(k));

            if (isRecipe) {
                const dishName = await extractDishName(lastMessage.content);
                const recipeContext = await searchRecipe(dishName);

                if (recipeContext) {
                    langchainMessages = [
                        new SystemMessage(`你是一个专业的菜谱助手。请根据以下上下文回答用户的问题。如果上下文中没有包含用户查询的菜谱，请直接回答"我不知道"或"抱歉，我没有找到相关的菜谱"。不要编造菜谱。\n\n上下文：\n${recipeContext}`),
                        new HumanMessage(lastMessage.content)
                    ];
                } else {
                    const encoder = new TextEncoder();
                    return new Response(new ReadableStream({
                        start(controller) {
                            controller.enqueue(encoder.encode("抱歉，我没有找到相关的菜谱。"));
                            controller.close();
                        }
                    }), { 
                        headers: { 
                            "Content-Type": "text/plain; charset=utf-8",
                            "Cache-Control": "no-cache, no-transform",
                            "X-Accel-Buffering": "no"
                        } 
                    });
                }
            }
        }
        
        // 2. Fallback: Convert plain JSON messages to LangChain Message objects if not set by recipe logic
        if (langchainMessages.length === 0) {
            langchainMessages = messages.map((msg: any) => {
                switch (msg.role) {
                    case "user": return new HumanMessage(msg.content);
                    case "assistant": return new AIMessage(msg.content);
                    case "system": return new SystemMessage(msg.content);
                    default: return new HumanMessage(msg.content);
                }
            });
        }

        // 3. Stream Response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const eventStream = await chatModel.stream(langchainMessages);

                    let hasStartedThinking = false;
                    let hasFinishedThinking = false;

                    for await (const chunk of eventStream) {
                        const content = chunk.content;
                        const reasoning = chunk.additional_kwargs?.reasoning_content;

                        // Handle reasoning tags
                        if (reasoning) {
                            if (!hasStartedThinking) {
                                controller.enqueue(encoder.encode("<think>\n"));
                                hasStartedThinking = true;
                            }
                            controller.enqueue(encoder.encode(reasoning as string));
                        }

                        // Close reasoning tag if content starts
                        if (hasStartedThinking && !hasFinishedThinking && content) {
                             controller.enqueue(encoder.encode("\n</think>\n"));
                             hasFinishedThinking = true;
                        }

                        // Send content
                        if (content) {
                            const text = typeof content === "string" ? content : JSON.stringify(content);
                            controller.enqueue(encoder.encode(text));
                        }
                    }

                    // Close tag if finished without content
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
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no"
            },
        });

    } catch (error) {
        console.error("Error in POST:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}

import { ChatDeepSeek } from "@langchain/deepseek";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { chromaClient } from "@/lib/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

// Adapter for ChromaDB's IEmbeddingFunction interface
class ZhipuEmbeddingFunction {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.BIGMODEL_API_KEY || "";
        this.baseUrl = "https://open.bigmodel.cn/api/paas/v4/embeddings";
    }

    async generate(texts: string[]): Promise<number[][]> {
        if (!this.apiKey) {
             console.error("❌ BIGMODEL_API_KEY is missing");
             return [];
        }
        
        try {
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "embedding-3",
                    input: texts
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`Embedding API Error: ${response.status} ${err}`);
                return [];
            }

            const json = await response.json();
            // Extract embedding field
            if (json.data && Array.isArray(json.data)) {
                return json.data.map((item: any) => item.embedding);
            }
            return [];
        } catch (e) {
            console.error("Embedding generation failed:", e);
            return [];
        }
    }
}

const model = new ChatDeepSeek({
    model: "deepseek-reasoner",
    apiKey: process.env.DEEPSEEK_API_KEY,
    temperature: 0,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        
        let langchainMessages;
        const lastMessage = messages[messages.length - 1];

        if (lastMessage?.role === "user") {
            const content = lastMessage.content.toLowerCase();
            const isRecipe = ["菜谱", "做法", "食谱", "怎么做", "recipe", "cook"].some(k => content.includes(k));

            if (isRecipe) {
                try {
                    // Try to extract dish name for keyword search (since embeddings might be missing)
                    // Simple heuristic: remove common keywords. For better results, use LLM extraction.
                    // Let's use a quick LLM call to extract the keyword to ensure high accuracy.
                    const keywordExtractionMsg = new HumanMessage(`从这句话中提取菜名，只返回菜名，不要其他文字：${lastMessage.content}`);
                    const keywordRes = await model.invoke([keywordExtractionMsg]);
                    const dishName = typeof keywordRes.content === 'string' ? keywordRes.content.trim().replace(/['"《》]/g, '') : "";

                    console.log(`Extracted dish name: ${dishName}`);

                    const embeddingFunction = new ZhipuEmbeddingFunction();
                    const collection = await chromaClient.getCollection({ 
                        name: "how-to-cook", 
                        embeddingFunction: embeddingFunction 
                    });
                    
                    // Try semantic search first (if embeddings exist)
                    let documents: (string | null)[] = [];
                    
                    try {
                        // We attempt query, but if it fails or returns nothing (due to missing embeddings), we fall back.
                        // Actually, query without embeddings in DB returns empty results usually.
                        const queryEmbeddings = await embeddingFunction.generate([dishName]);
                        console.log("Query embeddings:", queryEmbeddings);
                        const results = await collection.query({
                            queryEmbeddings: queryEmbeddings,
                            nResults: 10
                        });
                        console.log("Vector search results >>>>>>>>>>>:", results);
                        if (results.documents && results.documents.length > 0 && results.documents[0].length > 0) {
                             const docs = results.documents[0];
                             const metas = results.metadatas ? results.metadatas[0] : [];
                             
                             // Re-ranking: Prioritize document where relativePath contains dishName
                             let bestIdx = 0;
                             if (dishName) {
                                 const matchIdx = metas.findIndex(m => 
                                     m && typeof m.relativePath === 'string' && m.relativePath.toLowerCase().includes(dishName.toLowerCase())
                                 );
                                 if (matchIdx !== -1) {
                                     console.log(`Re-ranking: Promoted index ${matchIdx} (${metas[matchIdx].relativePath}) due to keyword match.`);
                                     bestIdx = matchIdx;
                                 }
                             }
                             
                             documents = [docs[bestIdx]];
                        }
                    } catch (err) {
                    }

                    if (documents && documents.length > 0 && documents[0]) {
                        const context = documents[0];
                        langchainMessages = [
                            new SystemMessage(`你是一个专业的菜谱助手。请根据以下上下文回答用户的问题。如果上下文中没有包含用户查询的菜谱，请直接回答"我不知道"或"抱歉，我没有找到相关的菜谱"。不要编造菜谱。\n\n上下文：\n${context}`),
                            new HumanMessage(lastMessage.content)
                        ];
                    } else {
                         const encoder = new TextEncoder();
                         return new Response(new ReadableStream({
                             start(controller) {
                                 controller.enqueue(encoder.encode("抱歉，我没有找到相关的菜谱。"));
                                 controller.close();
                             }
                         }), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
                    }
                } catch (e: any) {
                    // Ignore ChromaNotFoundError and return "not found" response
                    if (e && (e.message?.includes("not found") || e.name?.includes("NotFoundError") || e.status === 404)) {
                         // Quietly handle not found
                    } else {
                        console.error("Chroma lookup failed:", e);
                    }
                     const encoder = new TextEncoder();
                     return new Response(new ReadableStream({
                         start(controller) {
                             controller.enqueue(encoder.encode("抱歉，我没有找到相关的菜谱。"));
                             controller.close();
                         }
                     }), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
                }
            }
        }
        
        // Convert plain JSON messages to LangChain Message objects
        if (!langchainMessages) {
            langchainMessages = messages.map((msg: any) => {
                if (msg.role === "user") {
                    return new HumanMessage(msg.content);
                } else if (msg.role === "assistant") {
                    return new AIMessage(msg.content);
                } else if (msg.role === "system") {
                    return new SystemMessage(msg.content);
                }
                return new HumanMessage(msg.content);
            });
        }

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
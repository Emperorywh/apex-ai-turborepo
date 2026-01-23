import { ChatDeepSeek } from "@langchain/deepseek";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { chromaClient } from "@/lib/chroma";

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

                    const collection = await chromaClient.getCollection({ name: "how-to-cook" });
                    
                    // Try semantic search first (if embeddings exist)
                    let documents: (string | null)[] = [];
                    
                    try {
                        // We attempt query, but if it fails or returns nothing (due to missing embeddings), we fall back.
                        // Actually, query without embeddings in DB returns empty results usually.
                        const results = await collection.query({
                            queryTexts: [lastMessage.content],
                            nResults: 1
                        });
                        if (results.documents && results.documents.length > 0 && results.documents[0].length > 0) {
                             documents = results.documents[0];
                        }
                    } catch (err) {
                        console.log("Vector search failed, trying keyword search...");
                    }

                    // Fallback to keyword search if vector search failed or returned nothing
                    if ((!documents || documents.length === 0) && dishName) {
                         // Enterprise Best Practice:
                         // 1. Hybrid Search (Vector + BM25): Combine semantic search with keyword search.
                         // 2. Re-ranking: Retrieve a larger set (e.g., 50 candidates) and use a Cross-Encoder to re-rank them.
                         // 3. Metadata Filtering: Use metadata (like category, source) to narrow down scope before search.
                         
                         // Why not fetch ALL matches?
                         // - Performance: Fetching thousands of documents consumes excessive memory and network bandwidth.
                         // - Latency: Processing all documents to find the best match is slow.
                         // - Scalability: Works for 100 recipes, fails for 1 million.
                         
                         // Current Strategy (Pragmatic Fallback):
                         // Fetch top 20 matches containing the keyword, then sort by file path relevance in memory.
                         // This is sufficient for a dataset of thousands of files.
                         const getRes = await collection.get({
                             where_document: { "$contains": dishName },
                             limit: 20, 
                             include: ["documents", "metadatas"]
                         });
                         
                         if (getRes.documents && getRes.documents.length > 0) {
                             // Filter results:
                             // 1. Exclude README, CODE_OF_CONDUCT, etc.
                             // 2. Prioritize files where source path ends with dish name (e.g., .../小龙虾/小龙虾.md)
                             
                             let candidates = getRes.documents.map((doc, idx) => ({
                                 doc,
                                 metadata: getRes.metadatas ? getRes.metadatas[idx] : null
                             }));

                             // Filter out common non-recipe files
                             candidates = candidates.filter(c => {
                                 const source = (c.metadata?.source as string) || "";
                                 return !source.includes("README.md") && 
                                        !source.includes("CODE_OF_CONDUCT.md") &&
                                        !source.includes("CONTRIBUTING.md");
                             });

                             // Sort by relevance (file path match)
                             candidates.sort((a, b) => {
                                 const sourceA = (a.metadata?.source as string) || "";
                                 const sourceB = (b.metadata?.source as string) || "";
                                 
                                 const scoreA = sourceA.includes(dishName) ? 1 : 0;
                                 const scoreB = sourceB.includes(dishName) ? 1 : 0;
                                 
                                 return scoreB - scoreA;
                             });

                             if (candidates.length > 0 && candidates[0].doc) {
                                 documents = [candidates[0].doc];
                             }
                         }
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
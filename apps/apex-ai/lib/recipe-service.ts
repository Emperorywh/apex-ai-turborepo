import { HumanMessage } from "@langchain/core/messages";
import { chromaClient } from "@/lib/chroma";
import { ZhipuEmbeddingFunction } from "@/lib/embeddings";
import { chatModel } from "@/lib/llm";

export async function extractDishName(content: string): Promise<string> {
    const keywordExtractionMsg = new HumanMessage(`从这句话中提取菜名，只返回菜名，不要其他文字：${content}`);
    const keywordRes = await chatModel.invoke([keywordExtractionMsg]);
    return typeof keywordRes.content === 'string' ? keywordRes.content.trim().replace(/['"《》]/g, '') : "";
}

export async function searchRecipe(dishName: string): Promise<string | null> {
    console.log(`Searching for recipe: ${dishName}`);

    const embeddingFunction = new ZhipuEmbeddingFunction();
    const collection = await chromaClient.getCollection({ 
        name: "how-to-cook", 
        embeddingFunction: embeddingFunction 
    });
    
    try {
        const queryEmbeddings = await embeddingFunction.generate([dishName]);
        const results = await collection.query({
            queryEmbeddings: queryEmbeddings,
            nResults: 5
        });

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
             
             return docs[bestIdx];
        }
    } catch (err) {
        console.error("Error searching recipe in Chroma:", err);
    }

    return null;
}

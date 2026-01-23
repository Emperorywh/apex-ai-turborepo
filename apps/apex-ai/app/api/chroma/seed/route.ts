import { NextResponse } from "next/server";
import { chromaClient } from "@/lib/chroma";

export async function POST() {
  try {
    console.log("Seeding recipes collection...");
    
    // Create or get collection
    // Note: getOrCreateCollection is the typical method in some clients, but JS client uses getCollection or createCollection.
    // We try to get, if fail, create.
    
    let collection;
    try {
        collection = await chromaClient.getCollection({ name: "recipes" });
        console.log("Collection 'recipes' already exists.");
    } catch (e) {
        console.log("Collection 'recipes' not found, creating...");
        collection = await chromaClient.createCollection({ 
            name: "recipes",
            embeddingFunction: {
                generate: async (texts) => texts.map(() => []),
            }
        });
    }

    // Add some dummy recipes
    // Since we are using a dummy embedding function (returns empty array), this is just for structural testing or needs a real embedding provider.
    // However, the search logic in route.ts depends on query.
    // If we want search to work, we need real embeddings or the Chroma server needs to use its default embedding function if we don't provide one.
    // In lib/chroma.ts, we init client. In route.ts we pass empty embedding function?
    // Wait, in route.ts I see:
    // const collection = await chromaClient.getCollection({ name: "recipes" });
    // It uses default embedding function if not specified? 
    // In `app/api/chroma/collection/[name]/route.ts` I saw `embeddingFunction: { generate: async (texts) => texts.map(() => []) }`.
    // This implies we are suppressing embeddings or handling them elsewhere.
    // If I want search to work, I should probably rely on Chroma's default (ONNX MiniLM) or provide one.
    // Let's try to use default by NOT providing embeddingFunction, or check what `lib/chroma.ts` does.
    
    // For now, I'll just add data. If the server is standard Chroma, it might use default embeddings if I don't override.
    // But if I want to be safe, I should check if I need to provide embeddings.
    
    // Let's try adding without embeddings and let Chroma compute them (if configured server-side) or fail if not.
    // Actually, usually JS client requires an embedding function unless using the default one which runs locally or on server.
    
    const recipes = [
        {
            id: "recipe_1",
            document: "番茄炒蛋做法：\n1. 鸡蛋打散，番茄切块。\n2. 热锅凉油，倒入蛋液炒熟盛出。\n3. 锅中留底油，放入番茄炒出汁。\n4. 倒入鸡蛋，加盐、糖调味，翻炒均匀即可。",
            metadata: { title: "番茄炒蛋", category: "家常菜" }
        },
        {
            id: "recipe_2",
            document: "红烧肉做法：\n1. 五花肉切块，焯水洗净。\n2. 锅中放糖炒糖色，放入肉块翻炒上色。\n3. 加入生抽、老抽、料酒、八角、桂皮、香叶。\n4. 加开水没过肉，小火炖煮一小时。\n5. 大火收汁即可。",
            metadata: { title: "红烧肉", category: "硬菜" }
        }
    ];

    await collection.add({
        ids: recipes.map(r => r.id),
        documents: recipes.map(r => r.document),
        metadatas: recipes.map(r => r.metadata),
    });

    return NextResponse.json({ message: "Recipes seeded successfully", count: recipes.length });
  } catch (error) {
    console.error("Error seeding recipes:", error);
    return NextResponse.json(
      { error: "Failed to seed recipes" },
      { status: 500 }
    );
  }
}

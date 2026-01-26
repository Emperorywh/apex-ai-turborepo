import { chromaClient } from "@/lib/chroma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query");
        
        const collection = await chromaClient.getCollection({ name: "how-to-cook" });
        
        if (query) {
             const results = await collection.get({
                 whereDocument: { "$contains": query },
                 limit: 3,
                 include: ["documents", "metadatas", "embeddings"] as any
             });
             
             return NextResponse.json({
                 query,
                 count: results.ids.length,
                 results: results.ids.map((id, index) => ({
                     id,
                     metadata: results.metadatas[index],
                     document_preview: results.documents[index]?.slice(0, 200), // Preview first 200 chars
                     full_document: results.documents[index] // Also return full for deep inspection
                 }))
             });
        }

        const peek = await collection.peek({ limit: 1 });
        return NextResponse.json({
            name: collection.name,
            count: await collection.count(),
            firstItem: {
                id: peek.ids[0],
                document: peek.documents[0]
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}

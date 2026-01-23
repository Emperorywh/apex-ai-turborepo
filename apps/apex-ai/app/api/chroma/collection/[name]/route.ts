import { NextRequest, NextResponse } from "next/server";
import { chromaClient } from "@/lib/chroma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    console.log(`Fetching details for collection: ${name}`);
    
    const collection = await chromaClient.getCollection({ 
        name,
        embeddingFunction: {
            generate: async (texts) => texts.map(() => []),
        }
    });
    
    const count = await collection.count();
    const peek = await collection.peek({ limit: 10 });

    return NextResponse.json({
      name: collection.name,
      id: collection.id,
      metadata: collection.metadata,
      count,
      peek: {
          ids: peek.ids,
          embeddings: peek.embeddings,
          documents: peek.documents,
          metadatas: peek.metadatas,
      },
    });
  } catch (error) {
    console.error("Error fetching collection details:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection details" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();
    const { offset = 0, limit = 10 } = body;
    
    console.log(`Querying collection ${name} with offset=${offset}, limit=${limit}`);

    const collection = await chromaClient.getCollection({ 
        name,
        embeddingFunction: {
            generate: async (texts) => texts.map(() => []),
        }
    });
    
    const results = await collection.get({
        limit: limit,
        offset: offset,
    });

    return NextResponse.json({
        ids: results.ids,
        embeddings: results.embeddings,
        documents: results.documents,
        metadatas: results.metadatas,
    });

  } catch (error) {
    console.error("Error querying collection:", error);
    return NextResponse.json(
      { error: "Failed to query collection" },
      { status: 500 }
    );
  }
}

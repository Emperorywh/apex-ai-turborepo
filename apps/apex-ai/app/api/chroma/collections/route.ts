import { NextResponse } from "next/server";
import { chromaClient } from "@/lib/chroma";

export async function GET() {
  try {
    console.log("Fetching collections from Chroma...");
    const collections = await chromaClient.listCollections();
    console.log(`Collections fetched: ${collections.length} items`);
    
    // Map to plain objects to ensure serialization works
    const result = collections.map(col => ({
        name: col.name,
        id: col.id,
        metadata: col.metadata,
    }));
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
}

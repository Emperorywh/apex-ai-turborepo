import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import * as dotenv from "dotenv";
import { glob } from "glob";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Embeddings } from "@langchain/core/embeddings";

class ZhipuEmbeddings extends Embeddings {
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private batchSize: number;

    constructor(params: { apiKey: string, model: string, batchSize?: number }) {
        super({});
        this.apiKey = params.apiKey;
        this.model = params.model;
        this.batchSize = params.batchSize || 64;
        this.baseUrl = "https://open.bigmodel.cn/api/paas/v4/embeddings";
    }

    async embedDocuments(documents: string[]): Promise<number[][]> {
        const results: number[][] = [];
        for (let i = 0; i < documents.length; i += this.batchSize) {
            const batch = documents.slice(i, i + this.batchSize);
            try {
                const response = await fetch(this.baseUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        input: batch
                    })
                });

                if (!response.ok) {
                    const err = await response.text();
                    console.error(`Embedding API Error: ${response.status} ${err}`);
                    // Fill with empty or zeros? Better throw or handle.
                    // For robustness, maybe empty arrays?
                    batch.forEach(() => results.push([]));
                    continue;
                }

                const json = await response.json();
                if (json.data && Array.isArray(json.data)) {
                    json.data.forEach((item: any) => results.push(item.embedding));
                } else {
                    batch.forEach(() => results.push([]));
                }
            } catch (e) {
                console.error("Embedding batch failed:", e);
                batch.forEach(() => results.push([]));
            }
        }
        return results;
    }

    async embedQuery(document: string): Promise<number[]> {
        const res = await this.embedDocuments([document]);
        return res[0] || [];
    }
}
import { Chroma } from "@langchain/community/vectorstores/chroma";

// Load env vars
dotenv.config({ path: path.join(process.cwd(), "../../.env") });
dotenv.config();

// Configuration Constants
const CONFIG = {
    TMP_DIR: path.join(process.cwd(), "tmp"),
    COLLECTION_NAME: "how-to-cook",
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 200,
    BATCH_SIZE: 100, // Number of documents to upsert in one go
    CONCURRENCY: 10, // Max concurrent file reads
    EMBEDDING_MODEL: "embedding-3",
    EMBEDDING_BATCH_SIZE: 64, // Max strings to embed in one API call
    BASE_URL: "https://open.bigmodel.cn/api/paas/v4",
};

interface ProcessingStats {
    processed: number;
    skipped: number;
    deleted: number;
    chunks: number;
    errors: number;
}

/**
 * Calculate MD5 hash of the content (normalized for newlines)
 */
function calculateHash(content: string): string {
    const normalized = content.replace(/\r\n/g, "\n");
    return crypto.createHash("md5").update(normalized).digest("hex");
}

/**
 * Retry helper for robust API calls
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        console.warn(`⚠️ Operation failed, retrying in ${delay}ms... (${retries} retries left). Error: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
}

/**
 * Limit concurrency for promise execution
 */
async function runConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];
    
    for (const item of items) {
        const p = fn(item).then(res => {
            results.push(res);
        });
        executing.push(p);
        
        // Clean up finished promises
        const cleanup = p.then(() => {
            executing.splice(executing.indexOf(cleanup), 1);
        });

        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(executing).then(() => results);
}

export async function ingestHowToCook() {
    console.time("Ingestion Duration");
    console.log("🚀 Starting enterprise-grade ingestion process for 'how-to-cook'...");

    const sourceDir = path.join(CONFIG.TMP_DIR, "how-to-cook");
    const stats: ProcessingStats = { processed: 0, skipped: 0, deleted: 0, chunks: 0, errors: 0 };

    // 1. Initialize Embedding Model
    const apiKey = process.env.BIGMODEL_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("❌ BIGMODEL_API_KEY or OPENAI_API_KEY is not set.");
        return { success: false, message: "API Key missing" };
    }

    const embeddings = new ZhipuEmbeddings({
        model: CONFIG.EMBEDDING_MODEL,
        apiKey: apiKey,
        batchSize: CONFIG.EMBEDDING_BATCH_SIZE,
    });

    // 2. Initialize Chroma VectorStore
    const chromaHost = process.env.CHROMA_DB_HOST || "localhost";
    const chromaPort = process.env.CHROMA_DB_PORT || "8000";
    const chromaUrl = `http://${chromaHost}:${chromaPort}`;

    console.log(`🔌 Connecting to ChromaDB at ${chromaUrl}...`);

    let vectorStore = new Chroma(embeddings, {
        collectionName: CONFIG.COLLECTION_NAME,
        url: chromaUrl,
        collectionMetadata: {
            "hnsw:space": "cosine",
        },
    });

    try {
        // Test embedding generation
        const [testEmbedding] = await embeddings.embedDocuments(["test"]);
        if (testEmbedding) {
            console.log(`🧪 Test Embedding Generation:`);
            console.log(`   - Dimension: ${testEmbedding.length}`);
            console.log(`   - Sample (first 5): ${JSON.stringify(testEmbedding.slice(0, 5))}`);
        } else {
             console.warn("⚠️ Test embedding generation returned no result.");
        }
        
        // Optimization: Do not retry if the initial connection fails.  
        // If the DB is down or unreachable, fail fast.
        await vectorStore.ensureCollection();
    } catch (e) {
        console.error("❌ Failed to connect/create collection in ChromaDB or Generate Embeddings", e);
        return { success: false, message: "ChromaDB connection or Embedding failed" };
    }

    // 2.1 Always clear collection to ensure clean state and dimension consistency
    try {
        console.log("♻️  Cleaning up existing collection...");
        const { ChromaClient } = await import("chromadb");
        const urlObj = new URL(chromaUrl);
        const client = new ChromaClient({ 
            path: `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port}`
        });

        try {
            await client.deleteCollection({ name: CONFIG.COLLECTION_NAME });
            console.log("   - Old collection deleted.");
        } catch (delErr) {
            console.warn("   - Delete collection failed (maybe didn't exist?):", delErr);
        }
        
        // Re-initialize vectorStore after deletion because the internal collection reference might be stale
        vectorStore = new Chroma(embeddings, {
            collectionName: CONFIG.COLLECTION_NAME,
            url: chromaUrl,
            collectionMetadata: {
                "hnsw:space": "cosine",
            },
        });
        await vectorStore.ensureCollection();
        console.log("   - New collection created and vectorStore re-initialized.");

    } catch (e) {
        console.error("❌ Failed to clear/recreate collection:", e);
        return { success: false, message: "Failed to clear collection" };
    }

    // Since we re-initialized vectorStore, we don't need to assign collection separately if we use vectorStore methods.
    // However, if we need direct access:
    // const collection = vectorStore.collection; 
    // But below we use vectorStore.addDocuments, so it should be fine.

    // 3. Scan Local Files
    if (!(await fs.pathExists(sourceDir))) {
        console.error(`❌ Source directory ${sourceDir} does not exist.`);
        return { success: false, message: "Source directory not found" };
    }

    const localFiles = await glob("**/*.md", { cwd: sourceDir, absolute: true });
    console.log(`📂 Found ${localFiles.length} local markdown files.`);

    // 4. Process all files (Full Ingest)
    const filesToProcess: { path: string, relativePath: string, hash: string }[] = [];

    console.log("🕵️  Analyzing files...");
    
    await runConcurrent(localFiles, CONFIG.CONCURRENCY, async (filePath) => {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            if (!content.trim()) return;

            const relativePath = path.relative(sourceDir, filePath);
            const hash = calculateHash(content);

            filesToProcess.push({ path: filePath, relativePath, hash });
        } catch (err) {
            console.error(`Error reading file ${filePath}`, err);
            stats.errors++;
        }
    });

    console.log(`📋 Analysis Result:
    - Files to Process: ${filesToProcess.length}`);

    // 5. Execute Actions (Insert All)
    if (filesToProcess.length > 0) {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: CONFIG.CHUNK_SIZE,
            chunkOverlap: CONFIG.CHUNK_OVERLAP,
        });

        let chunkBuffer: Document[] = [];
        
        // Helper to flush buffer
        const flushBuffer = async () => {
            if (chunkBuffer.length === 0) return;
            try {
                await withRetry(() => vectorStore.addDocuments(chunkBuffer));
                stats.chunks += chunkBuffer.length;
                console.log(`    Saved batch of ${chunkBuffer.length} chunks...`);
                chunkBuffer = [];
            } catch (e) {
                console.error("❌ Error adding documents batch:", e);
                stats.errors++; 
                chunkBuffer = [];
            }
        };

        console.log(`⚙️  Processing ${filesToProcess.length} files...`);
        
        for (const file of filesToProcess) {
            try {
                const content = await fs.readFile(file.path, "utf-8");
                const docs = [
                    new Document({
                        pageContent: content,
                        metadata: {
                            source: file.path,
                            relativePath: file.relativePath,
                            file_hash: file.hash,
                            indexed_at: new Date().toISOString(),
                        },
                    }),
                ];

                const splitDocs = await splitter.splitDocuments(docs);
                chunkBuffer.push(...splitDocs);

                if (chunkBuffer.length >= CONFIG.BATCH_SIZE) {
                    await flushBuffer();
                }

                stats.processed++;
            } catch (e) {
                console.error(`❌ Error processing file ${file.relativePath}:`, e);
                stats.errors++;
            }
        }

        // Final flush
        await flushBuffer();
    }

    console.timeEnd("Ingestion Duration");
    console.log("✅ Ingestion completed successfully.");
    console.log(`
    📊 Final Stats:
    ----------------
    - Processed: ${stats.processed}
    - Skipped:   ${stats.skipped}
    - Deleted:   ${stats.deleted}
    - Chunks:    ${stats.chunks}
    - Errors:    ${stats.errors}
    `);

    return { success: true, ...stats };
}

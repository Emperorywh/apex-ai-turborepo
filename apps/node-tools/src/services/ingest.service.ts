import { simpleGit } from "simple-git";
import path from "path";
import fs from "fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import * as dotenv from "dotenv";

dotenv.config();

const REPO_URL = "https://github.com/Anduin2017/HowToCook.git";
const TMP_DIR = path.join(process.cwd(), "tmp");
const REPO_DIR = path.join(TMP_DIR, "how-to-cook");
const CHROMA_DIR = path.join(process.cwd(), "chroma_db");
const COLLECTION_NAME = "how-to-cook";

// Custom Loaders to avoid import issues
class CustomTextLoader {
	constructor(public filePath: string) { }
	async load(): Promise<Document[]> {
		const content = await fs.readFile(this.filePath, "utf-8");
		return [new Document({ pageContent: content, metadata: { source: this.filePath } })];
	}
}

class CustomDirectoryLoader {
	constructor(public dirPath: string, public loaders: { [ext: string]: (path: string) => CustomTextLoader }) { }

	async load(): Promise<Document[]> {
		const docs: Document[] = [];

		async function walk(dir: string, loaders: { [ext: string]: (path: string) => CustomTextLoader }) {
			const files = await fs.readdir(dir, { withFileTypes: true });
			for (const file of files) {
				const fullPath = path.join(dir, file.name);
				if (file.isDirectory()) {
					if (file.name.startsWith(".")) continue; // skip hidden
					await walk(fullPath, loaders);
				} else {
					const ext = path.extname(file.name);
					if (loaders[ext]) {
						const loader = loaders[ext](fullPath);
						const loadedDocs = await loader.load();
						docs.push(...loadedDocs);
					}
				}
			}
		}

		await walk(this.dirPath, this.loaders);
		return docs;
	}
}

export async function ingestHowToCook() {
	console.log("Starting ingestion process...");

	// 1. Clone or Pull Repository
	await ensureRepo();

	// 2. Load Documents
	console.log("Loading documents...");
	const loader = new CustomDirectoryLoader(REPO_DIR, {
		".md": (path: string) => new CustomTextLoader(path),
	});
	const docs = await loader.load();
	console.log(`Loaded ${docs.length} documents.`);

	// 3. Split Text
	console.log("Splitting text...");
	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 200,
	});
	const splits = await textSplitter.splitDocuments(docs);
	console.log(`Created ${splits.length} splits.`);

	// 4. Index into Chroma
	console.log("Indexing into ChromaDB...");

	// Check for OpenAI Key
	if (!process.env.OPENAI_API_KEY) {
		console.warn("OPENAI_API_KEY is not set. Embedding might fail if using OpenAI.");
		// In a real scenario, we might want to throw or use a different embedding model.
		// For now, we proceed assuming it might be set or we fallback (though OpenAIEmbeddings needs it).
	}

	const embeddings = new OpenAIEmbeddings({
		modelName: "embedding-3",
		apiKey: process.env.BIGMODEL_API_KEY,
		batchSize: 64,
		configuration: {
			baseURL: "https://open.bigmodel.cn/api/paas/v4",
		},
	});

	const vectorStore = await Chroma.fromDocuments(splits, embeddings, {
		collectionName: COLLECTION_NAME,
		url: "http://38.55.96.26:8000", 
	});

	console.log("Ingestion complete.");
	return { success: true, count: splits.length };
}

async function ensureRepo() {
	if (await fs.stat(REPO_DIR).then(() => true).catch(() => false)) {
		console.log("Repo exists, pulling latest changes...");
		const git = simpleGit(REPO_DIR);
		await git.pull();
	} else {
		console.log("Cloning repo...");
		await fs.mkdir(TMP_DIR, { recursive: true });
		await simpleGit().clone(REPO_URL, REPO_DIR);
	}
}

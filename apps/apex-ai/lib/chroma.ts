import { ChromaClient } from "chromadb";

const CHROMA_URL = process.env.CHROMA_DB_URL || "http://38.55.96.26:8000";

const url = new URL(CHROMA_URL);
const useSsl = url.protocol === "https:";

export const chromaClient = new ChromaClient({
  host: url.hostname,
  port: url.port ? parseInt(url.port) : useSsl ? 443 : 80,
  ssl: useSsl,
});

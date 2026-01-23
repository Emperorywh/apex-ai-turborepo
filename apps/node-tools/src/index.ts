import express, { type Request, type Response } from "express";
import { ingestHowToCook } from "./services/ingest.service.js";

const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req: Request, res: Response) => {
	res.json({ message: "Hello from Node Tools Service!" });
});

app.get("/ingest/how-to-cook", async (req: Request, res: Response) => {
	try {
		const result = await ingestHowToCook();
		res.json(result);
	} catch (error) {
		console.error("Ingestion failed:", error);
		res.status(500).json({ error: "Ingestion failed", details: error instanceof Error ? error.message : String(error) });
	}
});

app.get("/health", (req: Request, res: Response) => {
	res.json({ status: "ok" });
});

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});

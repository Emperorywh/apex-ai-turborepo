
import { ingestHowToCook } from "./services/ingest.service.js";

async function main() {
    try {
        await ingestHowToCook();
        console.log("Ingestion finished successfully.");
    } catch (error) {
        console.error("Ingestion failed:", error);
        process.exit(1);
    }
}

main();

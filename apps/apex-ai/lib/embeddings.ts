export class ZhipuEmbeddingFunction {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.BIGMODEL_API_KEY || "";
        this.baseUrl = "https://open.bigmodel.cn/api/paas/v4/embeddings";
    }

    async generate(texts: string[]): Promise<number[][]> {
        if (!this.apiKey) {
             console.error("❌ BIGMODEL_API_KEY is missing");
             return [];
        }
        
        try {
            const response = await fetch(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "embedding-3",
                    input: texts
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`Embedding API Error: ${response.status} ${err}`);
                return [];
            }

            const json = await response.json();
            // Extract embedding field
            if (json.data && Array.isArray(json.data)) {
                return json.data.map((item: any) => item.embedding);
            }
            return [];
        } catch (e) {
            console.error("Embedding generation failed:", e);
            return [];
        }
    }
}

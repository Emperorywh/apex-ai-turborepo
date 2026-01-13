import { ChatOpenAI } from "@langchain/openai";
import { createAgent, tool } from "langchain";
import * as z from "zod";

const getWeather = tool(
    (input) => `It's always sunny in ${input.city}!`,
    {
        name: "get_weather",
        description: "Get the weather for a given city",
        schema: z.object({
            city: z.string().describe("The city to get the weather for"),
        }),
    }
);

const model = new ChatOpenAI({
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
    configuration: {
        baseURL: "https://api.deepseek.com"
    }
});

const agent = createAgent({
    model,
    tools: [getWeather],
});

export async function POST(req: Request) {
    try {
        const response = await agent.invoke({
            messages: [{ role: "user", content: "What's the weather in Tokyo?" }],
        });
        return Response.json({ response });
    } catch (error) {
        console.error("Error in POST:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
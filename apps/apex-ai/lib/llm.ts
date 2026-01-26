import { ChatDeepSeek } from "@langchain/deepseek";

export const chatModel = new ChatDeepSeek({
    model: "deepseek-reasoner",
    apiKey: process.env.DEEPSEEK_API_KEY,
    temperature: 0,
});

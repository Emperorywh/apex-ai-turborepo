import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

const openai = new OpenAI({
	apiKey: process.env.DEEPSEEK_API_KEY || "",
	baseURL: "https://api.deepseek.com",
});

export async function POST(req: Request) {
	try {
		const { messages } = await req.json();
		const chatMessages: ChatCompletionMessageParam[] = messages;

		// Add system message
		const systemMessage: ChatCompletionMessageParam = {
			role: "system",
			content: "You are a helpful assistant."
		};
		if (chatMessages.length === 0 || chatMessages[0]?.role !== "system") {
			chatMessages.unshift(systemMessage);
		}

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					const completionStream = await openai.chat.completions.create({
						model: "deepseek-chat",
						messages: chatMessages,
						stream: true,
					});

					for await (const chunk of completionStream) {
						const content = chunk.choices[0]?.delta?.content;
						if (content) {
							controller.enqueue(encoder.encode(content));
						}
					}

					controller.close();
				} catch (error) {
					console.error("Stream error:", error);
					controller.error(error);
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no"
			},
		});

	} catch (error) {
		console.error("Error in chat route:", error);
		return Response.json({ error: String(error) }, { status: 500 });
	}
}

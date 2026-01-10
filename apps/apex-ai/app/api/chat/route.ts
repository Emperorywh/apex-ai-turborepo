import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getWeather } from '@/lib/weather';

const openai = new OpenAI({
	baseURL: 'https://api.deepseek.com',
	apiKey: process.env.DEEPSEEK_API_KEY,
});

// Define tools
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
	{
		type: "function",
		function: {
			name: "get_weather",
			description: "Get current weather and 7-day forecast for a specific city. Use this for any weather request including today, tomorrow, or future dates.",
			parameters: {
				type: "object",
				properties: {
					city: {
						type: "string",
						description: "The name of the city, e.g. Beijing, New York",
					},
					date: {
						type: "string",
						description: "The specific date to query weather for (optional), e.g. '2024-01-01' or 'tomorrow'. The tool will return a 7-day forecast covering this date.",
					},
				},
				required: ["city"],
			},
		},
	},
];

const SYSTEM_PROMPT = "You are a helpful assistant. You have access to a weather tool that provides current weather and a 7-day forecast. If the user asks for weather for a specific day (e.g., today, tomorrow, or a date within the next week), call `get_weather` for that city. Then, use the returned 7-day forecast data to find and report the weather for the specific day requested.";

export async function POST(request: Request) {
	try {
		const { messages } = await request.json();

		// 1. First call to model to check if it wants to call a tool
		// We use stream: false here to simplify tool handling
		const response = await openai.chat.completions.create({
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				...messages
			],
			model: "deepseek-chat",
			tools: tools,
			tool_choice: "auto",
			stream: false,
		});

		const responseMessage = response.choices[0].message;

		// Handle DeepSeek's specific DSML format if standard tool_calls are missing
		let toolCalls = responseMessage.tool_calls;
		let isDsml = false;

		if (!toolCalls && responseMessage.content && responseMessage.content.includes('<｜DSML｜function_calls>')) {
			const content = responseMessage.content;
			// Use a more robust regex to capture parameters across newlines
			const functionNameMatch = content.match(/<｜DSML｜invoke\s+name="([^"]+)"\s*>/);
			const cityMatch = content.match(/<｜DSML｜parameter\s+name="city"\s+string="true"\s*>([^<]+)<\/｜DSML｜parameter>/);
			
			if (functionNameMatch && cityMatch) {
				isDsml = true;
				// Clean up city name (remove whitespace)
				const city = cityMatch[1].trim();
				
				toolCalls = [{
					id: 'call_' + Math.random().toString(36).substring(7),
					type: 'function',
					function: {
						name: functionNameMatch[1],
						arguments: JSON.stringify({ city: city })
					}
				}];
			}
		}

		// 2. Check if the model wants to call a tool
		if (toolCalls) {
			// Append the model's request to the conversation history
			// If it was DSML, we need to adapt the message format to avoid confusing the model on the second pass
			// or just use the content as is if we want to preserve context, but for standard OpenAI format compatibility:
			const newMessages = [
				{ role: "system", content: SYSTEM_PROMPT },
				...messages,
				isDsml ? { role: "assistant", content: responseMessage.content } : responseMessage
			];

			// Execute tools
			for (const toolCall of toolCalls) {
				if ('function' in toolCall && toolCall.function.name === 'get_weather') {
					const args = JSON.parse(toolCall.function.arguments);
					console.log(`Calling weather tool for ${args.city}`);
					
					const weatherData = await getWeather(args.city);
					
					// Append the tool result to the conversation history
					newMessages.push({
						role: "tool",
						tool_call_id: toolCall.id,
						content: JSON.stringify(weatherData),
					});
				}
			}

			// 3. Second call to model to generate the final response with tool results
			// This time we stream the response
			const secondResponse = await openai.chat.completions.create({
				model: "deepseek-chat",
				messages: newMessages,
				stream: true,
			});

			const stream = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					try {
						for await (const chunk of secondResponse) {
							const content = chunk.choices[0]?.delta?.content || "";
							if (content) {
								controller.enqueue(encoder.encode(content));
							}
						}
						controller.close();
					} catch (err) {
						console.error("Stream error:", err);
						controller.error(err);
					}
				},
			});

			return new NextResponse(stream, {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});

		} else {
			// If no tool call, we have the final text in responseMessage.content
			// We need to stream it back to satisfy the frontend expectation
			const content = responseMessage.content || "";
			
			const stream = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					// Split content into chunks to simulate streaming (typewriter effect)
					// Sending everything at once causes the frontend to render it instantly, losing the effect.
					const chunkSize = 2; // Small chunk size for smooth effect
					for (let i = 0; i < content.length; i += chunkSize) {
						const chunk = content.slice(i, i + chunkSize);
						controller.enqueue(encoder.encode(chunk));
						// Tiny delay to allow frontend to render frames
						await new Promise(resolve => setTimeout(resolve, 10));
					}
					controller.close();
				},
			});

			return new NextResponse(stream, {
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}

	} catch (error) {
		console.error('Error calling DeepSeek API:', error);
		return NextResponse.json(
			{ error: 'Failed to fetch response from DeepSeek API' },
			{ status: 500 }
		);
	}
}

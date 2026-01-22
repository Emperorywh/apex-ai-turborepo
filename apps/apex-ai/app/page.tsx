"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface LangChainMessage {
	lc: number;
	type: "constructor";
	id: string[];
	kwargs: {
		content: string;
		id?: string;
		tool_calls?: any[];
		invalid_tool_calls?: any[];
		additional_kwargs?: Record<string, any>;
		response_metadata?: Record<string, any>;
		type?: string;
		name?: string;
		usage_metadata?: any;
	};
}

interface Conversation {
	id: string;
	title: string;
	messages: LangChainMessage[];
	createdAt: Date;
}

export default function Home() {
	const [conversations, setConversations] = useState<Conversation[]>([
		{
			id: "1",
			title: "欢迎对话",
			messages: [
				{
					lc: 1,
					type: "constructor",
					id: ["langchain_core", "messages", "AIMessage"],
					kwargs: {
						content: "你好！我是 Apex AI。准备好探索未知的领域了吗？",
						id: "welcome",
						tool_calls: [],
						invalid_tool_calls: [],
						additional_kwargs: {},
						response_metadata: {},
					},
				},
			],
			createdAt: new Date(),
		},
	]);
	const [currentConversationId, setCurrentConversationId] = useState("1");
	const [inputMessage, setInputMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [isMobile, setIsMobile] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const currentConversation = conversations.find((c) => c.id === currentConversationId);

	// Detect mobile
	useEffect(() => {
		const checkMobile = () => {
			const mobile = window.innerWidth < 768;
			setIsMobile(mobile);
			if (mobile) setSidebarOpen(false);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
		}
	}, [inputMessage]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [currentConversation?.messages]);

	const handleSendMessage = async () => {
		if (!inputMessage.trim() || isLoading) return;

		const newUserMessage: LangChainMessage = {
			lc: 1,
			type: "constructor",
			id: ["langchain_core", "messages", "HumanMessage"],
			kwargs: {
				content: inputMessage,
				id: Date.now().toString(),
				tool_calls: [],
				invalid_tool_calls: [],
				additional_kwargs: {},
				response_metadata: {},
			},
		};

		const updatedConversations = conversations.map((conv) => {
			if (conv.id === currentConversationId) {
				return {
					...conv,
					messages: [...conv.messages, newUserMessage],
					title: conv.messages.length === 1 ? inputMessage.slice(0, 30) + (inputMessage.length > 30 ? "..." : "") : conv.title,
				};
			}
			return conv;
		});

		setConversations(updatedConversations);
		setInputMessage("");
		setIsLoading(true);

		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		try {
			// Prepare messages for API
			const apiMessages = conversations
				.find((c) => c.id === currentConversationId)
				?.messages.map((m) => ({
					role: m.id.includes("HumanMessage") ? "user" : "assistant",
					content: m.kwargs.content,
				})) || [];
			apiMessages.push({ role: "user", content: inputMessage });

			const response = await fetch("/api/langchain", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages: apiMessages }),
			});

			if (!response.ok) {
				throw new Error("API request failed");
			}

			if (!response.body) {
				throw new Error("No response body");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let assistantMessageContent = "";
			const assistantMessageId = (Date.now() + 1).toString();

			// Create initial empty assistant message
			setConversations((prev) =>
				prev.map((conv) => {
					if (conv.id === currentConversationId) {
						return {
							...conv,
							messages: [
								...conv.messages,
								{
									lc: 1,
									type: "constructor",
									id: ["langchain_core", "messages", "AIMessage"],
									kwargs: {
										content: "",
										id: assistantMessageId,
										tool_calls: [],
										invalid_tool_calls: [],
										additional_kwargs: {},
										response_metadata: {},
									},
								},
							],
						};
					}
					return conv;
				})
			);

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const text = decoder.decode(value, { stream: true });
				assistantMessageContent += text;

				setConversations((prev) =>
					prev.map((conv) => {
						if (conv.id === currentConversationId) {
							const messages = [...conv.messages];
							const lastMessage = messages[messages.length - 1];
							if (lastMessage && lastMessage.kwargs.id === assistantMessageId) {
								messages[messages.length - 1] = {
									...lastMessage,
									kwargs: {
										...lastMessage.kwargs,
										content: assistantMessageContent,
									},
								};
							}
							return {
								...conv,
								messages,
							};
						}
						return conv;
					})
				);
			}
		} catch (error) {
			console.error("Error sending message:", error);
			// Optionally add an error message to the chat
		} finally {
			setIsLoading(false);
		}
	};

	const handleNewConversation = () => {
		const newConversation: Conversation = {
			id: Date.now().toString(),
			title: "新对话",
			messages: [],
			createdAt: new Date(),
		};
		setConversations([newConversation, ...conversations]);
		setCurrentConversationId(newConversation.id);
		if (isMobile) setSidebarOpen(false);
	};

	const handleDeleteConversation = (id: string) => {
		const updated = conversations.filter((c) => c.id !== id);
		if (updated.length === 0) {
			handleNewConversation();
			return;
		}
		setConversations(updated);
		if (currentConversationId === id) {
			if (updated.length > 0) {
				if (updated[0]) {
					setCurrentConversationId(updated[0].id);
				}
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-blue-500/30">
			{/* Mobile Overlay */}
			{isMobile && sidebarOpen && (
				<div
					className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
					onClick={() => setSidebarOpen(false)}
				/>
			)}
			{/* Sidebar */}
			<div
				className={`
					fixed md:relative z-50 h-full
					${sidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full md:w-0 md:translate-x-0"} 
					transition-all duration-300 ease-in-out
					border-r border-white/10 flex flex-col bg-black/95 backdrop-blur-xl
				`}
			>
				{/* Sidebar Header */}
				<div className="p-4 flex items-center justify-between">
					<div className={`flex items-center gap-2 ${!sidebarOpen && "hidden"}`}>
						<div className="w-8 h-8 bg-white text-black rounded-lg flex items-center justify-center font-bold text-xl tracking-tighter shadow-[0_0_15px_rgba(255,255,255,0.5)]">
							A
						</div>
						<span className="font-bold text-lg tracking-wide">APEX</span>
					</div>
					{isMobile && (
						<button onClick={() => setSidebarOpen(false)} className="p-2 text-neutral-400 hover:text-white">
							<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					)}
				</div>

				{/* New Chat Button */}
				<div className="px-3 pb-2">
					<button
						onClick={handleNewConversation}
						className={`
							w-full flex items-center gap-3 px-4 py-3 rounded-lg 
							bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20
							transition-all duration-200 group
							${!sidebarOpen && "hidden"}
						`}
					>
						<svg className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						<span className="font-medium text-sm text-neutral-300 group-hover:text-white">新建对话</span>
					</button>
				</div>

				{/* Conversation List */}
				<div className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 ${!sidebarOpen && "hidden"}`}>
					<div className="text-xs font-semibold text-neutral-500 mb-2 px-2 uppercase tracking-wider">History</div>
					{conversations.map((conv) => (
						<div
							key={conv.id}
							className={`
								group flex items-center gap-2 px-3 py-3 rounded-lg cursor-pointer transition-all duration-200
								border border-transparent
								${currentConversationId === conv.id
									? "bg-white/10 text-white border-white/5 shadow-sm"
									: "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
								}
							`}
							onClick={() => {
								setCurrentConversationId(conv.id);
								if (isMobile) setSidebarOpen(false);
							}}
						>
							<svg className="w-4 h-4 opacity-70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
							</svg>
							<span className="flex-1 text-sm truncate font-medium">{conv.title}</span>
							<button
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteConversation(conv.id);
								}}
								className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all text-neutral-500 hover:text-red-400"
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					))}
				</div>

				{/* User Profile */}
				<div className={`p-4 border-t border-white/10 ${!sidebarOpen && "hidden"}`}>
					<div className="flex items-center gap-3 px-2 py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
						<div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold ring-2 ring-black group-hover:ring-white/20 transition-all">
							U
						</div>
						<div className="flex flex-col">
							<span className="text-sm font-medium text-neutral-200 group-hover:text-white">User</span>
							<span className="text-xs text-neutral-500">Pro Plan</span>
						</div>
					</div>
				</div>
			</div>

			{/* Main Chat Area */}
			<div className="flex-1 flex flex-col relative bg-black">
				<div className="flex-1 overflow-y-auto pt-20 pb-4 scroll-smooth custom-scrollbar">
					<div className="max-w-3xl mx-auto px-4 md:px-6 flex flex-col gap-6">
						{currentConversation?.messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
								<div className="w-20 h-20 bg-white text-black rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
									<svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
									</svg>
								</div>
								<h1 className="text-3xl font-bold mb-2 tracking-tight">How can I help you today?</h1>
								<p className="text-neutral-500 max-w-md">
									I can help you write code, analyze data, or just have a chat.
								</p>
							</div>
						) : (
								currentConversation?.messages.map((msg) => {
									const role = msg.id.includes("HumanMessage") ? "user" : "assistant";
									
									let thoughtProcess = null;
									let displayContent = msg.kwargs.content;

									if (role === "assistant") {
										const thinkMatch = /<think>([\s\S]*?)(?:<\/think>|$)/.exec(msg.kwargs.content);
										if (thinkMatch) {
											thoughtProcess = thinkMatch[1];
											displayContent = msg.kwargs.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();
										}
									}

									return (
										<div
											key={msg.kwargs.id}
											className={`flex gap-4 ${role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
										>
											{role === "assistant" && (
												<div className="w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center text-black font-bold text-xs mt-1 shadow-[0_0_10px_rgba(255,255,255,0.2)]">
													A
												</div>
											)}

											<div className={`
											max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed
											${role === "user"
													? "bg-neutral-800 text-white rounded-br-none border border-neutral-700"
													: "bg-transparent text-neutral-200 px-0 md:px-0" // Minimalist style for AI
												}
										`}>
												{role === "assistant" ? (
													<div className="prose prose-invert max-w-none">
														{thoughtProcess && (
															<div className="mb-4">
																<details className="group border-l-2 border-neutral-700 pl-4 ml-1" open>
																	<summary className="text-xs font-mono text-neutral-500 cursor-pointer select-none hover:text-neutral-300 flex items-center gap-2 outline-none">
																		<svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
																		</svg>
																		<span>Thinking Process</span>
																	</summary>
																	<div className="mt-2 text-sm text-neutral-400 font-mono whitespace-pre-wrap leading-relaxed bg-neutral-900/50 p-3 rounded-md border border-neutral-800">
																		{thoughtProcess}
																		{!msg.kwargs.content.includes("</think>") && (
																			<span className="inline-block w-1.5 h-3 ml-1 bg-neutral-500 animate-pulse"/>
																		)}
																	</div>
																</details>
															</div>
														)}
														{displayContent && (
															<ReactMarkdown
																remarkPlugins={[remarkGfm]}
																components={{
															code({ node, inline, className, children, ...props }: any) {
																const match = /language-(\w+)/.exec(className || "");
																return !inline && match ? (
																	<div className="rounded-lg overflow-hidden my-4 border border-neutral-800">
																		<div className="bg-neutral-900 px-4 py-2 flex items-center justify-between border-b border-neutral-800">
																			<span className="text-xs text-neutral-400 font-mono">{match[1]}</span>
																		</div>
																		<SyntaxHighlighter
																			{...props}
																			style={vscDarkPlus}
																			language={match[1]}
																			PreTag="div"
																			customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
																		>
																			{String(children).replace(/\n$/, "")}
																		</SyntaxHighlighter>
																	</div>
																) : (
																	<code {...props} className={`${className} bg-neutral-800/50 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300`}>
																		{children}
																	</code>
																);
															},
															table({ children }) {
																return (
																	<div className="overflow-x-auto my-4 border border-neutral-800 rounded-lg">
																		<table className="min-w-full divide-y divide-neutral-800">
																			{children}
																		</table>
																	</div>
																);
															},
															thead({ children }) {
																return <thead className="bg-neutral-900">{children}</thead>;
															},
															th({ children }) {
																return <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">{children}</th>;
															},
															td({ children }) {
																return <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300 border-t border-neutral-800">{children}</td>;
															},
															a({ href, children }) {
																return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline">{children}</a>;
															},
															ul({ children }) {
																return <ul className="list-disc list-outside ml-4 space-y-1">{children}</ul>;
															},
															ol({ children }) {
																return <ol className="list-decimal list-outside ml-4 space-y-1">{children}</ol>;
															}
														}}
													>
														{displayContent}
													</ReactMarkdown>
														)}
												</div>
											) : (
												<p className="whitespace-pre-wrap">{msg.kwargs.content}</p>
											)}
										</div>

										{role === "user" && (
											<div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1">
												U
											</div>
										)}
									</div>
								);
							})
						)}
						{isLoading && (
							<div className="flex gap-4 animate-pulse">
								<div className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0"></div>
								<div className="flex flex-col gap-2 pt-2">
									<div className="h-4 w-48 bg-white/10 rounded"></div>
									<div className="h-4 w-32 bg-white/10 rounded"></div>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} className="h-4" />
					</div>
				</div>

				{/* Input Area */}
				<div className="p-4 md:pb-8 bg-black">
					<div className="max-w-3xl mx-auto">
						<div className="relative flex items-end gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2">
							<button className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0">
								<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
							</button>
							<textarea
								ref={textareaRef}
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Ask anything..."
								className="flex-1 bg-transparent border-none text-white placeholder-neutral-500 focus:ring-0 resize-none max-h-48 py-2 px-2 text-[15px] scrollbar-hide focus:outline-none"
								rows={1}
							/>
							<button
								onClick={handleSendMessage}
								disabled={!inputMessage.trim() || isLoading}
								className={`
									p-2 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0
									${inputMessage.trim() && !isLoading
										? "bg-white text-black hover:bg-neutral-200"
										: "bg-neutral-800 text-neutral-500 cursor-not-allowed"
									}
								`}
							>
								{isLoading ? (
									<div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
								) : (
									<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
									</svg>
								)}
							</button>
						</div>
						<div className="text-center mt-2">
							<p className="text-[10px] text-neutral-600">Apex AI can make mistakes. Consider checking important information.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Bot,
	Send,
	User,
	Plus,
	MessageSquare,
	Settings,
	Menu,
	Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import React, { FormEvent, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface Message {
	id: string
	role: "ai" | "user"
	content: string
}

// Mock Data
const INITIAL_MESSAGES: Message[] = [
	{
		id: "1",
		role: "ai",
		content: "Hello! I'm Apex AI. How can I assist you today?",
	},
]

const HISTORY_ITEMS: string[] = []

export default function ChatPage() {
	const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
	const [inputValue, setInputValue] = useState("")
	const [isSidebarOpen, setIsSidebarOpen] = useState(true)
	const [isLoading, setIsLoading] = useState(false)

	const messagesEndRef = useRef<HTMLDivElement>(null)

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}

	useEffect(() => {
		scrollToBottom()
	}, [messages, isLoading])

	const handleSendMessage = async (e?: FormEvent) => {
		e?.preventDefault()
		if (!inputValue.trim() || isLoading) return

		// Add User Message
		const userMsg: Message = {
			id: Date.now().toString(),
			role: "user",
			content: inputValue,
		}

		const newMessages = [...messages, userMsg]
		setMessages(newMessages)
		setInputValue("")
		setIsLoading(true)

		let hasReceivedContent = false
		const aiMsgId = (Date.now() + 1).toString()

		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					messages: newMessages.map(m => ({
						role: m.role === 'ai' ? 'assistant' : 'user',
						content: m.content
					}))
				}),
			})

			if (!response.ok) {
				throw new Error('Failed to fetch response')
			}

			if (!response.body) return

			// Create a placeholder for the AI message
			const aiMsg: Message = {
				id: aiMsgId,
				role: "ai",
				content: "",
			}
			setMessages((prev) => [...prev, aiMsg])

			// Turn off loading immediately as we start streaming
			setIsLoading(false)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				const text = decoder.decode(value, { stream: true })
				if (text) hasReceivedContent = true

				setMessages((prev) => {
					return prev.map((msg) => {
						if (msg.id === aiMsgId) {
							return { ...msg, content: msg.content + text }
						}
						return msg
					})
				})
			}
		} catch (error) {
			console.error('Error:', error)
			// Only show error message if we haven't received any content
			if (!hasReceivedContent) {
				const errorMsg: Message = {
					id: (Date.now() + 1).toString(),
					role: "ai",
					content: "Sorry, I encountered an error. Please try again later.",
				}
				setMessages((prev) => [...prev, errorMsg])
			} else {
				// If we have content, maybe append an error indicator or just log it
				// For now, we'll just keep what we have, assuming the stream was interrupted
				console.warn('Stream interrupted')
			}
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-cyan-500/30">

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
					isSidebarOpen ? "translate-x-0" : "-translate-x-full"
				)}
			>
				<div className="flex flex-col h-full">
					{/* Sidebar Header */}
					<div className="h-16 flex items-center px-4 border-b border-zinc-900">
						<div className="flex items-center gap-2 font-bold text-lg tracking-wider">
							<div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
								<Sparkles className="h-4 w-4 text-cyan-400" />
							</div>
							<span>APEX<span className="text-cyan-400">AI</span></span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="ml-auto lg:hidden text-zinc-400 hover:text-white"
							onClick={() => setIsSidebarOpen(false)}
						>
							<Menu className="h-5 w-5" />
						</Button>
					</div>

					{/* New Chat Button */}
					<div className="p-4">
						<Button
							className="w-full justify-start gap-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 hover:border-zinc-700 transition-all shadow-none"
							onClick={() => setMessages(INITIAL_MESSAGES)}
						>
							<Plus className="h-4 w-4 text-cyan-400" />
							New Chat
						</Button>
					</div>

					{/* History List */}
					<div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
						<div className="px-2 pb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
							Recent
						</div>
						{HISTORY_ITEMS.map((item, i) => (
							<button
								key={i}
								className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900/50 rounded-lg transition-colors text-left group"
							>
								<MessageSquare className="h-4 w-4 text-zinc-600 group-hover:text-cyan-500 transition-colors" />
								<span className="truncate">{item}</span>
							</button>
						))}
					</div>

					{/* User Profile */}
					<div className="p-4 border-t border-zinc-900">
						<div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-900/50 transition-colors cursor-pointer group">
							<div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-cyan-500/50 transition-colors">
								<User className="h-4 w-4 text-zinc-400 group-hover:text-cyan-400" />
							</div>
							<div className="flex-1 overflow-hidden">
								<p className="text-sm font-medium text-white truncate">User Name</p>
								<p className="text-xs text-zinc-500 truncate">user@apex.ai</p>
							</div>
							<Settings className="h-4 w-4 text-zinc-600 group-hover:text-white transition-colors" />
						</div>
					</div>
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex-1 flex flex-col min-w-0 bg-black relative">
				{/* Background Effects */}
				<div className="absolute inset-0 z-0 pointer-events-none">
					<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]"></div>
					<div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-cyan-900/5 to-transparent"></div>
				</div>

				{/* Mobile Header */}
				<header className="flex lg:hidden items-center h-16 px-4 border-b border-zinc-900 bg-black/80 backdrop-blur-md z-40 sticky top-0">
					<Button
						variant="ghost"
						size="icon"
						className="-ml-2 text-zinc-400 hover:text-white"
						onClick={() => setIsSidebarOpen(true)}
					>
						<Menu className="h-5 w-5" />
					</Button>
					<span className="ml-2 font-bold text-lg">APEX<span className="text-cyan-400">AI</span></span>
				</header>

				{/* Chat Area */}
				<div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 z-10">
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={cn(
								"flex gap-4 max-w-3xl mx-auto",
								msg.role === "user" ? "justify-end" : "justify-start"
							)}
						>
							{msg.role === "ai" && (
								<div className="flex-shrink-0 h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-1">
									<Bot className="h-5 w-5 text-cyan-400" />
								</div>
							)}

							<div
								className={cn(
									"rounded-2xl px-5 py-3 max-w-[85%] sm:max-w-[75%] text-sm leading-relaxed shadow-sm overflow-hidden",
									msg.role === "user"
										? "bg-zinc-800 text-white border border-zinc-700"
										: "bg-transparent text-zinc-100 border border-transparent prose prose-invert prose-p:leading-relaxed prose-pre:p-0 max-w-none"
								)}
							>
								{msg.role === "ai" ? (
									<ReactMarkdown
										remarkPlugins={[remarkGfm]}
										components={{
											code({ node, inline, className, children, ...props }: any) {
												const match = /language-(\w+)/.exec(className || "")
												return !inline && match ? (
													<SyntaxHighlighter
														{...props}
														style={vscDarkPlus}
														language={match[1]}
														PreTag="div"
														className="rounded-lg !bg-zinc-900 !p-4 !my-4"
													>
														{String(children).replace(/\n$/, "")}
													</SyntaxHighlighter>
												) : (
													<code {...props} className={cn("bg-zinc-800 px-1.5 py-0.5 rounded text-cyan-200 font-mono text-xs", className)}>
														{children}
													</code>
												)
											}
										}}
									>
										{msg.content}
									</ReactMarkdown>
								) : (
									msg.content
								)}
							</div>

							{msg.role === "user" && (
								<div className="flex-shrink-0 h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mt-1">
									<User className="h-4 w-4 text-zinc-400" />
								</div>
							)}
						</div>
					))}
					{isLoading && (
						<div className="flex gap-4 max-w-3xl mx-auto justify-start">
							<div className="flex-shrink-0 h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mt-1">
								<Bot className="h-5 w-5 text-cyan-400" />
							</div>
							<div className="rounded-2xl px-5 py-3 max-w-[85%] sm:max-w-[75%] text-sm leading-relaxed shadow-sm bg-transparent text-zinc-100 border border-transparent">
								<div className="flex gap-1">
									<span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
									<span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
									<span className="w-2 h-2 bg-cyan-400/50 rounded-full animate-bounce"></span>
								</div>
							</div>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* Input Area */}
				<div className="p-4 border-t border-zinc-900 bg-black/80 backdrop-blur-md z-20">
					<div className="max-w-3xl mx-auto relative">
						<form
							onSubmit={handleSendMessage}
							className="relative flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-2 focus-within:ring-1 focus-within:ring-cyan-500/50 focus-within:border-cyan-500/50 transition-all shadow-lg"
						>
							<Input
								className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-500 h-auto py-2 px-3 text-base md:text-sm"
								placeholder="Message Apex AI..."
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
							/>
							<Button
								type="submit"
								size="icon"
								disabled={!inputValue.trim()}
								className={cn(
									"h-8 w-8 rounded-lg transition-all",
									inputValue.trim()
										? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.3)]"
										: "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
								)}
							>
								<Send className="h-4 w-4" />
								<span className="sr-only">Send message</span>
							</Button>
						</form>
						<p className="text-center text-[10px] text-zinc-600 mt-2">
							AI can make mistakes. Please verify important information.
						</p>
					</div>
				</div>
			</main>
		</div>
	)
}

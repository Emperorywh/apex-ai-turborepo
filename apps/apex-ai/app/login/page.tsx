"use client";

import { useState } from "react";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		// TODO: 实现登录逻辑
		setTimeout(() => {
			setIsLoading(false);
		}, 2000);
	};

	return (
		<div className="min-h-screen bg-black flex">
			{/* 左侧 - 品牌区域 */}
			<div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-neutral-950">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
						<svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<span className="text-2xl font-semibold text-white">Apex</span>
				</div>

				<div className="max-w-md">
					<h1 className="text-5xl font-bold text-white leading-tight mb-6">
						探索 AI 的
						<br />
						<span className="text-neutral-400">无限可能</span>
					</h1>
					<p className="text-neutral-400 text-lg leading-relaxed">
						体验下一代智能对话助手，让 AI 成为您的得力助手。
					</p>
				</div>

				<div className="flex items-center gap-6 text-neutral-500 text-sm">
					<a href="#" className="hover:text-white transition-colors">关于我们</a>
					<a href="#" className="hover:text-white transition-colors">功能特性</a>
					<a href="#" className="hover:text-white transition-colors">隐私政策</a>
				</div>
			</div>

			{/* 右侧 - 登录表单 */}
			<div className="w-full lg:w-1/2 flex items-center justify-center p-8">
				<div className="w-full max-w-md">
					{/* 移动端 Logo */}
					<div className="lg:hidden flex items-center gap-3 mb-8">
						<div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
							<svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
						</div>
						<span className="text-2xl font-semibold text-white">Apex</span>
					</div>

					{/* 标题 */}
					<div className="mb-10">
						<h2 className="text-3xl font-semibold text-white mb-2">欢迎回来</h2>
						<p className="text-neutral-400">请输入您的账号信息</p>
					</div>

					{/* 表单 */}
					<form onSubmit={handleSubmit} className="space-y-5">
						<div className="space-y-1.5">
							<label htmlFor="email" className="block text-sm font-medium text-neutral-300">
								邮箱
							</label>
							<input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-0 transition-colors"
								placeholder="your@email.com"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<label htmlFor="password" className="block text-sm font-medium text-neutral-300">
									密码
								</label>
								<a href="#" className="text-sm text-neutral-500 hover:text-white transition-colors">
									忘记密码？
								</a>
							</div>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-0 transition-colors"
								placeholder="••••••••"
								required
							/>
						</div>

						<div className="flex items-center">
							<input
								type="checkbox"
								id="remember"
								className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-white focus:ring-offset-0 focus:ring-0"
							/>
							<label htmlFor="remember" className="ml-2 text-sm text-neutral-400">
								记住我
							</label>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full py-3 bg-white hover:bg-neutral-100 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? "登录中..." : "登录"}
						</button>
					</form>

					{/* 分割线 */}
					<div className="relative my-8">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t border-neutral-800"></div>
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="px-4 bg-black text-neutral-500">或</span>
						</div>
					</div>

					{/* 第三方登录 */}
					<div className="space-y-3">
						<button className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-3">
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
							</svg>
							使用 Google 继续
						</button>
						<button className="w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-3">
							<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
							</svg>
							使用 GitHub 继续
						</button>
					</div>

					{/* 注册链接 */}
					<p className="mt-8 text-center text-neutral-400">
						还没有账号？
						<a href="#" className="ml-1 text-white hover:underline font-medium">
							立即注册
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}

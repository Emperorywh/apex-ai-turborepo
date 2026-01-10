import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { Bot, Cpu, Sparkles } from "lucide-react"

export default function SignInPage() {
	return (
		<div className="w-full min-h-screen lg:grid lg:grid-cols-2 bg-black text-white selection:bg-cyan-500/30">
			{/* Left Side: Login Form */}
			<div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
				<div className="w-full max-w-[400px] space-y-8">
					{/* Header */}
					<div className="space-y-2">
						<div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
							<Sparkles className="h-5 w-5 text-cyan-400" />
						</div>
						<h1 className="text-3xl font-bold tracking-tight text-white">
							Welcome back
						</h1>
						<p className="text-sm text-zinc-400">
							Enter your credentials to access your Apex AI account
						</p>
					</div>

					{/* Form */}
					<div className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="email" className="text-zinc-300">Email</Label>
							<Input
								id="email"
								placeholder="name@example.com"
								type="email"
								autoCapitalize="none"
								autoComplete="email"
								autoCorrect="off"
								className="bg-zinc-900/50 border-zinc-800 text-white focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 placeholder:text-zinc-600 transition-all duration-300"
							/>
						</div>

						<Button className="w-full bg-cyan-500 text-black hover:bg-cyan-400 font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]">
							Sign In
						</Button>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t border-zinc-800" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-black px-2 text-zinc-500">Or continue with</span>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<Button variant="outline" className="border-zinc-800 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
								Google
							</Button>
							<Button variant="outline" className="border-zinc-800 bg-zinc-900/30 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
								GitHub
							</Button>
						</div>
					</div>

					<p className="text-center text-sm text-zinc-500">
						Don't have an account?{" "}
						<Link href="/sign-up" className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-4 decoration-cyan-400/30 hover:decoration-cyan-400">
							Sign up
						</Link>
					</p>
				</div>
			</div>

			{/* Right Side: Visual/AI Area */}
			<div className="hidden lg:flex flex-col justify-center items-center relative overflow-hidden bg-zinc-950 border-l border-zinc-900">
				{/* Background Grid Effect */}
				<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

				{/* Radial Gradient Glow */}
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_70%)]"></div>

				{/* Floating Icons/Elements */}
				<div className="relative z-10 flex flex-col items-center justify-center space-y-8 p-12 text-center">
					<div className="relative">
						{/* Animated Glow behind the icon */}
						<div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
						<div className="relative bg-black p-6 rounded-2xl border border-zinc-800 shadow-2xl">
							<Bot className="h-24 w-24 text-cyan-400" strokeWidth={1} />
						</div>

						{/* Decorator Icons */}
						<div className="absolute -top-6 -right-6 p-3 bg-zinc-900 rounded-xl border border-zinc-800 shadow-lg">
							<Cpu className="h-6 w-6 text-purple-400" />
						</div>
					</div>

					<div className="space-y-4 max-w-md">
						<h2 className="text-3xl font-bold tracking-tight text-white">
							Unlock the Power of <span className="text-cyan-400">AI</span>
						</h2>
						<p className="text-zinc-400 text-lg">
							Experience the next generation of artificial intelligence. Seamlessly integrated, infinitely powerful.
						</p>
					</div>

					{/* Decorative Code/Data Lines */}
					<div className="w-full max-w-sm space-y-2 opacity-50">
						<div className="h-1 w-3/4 bg-zinc-800 rounded-full overflow-hidden">
							<div className="h-full bg-cyan-500/50 w-1/2 rounded-full"></div>
						</div>
						<div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
							<div className="h-full bg-purple-500/50 w-2/3 rounded-full"></div>
						</div>
						<div className="h-1 w-5/6 bg-zinc-800 rounded-full overflow-hidden">
							<div className="h-full bg-cyan-500/30 w-1/3 rounded-full"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

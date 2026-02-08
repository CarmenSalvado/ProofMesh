"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

const DEMO_CODE_REQUIRED =
	process.env.NEXT_PUBLIC_DEMO_CODE_REQUIRED === "true" ||
	process.env.NODE_ENV === "production";
const ACCOUNT_AUTH_ENABLED =
	process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_AUTH === "true" ||
	process.env.NODE_ENV !== "production";

export default function LoginPage() {
	const { login, demo } = useAuth();
	const [mode, setMode] = useState<"demo" | "account">(
		!ACCOUNT_AUTH_ENABLED || DEMO_CODE_REQUIRED ? "demo" : "account"
	);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [demoCode, setDemoCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [demoLoading, setDemoLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			await login(email, password);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	};

	const handleDemo = async () => {
		setError("");
		if (DEMO_CODE_REQUIRED && !demoCode.trim()) {
			setError("Demo access code is required in production.");
			return;
		}
		setDemoLoading(true);
		try {
			await demo(demoCode.trim());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Demo login failed");
		} finally {
			setDemoLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)] px-6">
			<div className="w-full max-w-sm">
				{/* Logo */}
				<div className="flex justify-center mb-12">
					<Link href="/" className="flex items-center gap-2">
						<Logo size={24} />
						<span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">ProofMesh</span>
					</Link>
				</div>

				{/* Card */}
				<div className="border border-[var(--border-primary)] rounded-lg p-8 bg-[var(--bg-primary)]">
					<h1 className="text-xl font-medium text-center text-[var(--text-primary)] mb-2">
						{mode === "demo" ? "Enter demo" : "Sign in"}
					</h1>
					<p className="text-sm text-[var(--text-muted)] text-center mb-8">
						{mode === "demo"
							? "Use your demo access code"
							: "Access your reasoning workspace"}
					</p>

					{error && (
						<div className="mb-6 p-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] rounded-md text-sm">
							{error}
						</div>
					)}

					{mode === "account" && ACCOUNT_AUTH_ENABLED ? (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
									Email
								</label>
								<input
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									placeholder="you@university.edu"
									className="w-full"
								/>
							</div>

							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
									Password
								</label>
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									placeholder="••••••••"
									className="w-full"
								/>
							</div>

							<button
								type="submit"
								disabled={loading}
								className="w-full btn btn-primary py-2.5 mt-2 disabled:opacity-50"
							>
								{loading ? "Signing in..." : "Sign in"}
							</button>
						</form>
					) : (
						<div className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
									Demo access code
								</label>
								<input
									type="text"
									value={demoCode}
									onChange={(e) => setDemoCode(e.target.value)}
									placeholder="Enter access code"
									className="w-full uppercase tracking-wide"
								/>
							</div>

							<button
								type="button"
								onClick={handleDemo}
								disabled={demoLoading}
								className="w-full btn btn-primary py-2.5 disabled:opacity-50"
							>
								{demoLoading ? "Entering demo..." : "Enter demo"}
							</button>
						</div>
					)}

					{ACCOUNT_AUTH_ENABLED && (
						<div className="mt-4 text-center">
							<button
								type="button"
								onClick={() => {
									setError("");
									setMode(mode === "demo" ? "account" : "demo");
								}}
								className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline-offset-2 hover:underline"
							>
								{mode === "demo" ? "Use email and password instead" : "Use demo access code instead"}
							</button>
						</div>
					)}
				</div>

				{ACCOUNT_AUTH_ENABLED && (
					<p className="mt-8 text-center text-sm text-[var(--text-muted)]">
						Don&apos;t have an account?{" "}
						<Link href="/register" className="text-[var(--accent-primary)] font-medium hover:underline">
							Request access
						</Link>
					</p>
				)}
			</div>
		</div>
	);
}

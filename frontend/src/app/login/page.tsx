"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
	const { login, demo } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
		setDemoLoading(true);
		try {
			await demo();
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
						<div className="w-6 h-6 bg-[var(--text-primary)] rounded-md flex items-center justify-center text-[var(--bg-primary)]">
							<span className="font-[var(--font-math)] italic text-sm logo-rho">&rho;</span>
						</div>
						<span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">ProofMesh</span>
					</Link>
				</div>

				{/* Card */}
				<div className="border border-[var(--border-primary)] rounded-lg p-8 bg-[var(--bg-primary)]">
					<h1 className="text-xl font-medium text-center text-[var(--text-primary)] mb-2">
						Sign in
					</h1>
					<p className="text-sm text-[var(--text-muted)] text-center mb-8">
						Access your reasoning workspace
					</p>

					{error && (
						<div className="mb-6 p-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] rounded-md text-sm">
							{error}
						</div>
					)}

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

						<button
							type="button"
							onClick={handleDemo}
							disabled={demoLoading}
							className="w-full btn btn-secondary py-2.5 disabled:opacity-50"
						>
							{demoLoading ? "Entering demo..." : "Try demo (no account)"}
						</button>
					</form>
				</div>

				<p className="mt-8 text-center text-sm text-[var(--text-muted)]">
					Don't have an account?{" "}
					<Link href="/register" className="text-[var(--accent-primary)] font-medium hover:underline">
						Request access
					</Link>
				</p>
			</div>
		</div>
	);
}

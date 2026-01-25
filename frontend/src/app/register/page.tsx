"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
	const { register } = useAuth();
	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			return;
		}

		setLoading(true);

		try {
			await register(email, username, password);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Registration failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)] px-6">
			<div className="w-full max-w-sm">
				{/* Logo */}
				<div className="flex justify-center mb-12">
					<Link href="/" className="flex items-center gap-2">
						<div className="w-6 h-6 bg-[var(--text-primary)] rounded-md flex items-center justify-center text-[var(--bg-primary)]">
							<span className="font-[var(--font-math)] italic text-sm">∑</span>
						</div>
						<span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">ProofMesh</span>
					</Link>
				</div>

				{/* Card */}
				<div className="border border-[var(--border-primary)] rounded-lg p-8 bg-[var(--bg-primary)]">
					<h1 className="text-xl font-medium text-center text-[var(--text-primary)] mb-2">
						Request access
					</h1>
					<p className="text-sm text-[var(--text-muted)] text-center mb-8">
						Join the collaborative reasoning infrastructure
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
								Username
							</label>
							<input
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								pattern="[a-zA-Z0-9_]+"
								minLength={3}
								maxLength={20}
								placeholder="username"
								className="w-full"
							/>
							<p className="text-[10px] text-[var(--text-faint)] mt-1">
								3-20 characters, letters and numbers only
							</p>
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
								minLength={6}
								placeholder="••••••••"
								className="w-full"
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full btn btn-primary py-2.5 mt-2 disabled:opacity-50"
						>
							{loading ? "Creating account..." : "Create account"}
						</button>
					</form>
				</div>

				<p className="mt-8 text-center text-sm text-[var(--text-muted)]">
					Already have an account?{" "}
					<Link href="/login" className="text-[var(--accent-primary)] font-medium hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}

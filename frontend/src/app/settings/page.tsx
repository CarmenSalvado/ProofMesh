"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/useTheme";
import { WorkspaceSidebar } from "@/components/layout/WorkspaceSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function SettingsPage() {
	const { user, isLoading, logout } = useAuth();
	const { theme, setTheme } = useTheme();
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");

	useEffect(() => {
		if (!isLoading && !user) {
			router.push("/login");
		}
		if (user) {
			setUsername(user.username);
			setEmail(user.email);
		}

	}, [isLoading, user, router]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
				<div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--text-primary)] border-t-transparent" />
			</div>
		);
	}

	if (!user) return null;

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<WorkspaceSidebar />

			<main className="flex-1 flex flex-col h-full">
				<WorkspaceHeader
					breadcrumbs={[
						{ label: "Dashboard", href: "/dashboard" },
						{ label: "Settings" },
					]}
					status={null}
				/>

				<div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
					<div className="max-w-2xl mx-auto px-8 py-12">
						<div className="mb-8">
							<h1 className="text-2xl font-medium tracking-tight text-[var(--text-primary)] mb-2">
								Settings
							</h1>
							<p className="text-sm text-[var(--text-muted)]">
								Manage your account preferences
							</p>
						</div>

						{/* Profile Section */}
						<div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 mb-6">
							<h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Profile</h2>

							<div className="space-y-4">
								<div>
									<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
										Username
									</label>
									<input
										type="text"
										value={username}
										onChange={(e) => setUsername(e.target.value)}
										className="w-full opacity-60 cursor-not-allowed"
										disabled
									/>
									<p className="text-[10px] text-[var(--text-faint)] mt-1">Username cannot be changed</p>
								</div>

								<div>
									<label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
										Email
									</label>
									<input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										className="w-full opacity-60 cursor-not-allowed"
										disabled
									/>
								</div>
							</div>
						</div>

						{/* Appearance Section */}
						<div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-6 mb-6">
							<h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Appearance</h2>

							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-[var(--text-secondary)]">Theme</p>
									<p className="text-xs text-[var(--text-faint)]">Select your preferred theme</p>
								</div>
								<select
									value={theme}
									onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
									className="text-sm w-auto"
								>
									<option value="light">Light</option>
									<option value="dark">Dark</option>
									<option value="system">System</option>
								</select>
							</div>
						</div>

						{/* Danger Zone */}
						<div className="bg-[var(--bg-primary)] border border-[var(--error)] rounded-xl p-6">
							<h2 className="text-sm font-medium text-[var(--error)] mb-4">Danger Zone</h2>

							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-[var(--text-secondary)]">Sign Out</p>
									<p className="text-xs text-[var(--text-faint)]">Sign out of your account</p>
								</div>
								<button
									onClick={logout}
									className="px-3 py-1.5 bg-[var(--error-bg)] text-[var(--error)] text-xs font-medium rounded hover:opacity-80 transition-opacity"
								>
									Sign Out
								</button>
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function Header() {
	const { user, logout } = useAuth();

	return (
		<header className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b border-neutral-100">
			<div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
				{/* Logo */}
				<div className="flex items-center gap-8">
					<Link href="/dashboard" className="flex items-center gap-2">
						<div className="w-5 h-5 border border-neutral-900 bg-neutral-900" />
						<span className="text-sm font-semibold tracking-tight text-neutral-900">ProofMesh</span>
					</Link>

					{/* Nav */}
					<nav className="hidden md:flex gap-6">
						<Link href="/catalog" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
							Problems
						</Link>
						<Link href="/library" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
							Library
						</Link>
						<Link href="/activity" className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
							Activity
						</Link>
					</nav>
				</div>

				{/* User */}
				{user ? (
					<div className="flex items-center gap-4">
						<button className="text-neutral-500 hover:text-neutral-900 transition-colors">
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
							</svg>
						</button>
						<div className="flex items-center gap-3">
							<div className="w-7 h-7 rounded bg-neutral-200 flex items-center justify-center text-[11px] font-medium text-neutral-600">
								{user.username.slice(0, 2).toUpperCase()}
							</div>
							<span className="text-xs text-neutral-600 hidden sm:block">{user.username}</span>
						</div>
						<button
							onClick={logout}
							className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
						>
							Sign out
						</button>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<Link href="/login" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
							Sign in
						</Link>
						<Link href="/register" className="text-xs font-medium border border-neutral-200 px-4 py-2 rounded-md hover:border-neutral-400 transition-colors">
							Request access
						</Link>
					</div>
				)}
			</div>
		</header>
	);
}

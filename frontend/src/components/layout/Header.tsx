"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Search, Bell, ChevronDown, LogOut, User, Settings, HelpCircle } from "lucide-react";

function getInitials(name: string) {
	return name
		.split(/[\s_-]/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

export function Header() {
	const { user, logout } = useAuth();
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setDropdownOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	return (
		<header className="sticky top-0 w-full z-50 bg-white/90 backdrop-blur-sm border-b border-neutral-200">
			<div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
				{/* Logo & Nav */}
				<div className="flex items-center gap-6">
					<Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 group">
						<div className="w-6 h-6 bg-neutral-900 rounded-md flex items-center justify-center text-white group-hover:bg-indigo-600 transition-colors">
							<span className="font-[var(--font-math)] italic text-[12px] leading-none logo-rho">&rho;</span>
						</div>
						<span className="text-sm font-bold tracking-tight text-neutral-900">ProofMesh</span>
					</Link>

					{user && (
						<nav className="hidden md:flex items-center gap-1">
							<Link
								href="/dashboard"
								className="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 px-3 py-1.5 rounded-md transition-colors"
							>
								Home
							</Link>
							<Link
								href="/catalog"
								className="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 px-3 py-1.5 rounded-md transition-colors"
							>
								Explore
							</Link>
							<Link
								href="/library"
								className="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 px-3 py-1.5 rounded-md transition-colors"
							>
								Library
							</Link>
							<Link
								href="/social"
								className="text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 px-3 py-1.5 rounded-md transition-colors"
							>
								Network
							</Link>
						</nav>
					)}
				</div>

				{/* Search Bar */}
				{user && (
					<div className="flex-1 max-w-xl hidden md:block">
						<div className="relative group">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
								<Search className="w-4 h-4 text-neutral-400" />
							</div>
							<input
								type="text"
								className="block w-full rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-9 pr-12 text-sm placeholder:text-neutral-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all"
								placeholder="Search theorems, users, or axioms..."
							/>
							<div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
								<kbd className="inline-flex items-center rounded border border-neutral-200 bg-white px-1.5 font-sans text-[10px] text-neutral-400">
									/
								</kbd>
							</div>
						</div>
					</div>
				)}

				{/* User Area */}
				{user ? (
					<div className="flex items-center gap-2">
						{/* Notifications */}
						<button className="relative p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-md transition-colors">
							<Bell className="w-5 h-5" />
							<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white" />
						</button>

						<div className="h-5 w-px bg-neutral-200 mx-1" />

						{/* User Dropdown */}
						<div className="relative" ref={dropdownRef}>
							<button
								onClick={() => setDropdownOpen(!dropdownOpen)}
								className="flex items-center gap-2 p-1.5 hover:bg-neutral-50 rounded-md transition-colors group"
							>
								<div className="w-7 h-7 rounded-full bg-indigo-100 border border-neutral-200 group-hover:border-indigo-400 flex items-center justify-center text-[11px] font-bold text-indigo-700 transition-colors">
									{getInitials(user.username)}
								</div>
								<span className="text-sm font-medium text-neutral-700 hidden sm:block">{user.username}</span>
								<ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
							</button>

							{dropdownOpen && (
								<div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50">
									<div className="px-3 py-2 border-b border-neutral-100">
										<p className="text-sm font-medium text-neutral-900">{user.username}</p>
										<p className="text-xs text-neutral-500">@{user.username.toLowerCase()}</p>
									</div>
									<Link
										href="/profile"
										className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
										onClick={() => setDropdownOpen(false)}
									>
										<User className="w-4 h-4 text-neutral-400" />
										Your Profile
									</Link>
									<Link
										href="/settings"
										className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
										onClick={() => setDropdownOpen(false)}
									>
										<Settings className="w-4 h-4 text-neutral-400" />
										Settings
									</Link>
									<Link
										href="/help"
										className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
										onClick={() => setDropdownOpen(false)}
									>
										<HelpCircle className="w-4 h-4 text-neutral-400" />
										Help & Docs
									</Link>
									<div className="border-t border-neutral-100 mt-1 pt-1">
										<button
											onClick={() => {
												setDropdownOpen(false);
												logout();
											}}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
										>
											<LogOut className="w-4 h-4" />
											Sign out
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="flex items-center gap-3">
						<Link
							href="/login"
							className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
						>
							Sign in
						</Link>
						<Link
							href="/register"
							className="text-sm font-medium bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors"
						>
							Get Started
						</Link>
					</div>
				)}
			</div>
		</header>
	);
}

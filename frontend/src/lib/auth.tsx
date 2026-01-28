"use client";

import {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface User {
	id: string;
	email: string;
	username: string;
	avatar_url: string | null;
	bio: string | null;
}

interface AuthContextType {
	user: User | null;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, username: string, password: string) => Promise<void>;
	logout: () => void;
	getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		// Check for existing token on mount
		const token = localStorage.getItem("access_token");
		if (token) {
			fetchUser(token);
		} else {
			setIsLoading(false);
		}
	}, []);

	const fetchUser = async (token: string) => {
		try {
			const res = await fetch(`${API_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const userData = await res.json();
				setUser(userData);
			} else {
				// Token invalid, clear it
				localStorage.removeItem("access_token");
				localStorage.removeItem("refresh_token");
			}
		} catch {
			console.error("Failed to fetch user");
		} finally {
			setIsLoading(false);
		}
	};

	const login = async (email: string, password: string) => {
		const res = await fetch(`${API_URL}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		if (!res.ok) {
			const error = await res.json();
			throw new Error(error.detail || "Login failed");
		}

		const tokens = await res.json();
		localStorage.setItem("access_token", tokens.access_token);
		localStorage.setItem("refresh_token", tokens.refresh_token);
		await fetchUser(tokens.access_token);
		router.push("/dashboard");
	};

	const register = async (email: string, username: string, password: string) => {
		const res = await fetch(`${API_URL}/api/auth/register`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, username, password }),
		});

		if (!res.ok) {
			const error = await res.json();
			throw new Error(error.detail || "Registration failed");
		}

		const tokens = await res.json();
		localStorage.setItem("access_token", tokens.access_token);
		localStorage.setItem("refresh_token", tokens.refresh_token);
		await fetchUser(tokens.access_token);
		router.push("/dashboard");
	};

	const logout = () => {
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		setUser(null);
		router.push("/");
	};

	const getToken = () => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("access_token");
		}
		return null;
	};

	return (
		<AuthContext.Provider
			value={{ user, isLoading, login, register, logout, getToken }}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

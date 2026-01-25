"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type LogLevel = "info" | "success" | "warning" | "error";

export interface LogEntry {
	timestamp: string;
	agent: string | null;
	message: string;
	level: LogLevel;
}

export interface AgentStatus {
	agent_id: string;
	name: string;
	status: "idle" | "working" | "thinking" | "error";
	task: string | null;
	progress: number | null;
}

export interface WSMessage {
	type: string;
	data: Record<string, unknown>;
	timestamp: string;
}

interface UseWebSocketOptions {
	canvasId: string;
	onLog?: (log: LogEntry) => void;
	onAgentStatus?: (status: AgentStatus) => void;
	onCanvasUpdate?: (data: Record<string, unknown>) => void;
	autoReconnect?: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ||
	(typeof window !== "undefined"
		? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/^http/, "ws")
		: "ws://localhost:8080");

export function useWebSocket({
	canvasId,
	onLog,
	onAgentStatus,
	onCanvasUpdate,
	autoReconnect = true,
}: UseWebSocketOptions) {
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [agents, setAgents] = useState<Record<string, AgentStatus>>({});

	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return;

		const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
		const url = `${WS_URL}/ws/canvas/${canvasId}${token ? `?token=${token}` : ""}`;

		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => {
			setIsConnected(true);
			console.log("[WS] Connected to canvas:", canvasId);
		};

		ws.onclose = () => {
			setIsConnected(false);
			console.log("[WS] Disconnected from canvas:", canvasId);

			// Auto-reconnect
			if (autoReconnect) {
				reconnectTimeoutRef.current = setTimeout(() => {
					console.log("[WS] Attempting to reconnect...");
					connect();
				}, 3000);
			}
		};

		ws.onerror = (error) => {
			console.error("[WS] Error:", error);
		};

		ws.onmessage = (event) => {
			try {
				const message: WSMessage = JSON.parse(event.data);
				handleMessage(message);
			} catch (err) {
				console.error("[WS] Failed to parse message:", err);
			}
		};
	}, [canvasId, autoReconnect]);

	const handleMessage = useCallback((message: WSMessage) => {
		const { type, data, timestamp } = message;

		switch (type) {
			case "connected":
				console.log("[WS] Connection confirmed:", data);
				break;

			case "log":
				const logEntry: LogEntry = {
					timestamp: new Date(timestamp).toLocaleTimeString("en-US", {
						hour12: false,
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit"
					}),
					agent: data.agent as string | null,
					message: data.message as string,
					level: data.level as LogLevel,
				};
				setLogs((prev) => [...prev.slice(-99), logEntry]); // Keep last 100 logs
				onLog?.(logEntry);
				break;

			case "agent_status":
				const agentStatus: AgentStatus = {
					agent_id: data.agent_id as string,
					name: data.name as string,
					status: data.status as AgentStatus["status"],
					task: data.task as string | null,
					progress: data.progress as number | null,
				};
				setAgents((prev) => ({
					...prev,
					[agentStatus.agent_id]: agentStatus,
				}));
				onAgentStatus?.(agentStatus);
				break;

			case "canvas_update":
				onCanvasUpdate?.(data);
				break;

			case "pong":
				// Heartbeat response
				break;

			default:
				console.log("[WS] Unknown message type:", type, data);
		}
	}, [onLog, onAgentStatus, onCanvasUpdate]);

	const sendCommand = useCallback((action: string, data: Record<string, unknown> = {}) => {
		if (wsRef.current?.readyState !== WebSocket.OPEN) {
			console.warn("[WS] Cannot send command - not connected");
			return;
		}

		wsRef.current.send(JSON.stringify({
			type: "command",
			data: { action, ...data },
		}));
	}, []);

	const sendChat = useCallback((message: string) => {
		if (wsRef.current?.readyState !== WebSocket.OPEN) {
			console.warn("[WS] Cannot send chat - not connected");
			return;
		}

		wsRef.current.send(JSON.stringify({
			type: "chat",
			data: { message },
		}));
	}, []);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}
		wsRef.current?.close();
		wsRef.current = null;
		setIsConnected(false);
	}, []);

	// Connect on mount
	useEffect(() => {
		connect();
		return () => disconnect();
	}, [connect, disconnect]);

	// Heartbeat
	useEffect(() => {
		if (!isConnected) return;

		const interval = setInterval(() => {
			if (wsRef.current?.readyState === WebSocket.OPEN) {
				wsRef.current.send(JSON.stringify({ type: "ping" }));
			}
		}, 30000); // Every 30 seconds

		return () => clearInterval(interval);
	}, [isConnected]);

	return {
		isConnected,
		logs,
		agents: Object.values(agents),
		sendCommand,
		sendChat,
		runAgents: () => sendCommand("run_agents"),
		stopAgents: () => sendCommand("stop_agents"),
		disconnect,
		reconnect: connect,
	};
}

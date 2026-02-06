// API Types matching backend Pydantic schemas

export type UUID = string;

// Enums
export enum LineType {
	TEXT = "text",
	MATH = "math",
	GOAL = "goal",
	AGENT_INSERT = "agent_insert",
	LIBRARY_REF = "library_ref",
	VERIFICATION = "verification",
}

export enum AuthorType {
	HUMAN = "human",
	AGENT = "agent",
}

export enum LibraryItemKind {
	RESOURCE = "resource",
	IDEA = "idea",
	CONTENT = "content",
	FORMAL_TEST = "formal_test",
	LEMMA = "lemma",
	CLAIM = "claim",
	DEFINITION = "definition",
	THEOREM = "theorem",
	COUNTEREXAMPLE = "counterexample",
	COMPUTATION = "computation",
	NOTE = "note",
}

export enum LibraryItemStatus {
	PROPOSED = "proposed",
	VERIFIED = "verified",
	REJECTED = "rejected",
}

export enum CanvasStatus {
	DRAFT = "draft",
	VERIFIED = "verified",
	REVIEWING = "reviewing",
}

export enum AgentRunStatus {
	QUEUED = "queued",
	RUNNING = "running",
	FAILED = "failed",
	DONE = "done",
}

// Problem
export interface Problem {
	id: UUID;
	title: string;
	description: string | null;
	visibility: "public" | "private";
	difficulty: "easy" | "medium" | "hard" | null;
	tags: string[];
	author: {
		id: UUID;
		username: string;
		avatar_url?: string;
	};
	canvas_count: number;
	library_item_count: number;
	created_at: string;
	updated_at: string;
}

export interface ProblemCreate {
	title: string;
	description?: string;
	visibility?: "public" | "private";
	difficulty?: "easy" | "medium" | "hard";
	tags?: string[];
}

// Canvas
export interface Canvas {
	id: UUID;
	problem_id: UUID;
	title: string;
	content: string;
	status: CanvasStatus;
	created_at: string;
	updated_at: string;
}

export interface CanvasCreate {
	title: string;
	content?: string;
}

// Canvas Line
export interface CanvasLine {
	id: UUID;
	canvas_id: UUID;
	order_key: string;
	type: LineType;
	content: string;
	author_type: AuthorType;
	author_id: string;
	agent_run_id: UUID | null;
	library_item_id: UUID | null;
	derived_from: UUID | null;
	created_at: string;
	updated_at: string;
}

export interface CanvasLineCreate {
	type: LineType;
	content: string;
	author_type?: AuthorType;
	author_id: string;
	order_key?: string;
}

export interface CanvasLineUpdate {
	content?: string;
	type?: LineType;
	order_key?: string;
}

// Library Item
export interface AuthorInfo {
	type: "human" | "agent";
	id: string;
	name?: string;
	avatar_url?: string;
}

export interface LibraryItem {
	id: UUID;
	problem_id: UUID;
	title: string;
	kind: LibraryItemKind;
	content: string;
	formula: string | null;
	lean_code: string | null;
	status: LibraryItemStatus;
	x: number | null;
	y: number | null;
	authors: AuthorInfo[];
	source: {
		canvas_id?: UUID;
		line_id?: UUID;
		file_path?: string;
		cell_id?: string;
		agent_run_id?: UUID;
	} | null;
	dependencies: UUID[];
	verification: {
		method: string;
		logs: string;
		status: string;
	} | null;
	created_at: string;
	updated_at: string;
}

export interface LibraryItemCreate {
	title: string;
	kind: LibraryItemKind;
	content: string;
	formula?: string;
	lean_code?: string;
	authors?: AuthorInfo[];
	source?: {
		file_path?: string;
		cell_id?: string;
		agent_run_id?: UUID;
	};
	dependencies?: UUID[];
}

// Agent Run
export interface AgentProposal {
	title: string;
	kind: LibraryItemKind;
	content_markdown: string;
	dependencies?: UUID[];
	suggested_verification?: string;
}

export interface AgentOutput {
	summary: string;
	proposals: AgentProposal[];
	publish: AgentProposal[];
	notes?: string;
}

export interface AgentRun {
	id: UUID;
	canvas_id: UUID;
	status: AgentRunStatus;
	input_context: Record<string, unknown>;
	output: AgentOutput | null;
	tool_logs: Record<string, unknown> | null;
	created_at: string;
	completed_at: string | null;
}

// ==================== Canvas AI Types ====================

export enum CanvasAIRunStatus {
	QUEUED = "queued",
	RUNNING = "running",
	PAUSED = "paused",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
}

export enum CanvasAIRunType {
	EXPLORE = "explore",
	FORMALIZE = "formalize",
	VERIFY = "verify",
	CRITIQUE = "critique",
	PIPELINE = "pipeline",
	CHAT = "chat",
}

export enum NodeStateType {
	IDLE = "idle",
	THINKING = "thinking",
	GENERATING = "generating",
	VERIFYING = "verifying",
	COMPLETE = "complete",
	ERROR = "error",
}

export interface NodeCreatedSummary {
	id: string;
	title: string;
	kind: string;
}

export interface EdgeCreatedSummary {
	from_id: string;
	to_id: string;
	type: string;
}

export interface ActionSummaryData {
	type: "action_summary";
	action: string;
	run_id?: string;
	nodes_created?: NodeCreatedSummary[];
	edges_created?: EdgeCreatedSummary[];
	verification_result?: {
		success: boolean;
		log?: string;
	};
	lean_code?: string;
	confidence?: number;
	error?: string;
}

export interface CanvasAIMessage {
	id: UUID;
	problem_id: UUID;
	run_id: UUID | null;
	user_id: UUID | null;
	role: "user" | "assistant" | "system" | "action";
	content: string;
	message_data: ActionSummaryData | null;
	created_at: string;
}

export interface CanvasAIRun {
	id: UUID;
	problem_id: UUID;
	user_id: UUID;
	run_type: CanvasAIRunType;
	prompt: string;
	context: Record<string, unknown> | null;
	status: CanvasAIRunStatus;
	progress: number;
	current_step: string | null;
	summary: string | null;
	steps: string[];
	created_nodes: NodeCreatedSummary[];
	created_edges: EdgeCreatedSummary[];
	result: Record<string, unknown> | null;
	error: string | null;
	created_at: string;
	started_at: string | null;
	completed_at: string | null;
	redis_job_id: string | null;
	messages?: CanvasAIMessage[];
}

export interface CanvasAINodeState {
	id: UUID;
	run_id: UUID;
	node_id: UUID | null;
	temp_node_id: string | null;
	state: NodeStateType;
	state_data: {
		message?: string;
		progress?: number;
		title?: string;
	} | null;
	created_at: string;
	updated_at: string;
}

export interface ChatHistoryResponse {
	messages: CanvasAIMessage[];
	total: number;
	has_more: boolean;
}

export interface ActiveRunsResponse {
	runs: CanvasAIRun[];
}

// WebSocket/SSE Event Types
export interface RunProgressEvent {
	event_type: "run_progress";
	run_id: string;
	status: string;
	progress: number;
	current_step?: string;
}

export interface NodeStateEvent {
	event_type: "node_state";
	run_id: string;
	node_id?: string;
	temp_node_id?: string;
	state: NodeStateType;
	state_data?: Record<string, unknown>;
}

export interface NodeCreatedEvent {
	event_type: "node_created";
	run_id: string;
	node: Record<string, unknown>;
}

export interface EdgeCreatedEvent {
	event_type: "edge_created";
	run_id: string;
	edge: Record<string, unknown>;
}

export interface RunCompletedEvent {
	event_type: "run_completed";
	run_id: string;
	status: string;
	summary?: string;
	created_nodes?: NodeCreatedSummary[];
	created_edges?: EdgeCreatedSummary[];
	error?: string;
}

export interface MessageAddedEvent {
	event_type: "message_added";
	message: CanvasAIMessage;
}

export type CanvasAIEvent =
	| RunProgressEvent
	| NodeStateEvent
	| NodeCreatedEvent
	| EdgeCreatedEvent
	| RunCompletedEvent
	| MessageAddedEvent
	| { event_type: "active_run"; run: CanvasAIRun };

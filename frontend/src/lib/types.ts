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

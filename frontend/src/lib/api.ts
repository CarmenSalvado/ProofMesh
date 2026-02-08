/**
 * API Client for ProofMesh Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";


// Types
export interface AuthorInfo {
	id: string;
	username: string;
	avatar_url?: string;
}

export interface Problem {
	id: string;
	title: string;
	description: string | null;
	visibility: "public" | "private";
	difficulty: "easy" | "medium" | "hard" | null;
	tags: string[];
	created_at: string;
	updated_at: string;
	author: AuthorInfo;
	library_item_count: number;
	star_count?: number;
}

export interface LibraryItem {
	id: string;
	problem_id: string;
	title: string;
	kind: "RESOURCE" | "IDEA" | "CONTENT" | "FORMAL_TEST" | "LEMMA" | "CLAIM" | "DEFINITION" | "THEOREM" | "COUNTEREXAMPLE" | "COMPUTATION" | "NOTE";
	content: string;
	formula: string | null;
	lean_code: string | null;
	status: "PROPOSED" | "VERIFIED" | "REJECTED";
	x: number | null;
	y: number | null;
	authors: Array<{ type: string; id: string; name?: string; avatar_url?: string }>;
	source: { file_path?: string; cell_id?: string; agent_run_id?: string } | null;
	dependencies: string[];
	verification: { method: string; logs: string; status: string } | null;
	created_at: string;
	updated_at: string;
}

export interface ComputationExecutionResult {
	success: boolean;
	stdout: string;
	stderr: string;
	error: string | null;
	exit_code: number | null;
	duration_ms: number;
	executed_code: string;
}

export interface AgentProposal {
	id: string;
	agent_id?: string | null;
	agent_name?: string | null;
	title: string;
	kind: string;
	content_markdown: string;
	cell_type: "markdown" | "code";
}

export interface AgentProfile {
	id: string;
	name: string;
	task: string;
	description: string;
}

export interface SocialUser {
	id: string;
	username: string;
	avatar_url?: string | null;
	bio?: string | null;
	is_following?: boolean;
	is_followed_by?: boolean;
}

export interface SocialConnectionsResponse {
	followers: SocialUser[];
	following: SocialUser[];
	total_followers: number;
	total_following: number;
}

export interface SocialFeedItem {
	id: string;
	type: string;
	actor: { id: string; username: string; avatar_url?: string | null };
	problem?: { id: string; title: string; visibility: string } | null;
	target_id?: string | null;
	item_status?: string | null;
	item_kind?: string | null;
	verification_status?: string | null;
	verification_method?: string | null;
	has_lean_code?: boolean | null;
	extra_data?: Record<string, unknown> | null;
	created_at: string;
}

// Teams
export async function acceptTeamInvite(teamSlug: string, notificationId: string) {
	return apiFetch(`/social/teams/${teamSlug}/invites/${notificationId}/accept`, { method: "POST" });
}

export async function declineTeamInvite(teamSlug: string, notificationId: string) {
	return apiFetch(`/social/teams/${teamSlug}/invites/${notificationId}/decline`, { method: "POST" });
}

export interface SocialFeedResponse {
	items: SocialFeedItem[];
	total: number;
}

export interface SocialContributionUser {
	id: string;
	username: string;
	avatar_url?: string | null;
	contributions: number;
	last_contributed_at?: string | null;
}

// ============ Discussion Types ============

export interface Discussion {
	id: string;
	title: string;
	content: string;
	author: SocialUser;
	problem_id?: string | null;
	library_item_id?: string | null;
	is_resolved: boolean;
	is_pinned: boolean;
	comment_count: number;
	created_at: string;
	updated_at: string;
}

export interface DiscussionListResponse {
	discussions: Discussion[];
	total: number;
}

export interface DiscussionCreate {
	title: string;
	content: string;
	problem_id?: string;
	library_item_id?: string;
}

export interface DiscussionUpdate {
	title?: string;
	content?: string;
	is_resolved?: boolean;
	is_pinned?: boolean;
}

// ============ Comment Types ============

export interface Comment {
	id: string;
	content: string;
	author: SocialUser;
	discussion_id: string;
	discussion_title?: string | null;
	parent_id?: string | null;
	reply_count: number;
	created_at: string;
	updated_at: string;
}

export interface CommentListResponse {
	comments: Comment[];
	total: number;
}

export interface CommentCreate {
	content: string;
	parent_id?: string;
}

export interface UserActivityResponse {
	user: SocialUser;
	discussions: Discussion[];
	comments: Comment[];
	total_discussions: number;
	total_comments: number;
}

// ============ Star Types ============

export type StarTargetType = "problem" | "library_item" | "discussion";

export interface Star {
	id: string;
	user_id: string;
	target_type: StarTargetType;
	target_id: string;
	created_at: string;
}

export interface StarListResponse {
	stars: Star[];
	total: number;
}

export interface StarCreate {
	target_type: StarTargetType;
	target_id: string;
}

// ============ LaTeX AI Types ============

export interface LatexSynctexResponse {
	path: string;
	line: number;
	column?: number | null;
}

export interface LatexChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface LatexChatResponse {
	reply: string;
}

export interface LatexAutocompleteItem {
	label: string;
	insert_text: string;
}

export interface LatexAutocompleteResponse {
	suggestions: LatexAutocompleteItem[];
}

export interface LatexAIMemoryResponse {
	memory: string | null;
}

export interface LatexAIQuickAction {
	id: string;
	label: string;
	prompt: string;
	created_at: string;
}

export interface LatexAIMessageRecord {
	id: string;
	role: "user" | "assistant";
	content: string;
	run_id?: string | null;
	created_at: string;
}

export interface LatexAIRunRecord {
	id: string;
	prompt: string;
	summary?: string | null;
	status: string;
	steps: string[];
	edits: Array<{
		start: { line: number; column: number };
		end: { line: number; column: number };
		text: string;
	}>;
	file_path?: string | null;
	selection?: string | null;
	created_at: string;
}

// ...

export async function updateLatexAiRun(
	problemId: string,
	runId: string,
	data: { summary?: string; status?: string }
): Promise<LatexAIRunRecord> {
	return apiFetch(`/latex-ai/${problemId}/runs/${runId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteLatexAiRun(problemId: string, runId: string): Promise<void> {
	return apiFetch(`/latex-ai/${problemId}/runs/${runId}`, {
		method: "DELETE",
	});
}

export async function updateLatexAiRunSummary(
	problemId: string,
	runId: string,
	summary: string
): Promise<LatexAIRunRecord> {
	return updateLatexAiRun(problemId, runId, { summary });
}

export async function appendLatexAiRunStep(
	problemId: string,
	runId: string,
	text: string
): Promise<LatexAIRunRecord> {
	return apiFetch(`/latex-ai/${problemId}/runs/${runId}/step`, {
		method: "POST",
		body: JSON.stringify({ text }),
	});
}

export async function appendLatexAiRunEdit(
	problemId: string,
	runId: string,
	start: { line: number; column: number },
	end: { line: number; column: number },
	text: string
): Promise<LatexAIRunRecord> {
	return apiFetch(`/latex-ai/${problemId}/runs/${runId}/edit`, {
		method: "POST",
		body: JSON.stringify({ start, end, text }),
	});
}

export type NotificationType =
	| "follow"
	| "mention"
	| "new_discussion"
	| "new_comment"
	| "reply_to_comment"
	| "problem_forked"
	| "problem_starred"
	| "item_verified"
	| "item_rejected"
	| "team_invite"
	| "team_join"
	| "system";

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	content?: string | null;
	actor?: SocialUser | null;
	target_type?: string | null;
	target_id?: string | null;
	extra_data?: Record<string, unknown> | null;
	is_read: boolean;
	created_at: string;
}

export interface NotificationListResponse {
	notifications: Notification[];
	total: number;
	unread_count: number;
}

// ============ Team Types ============

export type TeamRole = "owner" | "admin" | "member";

export interface TeamMember {
	id: string;
	user: SocialUser;
	role: TeamRole;
	joined_at: string;
}

export interface TeamProblemSummary {
	problem_id: string;
	title: string;
	visibility: "public" | "private" | string;
	added_at: string;
	added_by?: SocialUser | null;
}

export interface Team {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	avatar_url?: string | null;
	is_public: boolean;
	member_count: number;
	problem_count: number;
	created_at: string;
	updated_at: string;
}

export interface TeamDetail extends Team {
	members: TeamMember[];
	problems: TeamProblemSummary[];
}

export interface TeamListResponse {
	teams: Team[];
	total: number;
}

export interface TeamCreate {
	name: string;
	slug: string;
	description?: string;
	is_public?: boolean;
}

export interface TeamUpdate {
	name?: string;
	description?: string;
	is_public?: boolean;
	avatar_url?: string;
}

export interface TeamInvite {
	user_id: string;
	role?: TeamRole;
}

export interface TeamAddProblem {
	problem_id: string;
}

export interface SocialProblemContribution {
	problem_id: string;
	problem_title: string;
	visibility: string;
	total_contributions: number;
	last_activity_at?: string | null;
	contributors: SocialContributionUser[];
}

export interface SocialContributionsResponse {
	problems: SocialProblemContribution[];
	total: number;
}

export interface AgentRunResponse {
	run_id: string;
	status: string;
	summary: string;
	proposals: AgentProposal[];
}

export interface WorkspaceContent {
	name: string;
	path: string;
	type: string;
	created: string | null;
	last_modified: string | null;
	mimetype: string | null;
	size: number | null;
	writable: boolean;
	format: string | null;
	content: string | WorkspaceContent[] | null;
}

// ============ LaTeX API ============

export interface LatexFileInfo {
	path: string;
	size?: number | null;
	last_modified?: string | null;
	content_type?: string | null;
}

export interface LatexFileListResponse {
	files: LatexFileInfo[];
}

export interface LatexFileResponse {
	path: string;
	content?: string | null;
	content_base64?: string | null;
	content_type?: string | null;
	is_binary: boolean;
}

export interface LatexFileWrite {
	content?: string | null;
	content_base64?: string | null;
	content_type?: string | null;
}

export interface LatexCompileResponse {
	status: string;
	log: string;
	pdf_key?: string | null;
	log_key?: string | null;
	meta_key?: string | null;
	duration_ms?: number | null;
}

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
	if (typeof window === "undefined") return {};
	const token = localStorage.getItem("access_token");
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
	if (typeof window === "undefined") return false;
	const token = localStorage.getItem("access_token");
	return !!token;
}

function encodePath(path: string): string {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

type ApiFetchOptions = RequestInit & {
	suppressErrorLog?: boolean;
	skipAuthRefresh?: boolean;
};

let tokenRefreshInFlight: Promise<string | null> | null = null;

async function requestAccessTokenRefresh(): Promise<string | null> {
	if (typeof window === "undefined") return null;

	const refreshToken = localStorage.getItem("refresh_token");
	if (!refreshToken) return null;

	try {
		const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (!response.ok) {
			localStorage.removeItem("access_token");
			localStorage.removeItem("refresh_token");
			return null;
		}

		const tokens = await response.json();
		const nextAccessToken = tokens?.access_token as string | undefined;
		const nextRefreshToken = tokens?.refresh_token as string | undefined;

		if (!nextAccessToken) return null;

		localStorage.setItem("access_token", nextAccessToken);
		if (nextRefreshToken) {
			localStorage.setItem("refresh_token", nextRefreshToken);
		}
		return nextAccessToken;
	} catch {
		return null;
	}
}

async function refreshAccessTokenOnce(): Promise<string | null> {
	if (!tokenRefreshInFlight) {
		tokenRefreshInFlight = requestAccessTokenRefresh().finally(() => {
			tokenRefreshInFlight = null;
		});
	}
	return tokenRefreshInFlight;
}

// Generic fetch wrapper
async function apiFetch<T>(
	endpoint: string,
	options: ApiFetchOptions = {}
): Promise<T> {
	const url = `${API_BASE_URL}/api${endpoint}`;
	const { suppressErrorLog, skipAuthRefresh = false, ...requestOptions } = options;
	const authHeaders = getAuthHeaders();

	const isFormData =
		typeof FormData !== "undefined" && requestOptions.body instanceof FormData;

	// Build headers properly
	const headers: HeadersInit = isFormData
		? {}
		: {
			"Content-Type": "application/json",
		};

	// Add auth headers if present
	if (authHeaders && typeof authHeaders === 'object' && 'Authorization' in authHeaders) {
		(headers as Record<string, string>)["Authorization"] = authHeaders.Authorization;
	}

	// Add additional headers from options
	if (requestOptions.headers) {
		if (typeof requestOptions.headers === 'object' && !Array.isArray(requestOptions.headers)) {
			Object.assign(headers, requestOptions.headers);
		}
	}

	// Check if we have auth
	const hasAuth = typeof authHeaders === 'object' && 'Authorization' in authHeaders;
	const canAttemptRefresh = !skipAuthRefresh && !endpoint.startsWith("/auth/");

	try {
		const doRequest = (requestHeaders: HeadersInit) =>
			fetch(url, {
				...requestOptions,
				headers: requestHeaders,
			});

		let response = await doRequest(headers);

		// Try one token refresh on 401 before failing (for expired access tokens).
		if (response.status === 401 && hasAuth && canAttemptRefresh) {
			const refreshedAccessToken = await refreshAccessTokenOnce();
			if (refreshedAccessToken) {
				(headers as Record<string, string>)["Authorization"] = `Bearer ${refreshedAccessToken}`;
				response = await doRequest(headers);
			}
		}

		if (!response.ok) {
			let errorDetail = "Unknown error";
			let errorData: Record<string, unknown> = {};

			const formatErrorDetail = (detail: unknown) => {
				if (!detail) return null;
				if (typeof detail === "string") return detail;
				if (Array.isArray(detail)) {
					return detail
						.map((item) => {
							if (typeof item === "string") return item;
							if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
								return item.msg;
							}
							return JSON.stringify(item);
						})
						.join("; ");
				}
				if (typeof detail === "object") {
					if ("msg" in detail && typeof (detail as { msg?: unknown }).msg === "string") {
						return (detail as { msg?: string }).msg || null;
					}
					return JSON.stringify(detail);
				}
				return String(detail);
			};

			try {
				const contentType = response.headers.get("content-type") || "";
				if (contentType.includes("application/json")) {
					const parsed = await response.json();
					errorData = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
					const formatted = formatErrorDetail(
						(errorData as { detail?: unknown; message?: unknown }).detail
						?? (errorData as { detail?: unknown; message?: unknown }).message
					);
					errorDetail = formatted || `API Error: ${response.status}`;
				} else {
					const text = await response.text();
					errorDetail = text || response.statusText || `API Error: ${response.status}`;
				}
			} catch {
				errorDetail = response.statusText || `API Error: ${response.status}`;
			}

			const method = requestOptions.method || "GET";

			// Enhanced error logging (string first for consoles that hide objects)
			if (!suppressErrorLog) {
				console.error(`API Request Failed: ${method} ${url} (${response.status})`);
				console.error("API Request Failed (details):", {
					url,
					method,
					status: response.status,
					statusText: response.statusText,
					error: errorData,
					errorDetail,
					hasAuth,
				});
			}

			// Handle auth vs permission failures separately.
			if (response.status === 401) {
				console.error("Authentication failed. Token may be invalid or expired.");
				if (typeof window !== "undefined") {
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
				}
			} else if (response.status === 403) {
				console.error("Request forbidden. Current user lacks permission for this action.");
			}

			const detailMessage = typeof errorDetail === "string" ? errorDetail : JSON.stringify(errorDetail);
			throw new Error(`${detailMessage} (HTTP ${response.status} ${method} ${url})`);
		}

		if (response.status === 204) {
			return null as T;
		}

		return response.json();
	} catch (error) {
		// Log network errors
		if (error instanceof TypeError && error.message === "Failed to fetch") {
			console.error("Network Error - Failed to fetch:", {
				url,
				method: requestOptions.method || "GET",
				hasAuth,
				message: "Unable to connect to the server. Please check if the backend is running.",
			});
			throw new Error("Network error: Unable to connect to the server. Please check if the backend is running.");
		}
		throw error;
	}
}

// Fetch wrapper for blob responses (PDFs, images, etc.)
async function apiFetchBlob(endpoint: string): Promise<Blob> {
	const url = `${API_BASE_URL}/api${endpoint}`;
	const authHeaders = getAuthHeaders();

	const headers: HeadersInit = {};
	if (authHeaders && typeof authHeaders === 'object' && 'Authorization' in authHeaders) {
		(headers as Record<string, string>)["Authorization"] = authHeaders.Authorization;
	}

	const response = await fetch(url, { headers, cache: "no-store" });
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Failed to fetch blob: ${response.status}`);
	}
	return response.blob();
}

// Fetch wrapper for text responses (logs, plain text files)
async function apiFetchText(endpoint: string): Promise<string> {
	const url = `${API_BASE_URL}/api${endpoint}`;
	const authHeaders = getAuthHeaders();

	const headers: HeadersInit = {};
	if (authHeaders && typeof authHeaders === 'object' && 'Authorization' in authHeaders) {
		(headers as Record<string, string>)["Authorization"] = authHeaders.Authorization;
	}

	const response = await fetch(url, { headers, cache: "no-store" });
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Failed to fetch text: ${response.status}`);
	}
	return response.text();
}

// ============ User API ============

export interface UserProfile {
	id: string;
	email: string;
	username: string;
	avatar_url: string | null;
	bio: string | null;
	created_at: string;
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
	const formData = new FormData();
	formData.append("file", file);
	return apiFetch<UserProfile>("/auth/me/avatar", {
		method: "POST",
		body: formData,
	});
}

export async function updateMe(data: {
	avatar_url?: string | null;
	bio?: string | null;
}): Promise<UserProfile> {
	return apiFetch<UserProfile>("/auth/me", {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

// ============ Problems API ============

export async function getProblems(params?: {
	visibility?: "public" | "private";
	mine?: boolean;
}): Promise<{ problems: Problem[]; total: number }> {
	const searchParams = new URLSearchParams();
	if (params?.visibility) searchParams.set("visibility", params.visibility);
	if (params?.mine) searchParams.set("mine", "true");

	const query = searchParams.toString();
	return apiFetch(`/problems${query ? `?${query}` : ""}`);
}

export async function seedProblems(): Promise<{ problems: Problem[]; total: number }> {
	return apiFetch("/problems/seed", { method: "POST" });
}

export async function getProblem(
	problemId: string,
	options?: { suppressErrorLog?: boolean }
): Promise<Problem> {
	return apiFetch(`/problems/${problemId}`, options);
}

export async function createProblem(data: {
	title: string;
	description?: string;
	visibility?: "public" | "private";
	difficulty?: "easy" | "medium" | "hard";
	tags?: string[];
}): Promise<Problem> {
	return apiFetch("/problems", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateProblem(
	problemId: string,
	data: Partial<{
		title: string;
		description: string;
		visibility: "public" | "private";
		difficulty: "easy" | "medium" | "hard";
		tags: string[];
	}>
): Promise<Problem> {
	return apiFetch(`/problems/${problemId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteProblem(problemId: string): Promise<void> {
	return apiFetch(`/problems/${problemId}`, { method: "DELETE" });
}

export async function forkProblem(problemId: string): Promise<Problem> {
	return apiFetch(`/problems/${problemId}/fork`, { method: "POST" });
}

// ============ Library API ============

export async function getLibraryItems(
	problemId: string,
	params?: { kind?: LibraryItem["kind"]; status?: LibraryItem["status"] },
	options?: { suppressErrorLog?: boolean }
): Promise<{ items: LibraryItem[]; total: number }> {
	const searchParams = new URLSearchParams();
	if (params?.kind) searchParams.set("kind", params.kind);
	if (params?.status) searchParams.set("status", params.status);

	const query = searchParams.toString();
	return apiFetch(`/problems/${problemId}/library${query ? `?${query}` : ""}`, options);
}

export async function getLibraryItem(problemId: string, itemId: string): Promise<LibraryItem> {
	return apiFetch(`/problems/${problemId}/library/${itemId}`);
}

export async function createLibraryItem(
	problemId: string,
	data: {
		title: string;
		kind: LibraryItem["kind"];
		content: string;
		formula?: string;
		lean_code?: string;
		x?: number;
		y?: number;
		authors?: Array<{ type: "human" | "agent"; id: string; name?: string }>;
		source?: { file_path?: string; cell_id?: string; agent_run_id?: string };
		dependencies?: string[];
	}
): Promise<LibraryItem> {
	return apiFetch(`/problems/${problemId}/library`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateLibraryItem(
	problemId: string,
	itemId: string,
	data: Partial<{
		title: string;
		content: string;
		formula: string;
		lean_code: string;
		status: LibraryItem["status"];
		x: number;
		y: number;
		dependencies: string[];
		verification: { method: string; logs: string; status: string };
	}>
): Promise<LibraryItem> {
	return apiFetch(`/problems/${problemId}/library/${itemId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function executeComputationNode(
	problemId: string,
	itemId: string,
	data?: { code?: string; timeout_seconds?: number }
): Promise<ComputationExecutionResult> {
	return apiFetch(`/problems/${problemId}/library/${itemId}/execute`, {
		method: "POST",
		body: JSON.stringify(data || {}),
	});
}

export async function deleteLibraryItem(problemId: string, itemId: string): Promise<void> {
	return apiFetch(`/problems/${problemId}/library/${itemId}`, { method: "DELETE" });
}

// ============ Agents API ============

export async function runAgent(data: {
	problem_id: string;
	file_path?: string | null;
	cell_id?: string | null;
	context?: string | null;
	task: string;
	instructions?: string | null;
	agent_id?: string | null;
}): Promise<AgentRunResponse> {
	return apiFetch("/agents/run", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function getAgents(): Promise<{ agents: AgentProfile[] }> {
	return apiFetch("/agents");
}

// ============ Social API ============

export async function getSocialUsers(params?: {
	q?: string;
	limit?: number;
}): Promise<{ users: SocialUser[]; total: number }> {
	const searchParams = new URLSearchParams();
	if (params?.q) searchParams.set("q", params.q);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/users${query ? `?${query}` : ""}`);
}

export async function getSocialConnections(): Promise<SocialConnectionsResponse> {
	return apiFetch("/social/connections");
}

export async function getUserActivity(
	username: string,
	params?: { discussions_limit?: number; comments_limit?: number }
): Promise<UserActivityResponse> {
	const searchParams = new URLSearchParams();
	if (params?.discussions_limit) searchParams.set("discussions_limit", params.discussions_limit.toString());
	if (params?.comments_limit) searchParams.set("comments_limit", params.comments_limit.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/users/${encodeURIComponent(username)}/activity${query ? `?${query}` : ""}`);
}

export async function followUser(userId: string): Promise<{ status: string }> {
	return apiFetch(`/social/follow/${userId}`, { method: "POST" });
}

export async function unfollowUser(userId: string): Promise<{ status: string }> {
	return apiFetch(`/social/follow/${userId}`, { method: "DELETE" });
}

export async function getSocialFeed(params?: {
	scope?: "network" | "global";
	limit?: number;
	offset?: number;
}): Promise<SocialFeedResponse> {
	const searchParams = new URLSearchParams();
	if (params?.scope) searchParams.set("scope", params.scope);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	if (params?.offset) searchParams.set("offset", params.offset.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/feed${query ? `?${query}` : ""}`);
}

export async function getSocialContributions(): Promise<SocialContributionsResponse> {
	return apiFetch("/social/contributions");
}

export async function seedSocial(): Promise<{ status: string }> {
	return apiFetch("/social/seed", { method: "POST" });
}

// ============ Workspace Contents API ============

export async function getWorkspaceContent(
	problemId: string,
	path: string
): Promise<WorkspaceContent> {
	return apiFetch(`/workspaces/${problemId}/contents/${encodePath(path)}?content=1`);
}

export async function listWorkspaceContents(
	problemId: string,
	path = ""
): Promise<WorkspaceContent> {
	const normalized = path ? `/${encodePath(path)}` : "";
	return apiFetch(`/workspaces/${problemId}/contents${normalized}?content=1`);
}

export async function upsertWorkspaceContent(
	problemId: string,
	path: string,
	content: string
): Promise<WorkspaceContent> {
	return apiFetch(`/workspaces/${problemId}/contents/${encodePath(path)}`, {
		method: "PUT",
		body: JSON.stringify({
			type: "file",
			format: "markdown",
			content,
		}),
	});
}

export async function createWorkspaceDirectory(
	problemId: string,
	path: string
): Promise<WorkspaceContent> {
	return apiFetch(`/workspaces/${problemId}/contents/${encodePath(path)}`, {
		method: "PUT",
		body: JSON.stringify({
			type: "directory",
		}),
	});
}

export async function renameWorkspaceContent(
	problemId: string,
	path: string,
	newPath: string
): Promise<WorkspaceContent> {
	return apiFetch(`/workspaces/${problemId}/contents/${encodePath(path)}`, {
		method: "PATCH",
		body: JSON.stringify({
			path: newPath,
		}),
	});
}

export async function deleteWorkspaceContent(
	problemId: string,
	path: string
): Promise<void> {
	return apiFetch(`/workspaces/${problemId}/contents/${encodePath(path)}`, {
		method: "DELETE",
	});
}

// ============ LaTeX Workspace API ============

export async function listLatexFiles(problemId: string): Promise<LatexFileListResponse> {
	return apiFetch(`/latex/${problemId}/files`);
}

export async function getLatexFile(
	problemId: string,
	path: string
): Promise<LatexFileResponse> {
	return apiFetch(`/latex/${problemId}/files/${encodePath(path)}`);
}

export async function putLatexFile(
	problemId: string,
	path: string,
	payload: LatexFileWrite
): Promise<LatexFileResponse> {
	return apiFetch(`/latex/${problemId}/files/${encodePath(path)}`, {
		method: "PUT",
		body: JSON.stringify(payload),
	});
}

export async function deleteLatexFile(problemId: string, path: string): Promise<void> {
	return apiFetch(`/latex/${problemId}/files/${encodePath(path)}`, {
		method: "DELETE",
	});
}

export async function deleteLatexPath(
	problemId: string,
	path: string,
	recursive = false
): Promise<void> {
	const query = recursive ? "?recursive=true" : "";
	return apiFetch(`/latex/${problemId}/files/${encodePath(path)}${query}`, {
		method: "DELETE",
	});
}

export async function renameLatexPath(
	problemId: string,
	fromPath: string,
	toPath: string
): Promise<void> {
	return apiFetch(`/latex/${problemId}/rename`, {
		method: "POST",
		body: JSON.stringify({ from_path: fromPath, to_path: toPath }),
	});
}

export async function compileLatexProject(
	problemId: string,
	main = "main.tex"
): Promise<LatexCompileResponse> {
	return apiFetch(`/latex/${problemId}/compile`, {
		method: "POST",
		body: JSON.stringify({ main }),
	});
}

export async function fetchLatexOutputPdf(problemId: string, cacheBust?: string): Promise<Blob> {
	const query = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
	return apiFetchBlob(`/latex/${problemId}/output.pdf${query}`);
}

export async function fetchLatexOutputLog(problemId: string, cacheBust?: string): Promise<string> {
	const query = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
	return apiFetchText(`/latex/${problemId}/output.log${query}`);
}

export async function mapLatexPdfToSource(
	problemId: string,
	page: number,
	x: number,
	y: number
): Promise<LatexSynctexResponse> {
	return apiFetch(`/latex/${problemId}/synctex`, {
		method: "POST",
		body: JSON.stringify({ page, x, y }),
		suppressErrorLog: true,
	});
}

export async function chatLatexAi(
	problemId: string,
	payload: {
		message: string;
		file_path?: string;
		selection?: string;
		context?: string;
		history?: LatexChatMessage[];
	}
): Promise<LatexChatResponse> {
	return apiFetch(`/latex-ai/${problemId}/chat`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function autocompleteLatexAi(
	problemId: string,
	payload: {
		file_path?: string;
		before: string;
		after: string;
		max_suggestions?: number;
	}
): Promise<LatexAutocompleteResponse> {
	return apiFetch(`/latex-ai/${problemId}/autocomplete`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function getLatexAiMemory(problemId: string): Promise<LatexAIMemoryResponse> {
	return apiFetch<LatexAIMemoryResponse>(`/latex-ai/${problemId}/memory`);
}

export async function updateLatexAiMemory(
	problemId: string,
	memory: string | null
): Promise<LatexAIMemoryResponse> {
	return apiFetch<LatexAIMemoryResponse>(`/latex-ai/${problemId}/memory`, {
		method: "PUT",
		body: JSON.stringify({ memory }),
	});
}

export async function listLatexAiActions(problemId: string): Promise<LatexAIQuickAction[]> {
	return apiFetch<LatexAIQuickAction[]>(`/latex-ai/${problemId}/actions`);
}

export async function createLatexAiAction(
	problemId: string,
	payload: { label: string; prompt: string }
): Promise<LatexAIQuickAction> {
	return apiFetch<LatexAIQuickAction>(`/latex-ai/${problemId}/actions`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function deleteLatexAiAction(
	problemId: string,
	actionId: string
): Promise<void> {
	await apiFetch(`/latex-ai/${problemId}/actions/${actionId}`, { method: "DELETE" });
}

export async function listLatexAiMessages(
	problemId: string,
	limit = 200
): Promise<LatexAIMessageRecord[]> {
	return apiFetch<LatexAIMessageRecord[]>(
		`/latex-ai/${problemId}/messages?limit=${limit}`
	);
}

export async function createLatexAiMessage(
	problemId: string,
	payload: { role: "user" | "assistant"; content: string; run_id?: string | null }
): Promise<LatexAIMessageRecord> {
	return apiFetch<LatexAIMessageRecord>(`/latex-ai/${problemId}/messages`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

export async function deleteLatexAiTempMessages(problemId: string): Promise<void> {
	return apiFetch(`/latex-ai/${problemId}/messages?scope=temp`, {
		method: "DELETE",
	});
}

export async function listLatexAiRuns(
	problemId: string,
	limit = 50,
	status?: string
): Promise<LatexAIRunRecord[]> {
	let url = `/latex-ai/${problemId}/runs?limit=${limit}`;
	if (status) url += `&status=${status}`;
	return apiFetch<LatexAIRunRecord[]>(url);
}

export async function createLatexAiRun(
	problemId: string,
	payload: { prompt: string; file_path?: string | null; selection?: string | null }
): Promise<LatexAIRunRecord> {
	return apiFetch<LatexAIRunRecord>(`/latex-ai/${problemId}/runs`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}


// ============ Discussions API ============

export async function getDiscussions(params?: {
	problem_id?: string;
	library_item_id?: string;
	limit?: number;
	offset?: number;
}): Promise<DiscussionListResponse> {
	const searchParams = new URLSearchParams();
	if (params?.problem_id) searchParams.set("problem_id", params.problem_id);
	if (params?.library_item_id) searchParams.set("library_item_id", params.library_item_id);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	if (params?.offset) searchParams.set("offset", params.offset.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/discussions${query ? `?${query}` : ""}`);
}

export async function getDiscussion(discussionId: string): Promise<Discussion> {
	return apiFetch(`/social/discussions/${discussionId}`);
}

export async function createDiscussion(data: DiscussionCreate): Promise<Discussion> {
	return apiFetch("/social/discussions", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateDiscussion(
	discussionId: string,
	data: DiscussionUpdate
): Promise<Discussion> {
	return apiFetch(`/social/discussions/${discussionId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteDiscussion(discussionId: string): Promise<void> {
	return apiFetch(`/social/discussions/${discussionId}`, { method: "DELETE" });
}

// ============ Comments API ============

export async function getComments(
	discussionId: string,
	params?: { limit?: number; offset?: number }
): Promise<CommentListResponse> {
	const searchParams = new URLSearchParams();
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	if (params?.offset) searchParams.set("offset", params.offset.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/discussions/${discussionId}/comments${query ? `?${query}` : ""}`);
}

export async function createComment(
	discussionId: string,
	data: CommentCreate
): Promise<Comment> {
	return apiFetch(`/social/discussions/${discussionId}/comments`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateComment(
	discussionId: string,
	commentId: string,
	content: string
): Promise<Comment> {
	return apiFetch(`/social/discussions/${discussionId}/comments/${commentId}`, {
		method: "PATCH",
		body: JSON.stringify({ content }),
	});
}

export async function deleteComment(discussionId: string, commentId: string): Promise<void> {
	return apiFetch(`/social/discussions/${discussionId}/comments/${commentId}`, {
		method: "DELETE",
	});
}

// ============ Stars API ============

export async function createStar(data: StarCreate): Promise<Star> {
	return apiFetch("/social/stars", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function deleteStar(targetType: StarTargetType, targetId: string): Promise<void> {
	return apiFetch(`/social/stars/${targetType}/${targetId}`, { method: "DELETE" });
}

export async function getStars(params?: {
	target_type?: StarTargetType;
	limit?: number;
}): Promise<StarListResponse> {
	const MAX_STARS_LIMIT = 200;
	const searchParams = new URLSearchParams();
	if (params?.target_type) searchParams.set("target_type", params.target_type);
	if (params?.limit) {
		searchParams.set("limit", Math.min(params.limit, MAX_STARS_LIMIT).toString());
	}
	const query = searchParams.toString();
	return apiFetch(`/social/stars${query ? `?${query}` : ""}`);
}

export async function checkIsStarred(
	targetType: StarTargetType,
	targetId: string
): Promise<boolean> {
	try {
		const result = await apiFetch<{ is_starred: boolean }>(
			`/social/stars/check/${targetType}/${targetId}`
		);
		return result.is_starred;
	} catch {
		return false;
	}
}

// ============ Notifications API ============

export async function getNotifications(params?: {
	unread_only?: boolean;
	limit?: number;
	offset?: number;
}): Promise<NotificationListResponse> {
	const searchParams = new URLSearchParams();
	if (params?.unread_only) searchParams.set("unread_only", "true");
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	if (params?.offset) searchParams.set("offset", params.offset.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/notifications${query ? `?${query}` : ""}`);
}

export async function markNotificationsRead(notificationIds: string[]): Promise<{ status: string }> {
	return apiFetch("/social/notifications/read", {
		method: "POST",
		body: JSON.stringify({ notification_ids: notificationIds }),
	});
}

export async function markAllNotificationsRead(): Promise<{ status: string }> {
	return apiFetch("/social/notifications/read-all", { method: "POST" });
}

// ============ Teams API ============

export async function getTeams(params?: {
	my_teams?: boolean;
	is_public?: boolean;
	q?: string;
	limit?: number;
}): Promise<TeamListResponse> {
	const searchParams = new URLSearchParams();
	if (params?.my_teams) searchParams.set("my_teams", "true");
	if (params?.is_public !== undefined) searchParams.set("is_public", params.is_public.toString());
	if (params?.q) searchParams.set("q", params.q);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/teams${query ? `?${query}` : ""}`);
}

export async function getTeam(slug: string): Promise<TeamDetail> {
	return apiFetch(`/social/teams/${slug}`);
}

export async function createTeam(data: TeamCreate): Promise<Team> {
	return apiFetch("/social/teams", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateTeam(slug: string, data: TeamUpdate): Promise<Team> {
	return apiFetch(`/social/teams/${slug}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteTeam(slug: string): Promise<void> {
	return apiFetch(`/social/teams/${slug}`, { method: "DELETE" });
}

export async function inviteTeamMember(slug: string, data: TeamInvite): Promise<{ status: string }> {
	return apiFetch(`/social/teams/${slug}/members`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function removeTeamMember(slug: string, userId: string): Promise<void> {
	return apiFetch(`/social/teams/${slug}/members/${userId}`, { method: "DELETE" });
}

export async function addTeamProblem(slug: string, problemId: string): Promise<{ status: string }> {
	return apiFetch(`/social/teams/${slug}/problems`, {
		method: "POST",
		body: JSON.stringify({ problem_id: problemId }),
	});
}

export async function removeTeamProblem(slug: string, problemId: string): Promise<void> {
	return apiFetch(`/social/teams/${slug}/problems/${problemId}`, { method: "DELETE" });
}

export async function leaveTeam(slug: string): Promise<void> {
	return apiFetch(`/social/teams/${slug}/leave`, { method: "POST" });
}

// ============ Trending & Stats ============

export interface TrendingProblem {
	id: string;
	title: string;
	description?: string | null;
	author: SocialUser;
	tags: string[];
	star_count: number;
	activity_score: number;
	recent_activity_count: number;
	trend_label?: string | null;
}

export interface TrendingResponse {
	problems: TrendingProblem[];
	total: number;
}

export interface PlatformStats {
	total_users: number;
	total_problems: number;
	total_verified_items: number;
	total_discussions: number;
	active_users_today: number;
}

export async function getTrendingProblems(limit: number = 10): Promise<TrendingResponse> {
	return apiFetch(`/social/trending?limit=${limit}`);
}

export async function getPlatformStats(): Promise<PlatformStats> {
	return apiFetch("/social/stats");
}


// ============ Orchestration API (Real AI Agents) ============

export interface OrchestrationProposal {
	id: string;
	content: string;
	reasoning: string;
	diagram?: OrchestrationDiagram | null;
	score: number;
	iteration: number;
}

export interface OrchestrationDiagramNode {
	id: string;
	type: string;
	title: string;
	content?: string | null;
	formula?: string | null;
	lean_code?: string | null;
}

export interface OrchestrationDiagramEdge {
	from: string;
	to: string;
	type?: string | null;
	label?: string | null;
}

export interface OrchestrationDiagram {
	nodes: OrchestrationDiagramNode[];
	edges: OrchestrationDiagramEdge[];
}

export interface ExploreResponse {
	run_id: string;
	status: string;
	proposals: OrchestrationProposal[];
	best_score: number;
	total_iterations: number;
}

export interface CanvasIdeaNodeBlueprint {
	kind: string;
	title: string;
	content: string;
	formula?: string | null;
	lean_code?: string | null;
	status: "PROPOSED" | "VERIFIED" | "REJECTED" | string;
}

export interface CanvasIdeaRouterResponse {
	run_id: string;
	status: string;
	route: "explore" | "formalize_verify" | "compute" | "critique" | string;
	insight: string;
	agents_used: string[];
	proposals: OrchestrationProposal[];
	node_blueprints: CanvasIdeaNodeBlueprint[];
	best_score: number;
	total_iterations: number;
	trace: string[];
}

export interface FormalizeResponse {
	run_id: string;
	status: string;
	lean_code: string;
	imports: string[];
	confidence: number;
}

export interface CritiqueResponse {
	run_id: string;
	status: string;
	score: number;
	feedback: string;
	suggestions: string[];
	issues: string[];
}

export interface VerifyResponse {
	run_id: string;
	status: string;
	success: boolean;
	log: string;
	error?: string | null;
}

export interface PipelineStage {
	status: string;
	[key: string]: unknown;
}

export interface PipelineResponse {
	run_id: string;
	status: string;
	stages: Record<string, PipelineStage>;
	library_item_id?: string | null;
	message: string;
}

export interface OrchestrationStatus {
	available: boolean;
	agents?: string[];
	tools?: string[];
	reason?: string;
}

export interface StreamEvent {
	event: string;
	stage?: string;
	status?: string;
	message?: string;
	data?: Record<string, unknown>;
}

export async function getOrchestrationStatus(): Promise<OrchestrationStatus> {
	return apiFetch("/orchestration/status");
}

export async function exploreContext(data: {
	problem_id: string;
	context: string;
	max_iterations?: number;
}): Promise<ExploreResponse> {
	return apiFetch("/orchestration/explore", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function routeCanvasIdeas(data: {
	problem_id: string;
	prompt?: string;
	context?: string;
	max_iterations?: number;
	include_critique?: boolean;
	include_formalization?: boolean;
}): Promise<CanvasIdeaRouterResponse> {
	return apiFetch("/orchestration/canvas-router", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function formalizeText(data: {
	problem_id: string;
	text: string;
	hints?: string[];
}): Promise<FormalizeResponse> {
	return apiFetch("/orchestration/formalize", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function critiqueProposal(data: {
	problem_id: string;
	proposal: string;
	context?: string;
	goal?: string;
}): Promise<CritiqueResponse> {
	return apiFetch("/orchestration/critique", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function verifyLeanCode(data: {
	problem_id: string;
	lean_code: string;
}): Promise<VerifyResponse> {
	return apiFetch("/orchestration/verify", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function runFullPipeline(data: {
	problem_id: string;
	context: string;
	auto_publish?: boolean;
}): Promise<PipelineResponse> {
	return apiFetch("/orchestration/pipeline", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export function streamPipeline(
	data: { problem_id: string; context: string; auto_publish?: boolean },
	onEvent: (event: StreamEvent) => void,
	onError?: (error: Error) => void,
): AbortController {
	const controller = new AbortController();
	const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

	fetch(`${API_BASE_URL}/api/orchestration/pipeline/stream`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(data),
		signal: controller.signal,
	})
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`Stream failed: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						try {
							const event = JSON.parse(line.slice(6));
							onEvent(event);
						} catch (e) {
							// Skip invalid JSON
						}
					}
				}
			}
		})
		.catch((error) => {
			if (error.name !== "AbortError") {
				onError?.(error);
			}
		});

	return controller;
}

// ============ Document Section Types ============
export interface DocSection {
	id: string;
	workspace_file_id: string;
	slug: string;
	title: string;
	level: number;
	order_index: number;
	content_preview: string | null;
	created_at: string;
	updated_at: string;
	anchor_count?: number;
}

export interface DocAnchor {
	id: string;
	section_id: string;
	library_item_id: string;
	library_item_updated_at: string;
	is_stale: boolean;
	position_hint: string | null;
	created_at: string;
	library_item?: LibraryItem;
}

export interface CommitToDocumentRequest {
	node_ids: string[];
	workspace_file_id?: string;
	workspace_file_path?: string;
	section_title: string;
	format?: "markdown" | "latex";
}

export interface CommitToDocumentResponse {
	section: DocSection;
	anchors: DocAnchor[];
	generated_content: string;
}

// ============ Document Section Functions ============

export async function getDocumentSections(workspaceFileId: string): Promise<DocSection[]> {
	return apiFetch(`/documents/files/${workspaceFileId}/sections`);
}

export async function createDocumentSection(data: {
	workspace_file_id: string;
	slug?: string;
	title: string;
	level?: number;
	order_index?: number;
	content_preview?: string;
}): Promise<DocSection> {
	return apiFetch("/documents/sections", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateDocumentSection(
	sectionId: string,
	data: {
		slug?: string;
		title?: string;
		level?: number;
		order_index?: number;
		content_preview?: string;
	}
): Promise<DocSection> {
	return apiFetch(`/documents/sections/${sectionId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteDocumentSection(sectionId: string): Promise<void> {
	return apiFetch(`/documents/sections/${sectionId}`, {
		method: "DELETE",
	});
}

// ============ Document Anchor Functions ============

export async function getSectionAnchors(sectionId: string): Promise<DocAnchor[]> {
	return apiFetch(`/documents/sections/${sectionId}/anchors`);
}

export async function getNodeAnchors(libraryItemId: string): Promise<DocAnchor[]> {
	return apiFetch(`/documents/nodes/${libraryItemId}/anchors`);
}

export async function createDocAnchor(data: {
	section_id: string;
	library_item_id: string;
	position_hint?: string;
}): Promise<DocAnchor> {
	return apiFetch("/documents/anchors", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function deleteDocAnchor(anchorId: string): Promise<void> {
	return apiFetch(`/documents/anchors/${anchorId}`, {
		method: "DELETE",
	});
}

export async function refreshAnchor(anchorId: string): Promise<DocAnchor> {
	return apiFetch(`/documents/anchors/${anchorId}/refresh`, {
		method: "POST",
	});
}

// ============ Commit to Document ============

export async function commitToDocument(
	problemId: string,
	data: CommitToDocumentRequest
): Promise<CommitToDocumentResponse> {
	return apiFetch(`/documents/problems/${problemId}/commit-to-document`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function getNodeAnchorStatus(nodeIds: string[]): Promise<{
	node_id: string;
	has_anchors: boolean;
	is_stale: boolean;
	anchor_count: number;
}[]> {
	const validIds = nodeIds.filter((id) => typeof id === "string" && id.trim().length > 0);
	if (validIds.length === 0) return [];
	return apiFetch(`/documents/nodes/anchor-status`, {
		method: "POST",
		body: JSON.stringify({ node_ids: validIds }),
	});
}

// ============ Canvas Blocks API ============

export interface CanvasBlock {
	id: string;
	problem_id: string;
	name: string;
	node_ids: string[];
	created_at: string;
	updated_at: string;
}

export interface CanvasBlockListResponse {
	blocks: CanvasBlock[];
	total: number;
}

export async function getCanvasBlocks(problemId: string): Promise<CanvasBlock[]> {
	return apiFetch(`/problems/${problemId}/blocks`);
}

export async function getCanvasBlock(problemId: string, blockId: string): Promise<CanvasBlock> {
	return apiFetch(`/problems/${problemId}/blocks/${blockId}`);
}

export async function createCanvasBlock(
	problemId: string,
	data: {
		name: string;
		node_ids: string[];
	}
): Promise<CanvasBlock> {
	return apiFetch(`/problems/${problemId}/blocks`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function updateCanvasBlock(
	problemId: string,
	blockId: string,
	data: {
		name?: string;
		node_ids?: string[];
	}
): Promise<CanvasBlock> {
	return apiFetch(`/problems/${problemId}/blocks/${blockId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function deleteCanvasBlock(problemId: string, blockId: string): Promise<void> {
	return apiFetch(`/canvas-blocks/problems/${problemId}/blocks/${blockId}`, {
		method: "DELETE",
	});
}

// ============ Canvas AI API ============

import {
	CanvasAIRunType,
} from "./types";
import type {
	CanvasAIRun,
	CanvasAIMessage,
	ChatHistoryResponse,
	ActiveRunsResponse,
	CanvasAIEvent,
} from "./types";

// Re-export types for convenience
export type { CanvasAIEvent, CanvasAIMessage, CanvasAIRun };

export interface CreateCanvasAIRunRequest {
	run_type?: CanvasAIRunType;
	prompt: string;
	context?: Record<string, unknown>;
}

export interface CreateCanvasAIMessageRequest {
	role: "user" | "assistant" | "system" | "action";
	content: string;
	run_id?: string;
	message_data?: Record<string, unknown>;
}

export async function createCanvasAIRun(
	problemId: string,
	prompt: string,
	contextNodeIds?: string[]
): Promise<CanvasAIRun> {
	const data: CreateCanvasAIRunRequest = {
		run_type: CanvasAIRunType.EXPLORE,
		prompt,
		context: contextNodeIds && contextNodeIds.length > 0
			? { context_node_ids: contextNodeIds }
			: undefined,
	};
	return apiFetch(`/canvas-ai/problems/${problemId}/runs`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function getCanvasAIRuns(
	problemId: string,
	options?: { status?: string; limit?: number; offset?: number }
): Promise<CanvasAIRun[]> {
	const params = new URLSearchParams();
	if (options?.status) params.set("status", options.status);
	if (options?.limit) params.set("limit", options.limit.toString());
	if (options?.offset) params.set("offset", options.offset.toString());
	const query = params.toString();
	return apiFetch(`/canvas-ai/problems/${problemId}/runs${query ? `?${query}` : ""}`);
}

export async function getCanvasAIActiveRuns(problemId: string): Promise<ActiveRunsResponse> {
	return apiFetch(`/canvas-ai/problems/${problemId}/runs/active`);
}

export async function getCanvasAIRun(problemId: string, runId: string): Promise<CanvasAIRun> {
	return apiFetch(`/canvas-ai/problems/${problemId}/runs/${runId}`);
}

export async function cancelCanvasAIRun(
	problemId: string,
	runId: string
): Promise<{ status: string; run_id: string }> {
	return apiFetch(`/canvas-ai/problems/${problemId}/runs/${runId}/cancel`, {
		method: "POST",
	});
}

export async function getCanvasAIChatHistory(
	problemId: string,
	options?: { limit?: number; before?: string }
): Promise<ChatHistoryResponse> {
	const params = new URLSearchParams();
	if (options?.limit) params.set("limit", options.limit.toString());
	if (options?.before) params.set("before", options.before);
	const query = params.toString();
	return apiFetch(`/canvas-ai/problems/${problemId}/messages${query ? `?${query}` : ""}`);
}

export async function createCanvasAIMessage(
	problemId: string,
	data: CreateCanvasAIMessageRequest
): Promise<CanvasAIMessage> {
	return apiFetch(`/canvas-ai/problems/${problemId}/messages`, {
		method: "POST",
		body: JSON.stringify(data),
	});
}

/**
 * Connect to Canvas AI WebSocket for real-time updates.
 * Returns cleanup function.
 */
export function connectCanvasAIWebSocket(
	problemId: string,
	onEvent: (event: CanvasAIEvent) => void,
	onError?: (error: Event) => void,
	onClose?: () => void
): { close: () => void; socket: WebSocket } {
	const wsUrl = API_BASE_URL.replace(/^http/, "ws");
	const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
	const url = `${wsUrl}/api/canvas-ai/problems/${problemId}/ws${token ? `?token=${token}` : ""}`;

	const socket = new WebSocket(url);
	let pingInterval: NodeJS.Timeout | null = null;

	socket.onopen = () => {
		console.log("Canvas AI WebSocket connected");
		// Keep-alive ping every 30 seconds
		pingInterval = setInterval(() => {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send("ping");
			}
		}, 30000);
	};

	socket.onmessage = (event) => {
		// Skip non-JSON messages (like "pong")
		if (typeof event.data === "string" && event.data === "pong") {
			return;
		}

		try {
			const data = JSON.parse(event.data) as CanvasAIEvent;
			onEvent(data);
		} catch (e) {
			console.error("Failed to parse WebSocket message:", e, event.data);
		}
	};

	socket.onerror = (event) => {
		// WebSocket errors are expected when server is unavailable or user is not authenticated
		// Only log in development for debugging
		if (process.env.NODE_ENV === 'development') {
			console.debug("Canvas AI WebSocket connection failed (this is normal if not authenticated)");
		}
		onError?.(event);
	};

	socket.onclose = () => {
		console.log("Canvas AI WebSocket closed");
		if (pingInterval) {
			clearInterval(pingInterval);
		}
		onClose?.();
	};

	return {
		close: () => {
			if (pingInterval) {
				clearInterval(pingInterval);
			}
			socket.close();
		},
		socket,
	};
}

// ============ Reasoning Traces ============

export interface ReasoningTraceStep {
	id: string;
	run_id?: string;
	step_number: number;
	step_type: "thinking" | "retrieval" | "generation" | "verification" | "reflection";
	content: string;
	duration_ms?: number;
	kg_nodes_used?: string[];
	agent_name?: string;
	agent_type?: string;
	started_at?: string;
	completed_at?: string;
	extra_data?: Record<string, unknown>;
	created_at?: string;
}

interface ReasoningTracesResponse {
	run_id: string;
	traces: ReasoningTraceStep[];
}

export async function getReasoningTraces(runId: string): Promise<ReasoningTraceStep[]> {
	const response = await apiFetch<ReasoningTracesResponse>(`/canvas-ai/runs/${runId}/reasoning-traces`);
	return response.traces || [];
}

/**
 * Connect to reasoning stream WebSocket for real-time reasoning updates.
 */
export function connectReasoningStreamWebSocket(
	runId: string,
	onChunk: (chunk: {
		type: "thinking" | "retrieval" | "generation" | "verification" | "reflection" | "complete" | "error";
		content?: string;
		step_number?: number;
		kg_nodes_used?: string[];
	}) => void,
	onError?: (error: Event) => void,
	onClose?: () => void
): { close: () => void; socket: WebSocket } {
	const wsUrl = API_BASE_URL.replace(/^http/, "ws");
	const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
	const url = `${wsUrl}/api/canvas-ai/runs/${runId}/stream${token ? `?token=${token}` : ""}`;

	const socket = new WebSocket(url);

	socket.onopen = () => {
		console.log("Reasoning Stream WebSocket connected for run:", runId);
	};

	socket.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			onChunk(data);
		} catch (error) {
			console.error("Error parsing reasoning chunk:", error);
		}
	};

	socket.onerror = (event) => {
		console.error("Reasoning Stream WebSocket error:", event);
		onError?.(event);
	};

	socket.onclose = () => {
		console.log("Reasoning Stream WebSocket closed");
		onClose?.();
	};

	return {
		close: () => socket.close(),
		socket,
	};
}

// ============ Idea2Paper Integration Types ============

export interface StoryGenerationRequest {
	user_idea: string;
	pattern_id?: string;
	context?: string;
	use_fusion?: boolean;
}

export interface StorySection {
	title: string;
	content: string;
}

export interface Story {
	id: string;
	problem_id: string;
	user_idea: string;
	pattern_id?: string;
	sections: {
		title: string;
		abstract: string;
		problem_framing: string;
		gap_identification: string;
		solution_approach: string;
		method_skeleton: string;
		innovation_claims: string;
		experiments_plan: string;
	};
	metadata: {
		pattern_name?: string;
		domain?: string;
	};
	review_result?: {
		passed: boolean;
		scores: {
			reviewer_1?: number;
			reviewer_2?: number;
			reviewer_3?: number;
			average: number;
			q25: number;
			q50: number;
			q75: number;
		};
		individual_reviews: Array<{
			anchor_title: string;
			score: number;
			justification: string;
		}>;
		pass_criteria: string;
	};
	novelty_result?: {
		is_novel: boolean;
		similarity_score: number;
		risk_level: "low" | "medium" | "high";
		most_similar?: {
			title: string;
			similarity: number;
		};
	};
	parent_story_id?: string;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface StoryListResponse {
	stories: Story[];
	total: number;
}

export interface StoryGenerationResponse {
	story: Story;
}

export interface IdeaFusionRequest {
	ideas: string[];
	context?: string;
}

export interface IdeaFusionResponse {
	fused_idea: string;
	source_ideas: string[];
	fusion_type: "problem_fusion" | "assumption_fusion" | "innovation_fusion";
	explanation: string;
	pattern_id?: string;
	pattern_name?: string;
}

export interface PatternBasedExploreRequest {
	query: string;
	use_patterns: boolean;
	num_patterns?: number;
}

// ============ Idea2Paper API Functions ============

/**
 * Generate a research story from a user idea using Idea2Paper pipeline
 */
export async function generateStory(
	problemId: string,
	payload: StoryGenerationRequest
): Promise<StoryGenerationResponse> {
	const response = await apiFetch<{
		story_id?: string;
		story: Record<string, unknown>;
		review?: Record<string, unknown>;
		novelty?: Record<string, unknown>;
	}>(`/workspaces/${problemId}/contents/generate-story`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
	return {
		story: normalizeStoryFromApi(response, problemId),
	};
}

/**
 * Refine an existing story with feedback
 */
export async function refineStory(
	problemId: string,
	storyId: string,
	payload: { feedback: string }
): Promise<StoryGenerationResponse> {
	const response = await apiFetch<{
		story_id?: string;
		story: Record<string, unknown>;
		review?: Record<string, unknown>;
		novelty?: Record<string, unknown>;
	}>(`/workspaces/${problemId}/contents/stories/${storyId}/refine`, {
		method: "POST",
		body: JSON.stringify({ review_feedback: payload.feedback }),
	});
	return {
		story: normalizeStoryFromApi(response, problemId),
	};
}

/**
 * Get all stories for a problem
 */
export async function getStories(problemId: string): Promise<StoryListResponse> {
	const response = await apiFetch<{
		stories: Array<Record<string, unknown>>;
		total: number;
	}>(`/workspaces/${problemId}/contents/stories`);
	return {
		stories: response.stories.map((story) => normalizeStoryFromApi({ story }, problemId)),
		total: response.total,
	};
}

/**
 * Get a specific story
 */
export async function getStory(problemId: string, storyId: string): Promise<Story> {
	const response = await apiFetch<Record<string, unknown>>(`/workspaces/${problemId}/contents/stories/${storyId}`);
	return normalizeStoryFromApi({ story: response }, problemId);
}

type StoryApiPayload = {
	story?: Record<string, unknown>;
	story_id?: string;
	review?: Record<string, unknown>;
	novelty?: Record<string, unknown>;
};

type NoveltyRiskLevel = "low" | "medium" | "high";

function normalizeStoryFromApi(payload: StoryApiPayload, problemId: string): Story {
	const rawStory = (payload.story || {}) as Record<string, unknown>;

	const getString = (value: unknown, fallback?: string) =>
		typeof value === "string" ? value : fallback ?? "";

	const normalizeInnovationClaims = (value: unknown) => {
		if (Array.isArray(value)) {
			return value.map((item) => String(item)).join(" • ");
		}
		return getString(value);
	};

	const toNumber = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) ? value : undefined;

	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

	const computeQuantile = (values: number[], quantile: number) => {
		if (values.length === 0) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const pos = (sorted.length - 1) * quantile;
		const base = Math.floor(pos);
		const rest = pos - base;
		if (sorted[base + 1] === undefined) {
			return sorted[base];
		}
		return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
	};

	const review = (payload.review || rawStory.review_result || rawStory.review_scores) as
		| Record<string, unknown>
		| undefined;
	const reviews = Array.isArray(review?.reviews) ? (review?.reviews as Array<Record<string, unknown>>) : [];
	const reviewScoresRaw = reviews
		.map((item) => toNumber(item?.score))
		.filter((score): score is number => score !== undefined);
	const avgScoreRaw =
		toNumber(review?.avg_score) ??
		toNumber(rawStory.avg_score) ??
		(reviewScoresRaw.length > 0 ? reviewScoresRaw.reduce((sum, value) => sum + value, 0) / reviewScoresRaw.length : 0);
	const avgScoreNormalized = clamp01((avgScoreRaw || 0) / 10);
	const normalizedScores = reviewScoresRaw.map((score) => clamp01(score / 10));
	const q25 = computeQuantile(normalizedScores, 0.25);
	const q50 = computeQuantile(normalizedScores, 0.5);
	const q75 = computeQuantile(normalizedScores, 0.75);
	const passed =
		typeof review?.pass === "boolean"
			? review.pass
			: typeof rawStory.passed_review === "boolean"
				? (rawStory.passed_review as boolean)
				: avgScoreRaw >= 6.5;

	const novelty = (payload.novelty || rawStory.novelty_result || rawStory.novelty_report) as
		| Record<string, unknown>
		| undefined;
	const noveltyCandidates = Array.isArray(novelty?.candidates)
		? (novelty?.candidates as Array<Record<string, unknown>>)
		: [];
	const maxSimilarity =
		toNumber(novelty?.max_similarity) ??
		toNumber(rawStory.max_similarity) ??
		toNumber(novelty?.similarity_score) ??
		0;
	const riskLevelRaw = (novelty?.risk_level || rawStory.risk_level || "") as string;
	const inferredRiskLevel: NoveltyRiskLevel =
		maxSimilarity >= 0.85 ? "high" : maxSimilarity >= 0.75 ? "medium" : "low";
	const riskLevel: NoveltyRiskLevel =
		riskLevelRaw === "low" || riskLevelRaw === "medium" || riskLevelRaw === "high"
			? (riskLevelRaw as NoveltyRiskLevel)
			: inferredRiskLevel;
	const isNovel =
		typeof novelty?.is_novel === "boolean"
			? (novelty.is_novel as boolean)
			: riskLevel === "low";
	const mostSimilar = noveltyCandidates.length > 0
		? {
			title: getString(noveltyCandidates[0]?.title),
			similarity: toNumber(noveltyCandidates[0]?.similarity) ?? 0,
		}
		: undefined;

	const sections = {
		title: getString(rawStory.title),
		abstract: getString(rawStory.abstract),
		problem_framing: getString(rawStory.problem_framing),
		gap_identification: getString(rawStory.gap_pattern),
		solution_approach: getString(rawStory.solution),
		method_skeleton: getString(rawStory.method_skeleton),
		innovation_claims: normalizeInnovationClaims(rawStory.innovation_claims),
		experiments_plan: getString(rawStory.experiments_plan),
	};

	return {
		id: getString(rawStory.id, payload.story_id || ""),
		problem_id: getString(rawStory.problem_id, problemId),
		user_idea: getString(rawStory.user_idea),
		pattern_id: typeof rawStory.pattern_id === "string" ? rawStory.pattern_id : undefined,
		sections,
		metadata: {
			pattern_name: typeof rawStory.pattern_name === "string" ? rawStory.pattern_name : undefined,
		},
		review_result: review
			? {
				passed,
				scores: {
					reviewer_1: normalizedScores[0],
					reviewer_2: normalizedScores[1],
					reviewer_3: normalizedScores[2],
					average: avgScoreNormalized,
					q25,
					q50,
					q75,
				},
				individual_reviews: reviews.map((item) => ({
					anchor_title: getString(item?.role || item?.reviewer || "Reviewer"),
					score: clamp01((toNumber(item?.score) ?? 0) / 10),
					justification: getString(item?.feedback),
				})),
				pass_criteria: getString(review?.pass_criteria, "avg_score >= 6.5"),
			}
			: undefined,
		novelty_result: novelty
			? {
				is_novel: isNovel,
				similarity_score: maxSimilarity,
				risk_level: riskLevel,
				most_similar: mostSimilar,
			}
			: undefined,
		parent_story_id: typeof rawStory.parent_story_id === "string" ? rawStory.parent_story_id : undefined,
		version: toNumber(rawStory.version) ?? 1,
		created_at: getString(rawStory.created_at, new Date().toISOString()),
		updated_at: getString(rawStory.updated_at, new Date().toISOString()),
	};
}

/**
 * Perform pattern-based exploration (explore with patterns from KG)
 */
export async function exploreWithPatterns(
	problemId: string,
	payload: PatternBasedExploreRequest
): Promise<{ proposals: Array<{ content: string; score: number; reasoning?: string }>; run_id: string }> {
	return apiFetch(`/canvas-ai/explore`, {
		method: "POST",
		body: JSON.stringify({
			context: payload.context || payload.query,
			use_patterns: payload.use_patterns,
			num_patterns: payload.num_patterns || 5,
			problem_id: problemId,
		}),
	});
}

/**
 * Perform idea fusion combining multiple ideas
 */
export async function fuseIdeas(
	problemId: string,
	payload: IdeaFusionRequest
): Promise<IdeaFusionResponse> {
	return apiFetch(`/workspaces/${problemId}/contents/fuse-ideas`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

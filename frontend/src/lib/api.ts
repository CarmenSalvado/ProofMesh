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
}

export interface LibraryItem {
	id: string;
	problem_id: string;
	title: string;
	kind: "resource" | "idea" | "content" | "lemma" | "claim" | "definition" | "theorem" | "counterexample" | "computation" | "note";
	content: string;
	formula: string | null;
	status: "proposed" | "verified" | "rejected";
	authors: Array<{ type: string; id: string; name?: string }>;
	source: { file_path?: string; cell_id?: string; agent_run_id?: string } | null;
	dependencies: string[];
	verification: { method: string; logs: string; status: string } | null;
	created_at: string;
	updated_at: string;
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
	extra_data?: Record<string, unknown> | null;
	created_at: string;
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

// ============ Notification Types ============

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

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
	if (typeof window === "undefined") return {};
	const token = localStorage.getItem("access_token");
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

function encodePath(path: string): string {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

// Generic fetch wrapper
async function apiFetch<T>(
	endpoint: string,
	options: RequestInit = {}
): Promise<T> {
	const url = `${API_BASE_URL}/api${endpoint}`;
	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...getAuthHeaders(),
		...options.headers,
	};

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ detail: "Unknown error" }));
		throw new Error(error.detail || `API Error: ${response.status}`);
	}

	if (response.status === 204) {
		return null as T;
	}

	return response.json();
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

export async function getProblem(problemId: string): Promise<Problem> {
	return apiFetch(`/problems/${problemId}`);
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

// ============ Library API ============

export async function getLibraryItems(
	problemId: string,
	params?: { kind?: LibraryItem["kind"]; status?: LibraryItem["status"] }
): Promise<{ items: LibraryItem[]; total: number }> {
	const searchParams = new URLSearchParams();
	if (params?.kind) searchParams.set("kind", params.kind);
	if (params?.status) searchParams.set("status", params.status);

	const query = searchParams.toString();
	return apiFetch(`/problems/${problemId}/library${query ? `?${query}` : ""}`);
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
		status: LibraryItem["status"];
		dependencies: string[];
		verification: { method: string; logs: string; status: string };
	}>
): Promise<LibraryItem> {
	return apiFetch(`/problems/${problemId}/library/${itemId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
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

export async function followUser(userId: string): Promise<{ status: string }> {
	return apiFetch(`/social/follow/${userId}`, { method: "POST" });
}

export async function unfollowUser(userId: string): Promise<{ status: string }> {
	return apiFetch(`/social/follow/${userId}`, { method: "DELETE" });
}

export async function getSocialFeed(params?: {
	scope?: "network" | "global";
	limit?: number;
}): Promise<SocialFeedResponse> {
	const searchParams = new URLSearchParams();
	if (params?.scope) searchParams.set("scope", params.scope);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
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
	const searchParams = new URLSearchParams();
	if (params?.target_type) searchParams.set("target_type", params.target_type);
	if (params?.limit) searchParams.set("limit", params.limit.toString());
	const query = searchParams.toString();
	return apiFetch(`/social/stars${query ? `?${query}` : ""}`);
}

export async function checkIsStarred(
	targetType: StarTargetType,
	targetId: string
): Promise<boolean> {
	try {
		const { stars } = await getStars({ target_type: targetType, limit: 100 });
		return stars.some((s) => s.target_type === targetType && s.target_id === targetId);
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


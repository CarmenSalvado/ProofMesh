"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getProblem, getLibraryItems, Problem, LibraryItem } from "@/lib/api";
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Settings, Home, ArrowLeft } from "lucide-react";
import clsx from "clsx";

interface ProblemSidebarProps {
	problemId: string;
}

type FolderNode = {
	name: string;
	path: string;
	folders: FolderNode[];
	files: Array<{ id: string; title: string; folder: string }>;
};

function buildTree(canvases: Array<{ id: string; title: string; folder: string }>): FolderNode {
	const root: FolderNode = { name: "root", path: "/", folders: [], files: [] };

	canvases.forEach(canvas => {
		const folderPath = canvas.folder || "/";
		const parts = folderPath.split("/").filter(p => p);

		let current = root;
		let currentPath = "";

		for (const part of parts) {
			currentPath += "/" + part;
			let folder = current.folders.find(f => f.name === part);
			if (!folder) {
				folder = { name: part, path: currentPath, folders: [], files: [] };
				current.folders.push(folder);
			}
			current = folder;
		}
		current.files.push(canvas);
	});

	return root;
}

function FolderItem({ node, problemId, level = 0, pathname }: { node: FolderNode, problemId: string, level?: number, pathname: string }) {
	const [isOpen, setIsOpen] = useState(true);

	return (
		<div>
			{/* Folder Header (Don't show for root) */}
			{level > 0 && (
				<div
					className="flex items-center gap-1 py-1 px-2 hover:bg-[var(--bg-hover)] cursor-pointer text-[var(--text-muted)] select-none transition-colors rounded-[4px]"
					style={{ paddingLeft: `${level * 12}px` }}
					onClick={() => setIsOpen(!isOpen)}
				>
					{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
					<Folder size={14} className="text-[var(--text-faint)]" />
					<span className="text-[12px] font-medium truncate">{node.name}</span>
				</div>
			)}

			{/* Content */}
			{isOpen && (
				<div className="flex flex-col">
					{/* Subfolders */}
					{node.folders.map(folder => (
						<FolderItem
							key={folder.path}
							node={folder}
							problemId={problemId}
							level={level > 0 ? level + 1 : level}
							pathname={pathname}
						/>
					))}

					{/* Files */}
					{node.files.map(file => {
						const isActive = pathname?.includes(file.id);
						return (
							<Link
								key={file.id}
								href={`/problems/${problemId}/canvas/${file.id}`}
								className={clsx(
									"flex items-center gap-2 py-1 px-2 text-[12px] rounded-[4px] transition-colors truncate mb-[1px]",
									isActive
										? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium"
										: "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
								)}
								style={{ paddingLeft: `${(level + (level > 0 ? 1 : 0)) * 12 + 8}px` }}
							>
								<FileText size={13} className={isActive ? "text-[var(--accent-primary)]" : "opacity-70"} />
								<span className="truncate">{file.title || "Untitled"}</span>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}

export function ProblemSidebar({ problemId }: ProblemSidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { user } = useAuth();
	const [problem, setProblem] = useState<Problem | null>(null);
	// Canvas functionality has been merged with library items
	// Keeping for UI compatibility
	const [canvases, setCanvases] = useState<Array<{ id: string; title: string; folder: string }>>([]);
	const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
	const [loading, setLoading] = useState(true);

	// Tree state
	const [fileTree, setFileTree] = useState<FolderNode>({ name: "root", path: "/", folders: [], files: [] });

	useEffect(() => {
		if (problemId) {
			loadData();
		}
	}, [problemId]);

	useEffect(() => {
		if (canvases.length > 0) {
			setFileTree(buildTree(canvases));
		} else {
			setFileTree({ name: "root", path: "/", folders: [], files: [] });
		}
	}, [canvases]);

	async function loadData() {
		try {
			const [problemData, libraryData] = await Promise.all([
				getProblem(problemId),
				getLibraryItems(problemId),
			]);
			setProblem(problemData);
			setLibraryItems(libraryData.items);
			// Canvases are now integrated with the library system
			setCanvases([{ id: "default", title: "Visual Canvas", folder: "/" }]);
		} catch (err) {
			console.error("Failed to load problem data:", err);
		} finally {
			setLoading(false);
		}
	}

	async function handleCreateCanvas() {
		// Canvas creation is now handled via the visual canvas interface
		router.push(`/problems/${problemId}/canvas`);
	}

	return (
		<aside className="w-[260px] bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] flex-col hidden md:flex h-full select-none">
			{/* Workspace Header */}
			<div className="h-12 flex items-center px-3 border-b border-[var(--border-primary)]">
				<Link href="/dashboard" className="flex items-center gap-2 hover:bg-[var(--bg-hover)] p-1.5 -ml-1.5 rounded-md transition-colors text-[var(--text-secondary)]">
					<ArrowLeft size={16} />
				</Link>
				<div className="ml-2 font-medium text-[13px] text-[var(--text-primary)] truncate">
					{problem?.title || "Problem Space"}
				</div>
			</div>

			<div className="flex-1 overflow-y-auto py-2">
				{/* Explorer Section */}
				<div className="mb-6">
					<div className="flex items-center justify-between px-4 mb-2">
						<span className="text-[10px] font-bold text-[var(--text-faint)] tracking-wider uppercase">
							EXPLORER
						</span>
						<button
							onClick={handleCreateCanvas}
							className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
							title="New Canvas"
						>
							<Plus size={14} />
						</button>
					</div>

					<div className="px-2">
						{loading ? (
							<div className="px-2 text-[12px] text-[var(--text-faint)]">Loading...</div>
						) : canvases.length === 0 ? (
							<div className="px-2 text-[12px] text-[var(--text-faint)] italic">No canvases yet</div>
						) : (
							<FolderItem node={fileTree} problemId={problemId} pathname={pathname || ""} level={0} />
						)}
					</div>
				</div>

				{/* Library / Objects */}
				{libraryItems.length > 0 && (
					<div className="mt-8">
						<div className="px-4 mb-2">
							<span className="text-[10px] font-bold text-[var(--text-faint)] tracking-wider uppercase">
								OUTLINE
							</span>
						</div>
						<div className="px-2 space-y-[1px]">
							{libraryItems.slice(0, 10).map(item => (
								<div key={item.id} className="flex items-center gap-2 px-2 py-1 text-[12px] text-[var(--text-muted)] rounded">
									<div className={`w-1.5 h-1.5 rounded-full ${item.kind === "LEMMA" ? "bg-emerald-500" :
										item.kind === "THEOREM" ? "bg-amber-500" : "bg-blue-500"
										}`} />
									<span className="truncate">{item.title}</span>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="h-10 border-t border-[var(--border-primary)] flex items-center px-4 justify-between text-[var(--text-muted)] bg-[var(--bg-secondary)]">
				<div className="flex items-center gap-2">
					<div className="w-2 h-2 rounded-full bg-[var(--success)]" />
					<span className="text-[10px]">ProofMesh Local</span>
				</div>
				<Link href="/settings">
					<Settings size={14} className="hover:text-[var(--text-primary)] cursor-pointer" />
				</Link>
			</div>
		</aside>
	);
}

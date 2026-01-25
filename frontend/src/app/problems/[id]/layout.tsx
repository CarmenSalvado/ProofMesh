import { ProblemSidebar } from "@/components/layout/ProblemSidebar";

export default async function ProblemLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<ProblemSidebar problemId={id} />
			<div className="flex-1 flex flex-col h-full overflow-hidden">
				{children}
			</div>
		</div>
	);
}

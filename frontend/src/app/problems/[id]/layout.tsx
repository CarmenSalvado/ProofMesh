export default function ProblemLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
			<div className="flex-1 flex flex-col h-full overflow-hidden">
				{children}
			</div>
		</div>
	);
}

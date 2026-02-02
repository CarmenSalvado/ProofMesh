"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CanvasDetailPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = params.id as string;
  const canvasId = params.canvasId as string;

  useEffect(() => {
    // Currently, there's only one canvas per problem
    // Redirect to the main canvas page
    // In the future, this could load a specific canvas view/state
    if (problemId) {
      router.replace(`/problems/${problemId}/canvas`);
    }
  }, [problemId, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-neutral-500 text-sm">Loading canvas...</div>
    </div>
  );
}

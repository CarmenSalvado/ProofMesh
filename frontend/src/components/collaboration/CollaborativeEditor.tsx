"use client";

import { forwardRef, useEffect, useRef, useCallback } from "react";
import { WorkspaceEditor, WorkspaceEditorHandle } from "@/components/workspace/WorkspaceEditor";
import { useOptionalCollaboration, CollaborativeCursors } from "@/components/collaboration";

interface CollaborativeEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  filePath?: string | null;
}

export interface CollaborativeEditorHandle extends WorkspaceEditorHandle {
  syncDocument: () => void;
}

export const CollaborativeEditor = forwardRef<CollaborativeEditorHandle, CollaborativeEditorProps>(
  function CollaborativeEditor(
    { initialMarkdown, onChange, readOnly = false, filePath },
    ref
  ) {
    const editorRef = useRef<WorkspaceEditorHandle | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const collaboration = useOptionalCollaboration();
    const lastSyncedRef = useRef<string>(initialMarkdown);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync document changes to collaborators with debounce
    const handleChange = useCallback((markdown: string) => {
      onChange(markdown);
      
      // Only sync if collaboration is active and content changed
      if (!collaboration?.isConnected || !filePath) return;
      if (markdown === lastSyncedRef.current) return;
      
      // Debounce sync to avoid flooding
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(() => {
        collaboration.sendDocumentSync(filePath, markdown);
        lastSyncedRef.current = markdown;
      }, 500);
    }, [onChange, collaboration, filePath]);

    // Track cursor movements
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!collaboration?.isConnected || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      collaboration.sendCursorMove(x, y, filePath || undefined);
    }, [collaboration, filePath]);

    // Update lastSynced when initial content changes
    useEffect(() => {
      lastSyncedRef.current = initialMarkdown;
    }, [initialMarkdown]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }, []);

    // Forward ref
    useEffect(() => {
      if (!ref) return;
      
      const handle: CollaborativeEditorHandle = {
        insertMarkdown: (markdown: string) => {
          editorRef.current?.insertMarkdown(markdown);
        },
        getMarkdown: () => {
          return editorRef.current?.getMarkdown() || "";
        },
        syncDocument: () => {
          if (collaboration?.isConnected && filePath && editorRef.current) {
            const content = editorRef.current.getMarkdown();
            collaboration.sendDocumentSync(filePath, content);
            lastSyncedRef.current = content;
          }
        },
      };
      
      if (typeof ref === "function") {
        ref(handle);
      } else {
        ref.current = handle;
      }
    }, [ref, collaboration, filePath]);

    return (
      <div 
        ref={containerRef} 
        className="relative"
        onMouseMove={handleMouseMove}
      >
        <WorkspaceEditor
          ref={editorRef}
          initialMarkdown={initialMarkdown}
          onChange={handleChange}
          readOnly={readOnly}
        />
        
        {/* Show other users' cursors */}
        <CollaborativeCursors
          containerRef={containerRef}
          currentFile={filePath || undefined}
        />
      </div>
    );
  }
);

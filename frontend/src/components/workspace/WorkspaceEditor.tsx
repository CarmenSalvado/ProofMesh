"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/utils";

interface WorkspaceEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}

export interface WorkspaceEditorHandle {
  insertMarkdown: (markdown: string) => void;
  getMarkdown: () => string;
}

export const WorkspaceEditor = forwardRef<WorkspaceEditorHandle, WorkspaceEditorProps>(
  function WorkspaceEditor(
    { initialMarkdown, onChange, readOnly = false },
    ref
  ) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const onChangeRef = useRef(onChange);
  const initialMarkdownRef = useRef(initialMarkdown);
  const lastKnownMarkdownRef = useRef(initialMarkdown);
  const readyRef = useRef(false);
  const pendingInsertsRef = useRef<string[]>([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown: (markdown: string) => {
        if (!crepeRef.current || !readyRef.current) {
          pendingInsertsRef.current.push(markdown);
          return;
        }
        const current = crepeRef.current.getMarkdown() || "";
        const next = `${current}${markdown}`;
        crepeRef.current.editor.action(replaceAll(next));
        lastKnownMarkdownRef.current = next;
        onChangeRef.current(next);
      },
      getMarkdown: () => {
        if (!crepeRef.current || !readyRef.current) {
          return initialMarkdownRef.current || "";
        }
        return crepeRef.current.getMarkdown() || "";
      },
    }),
    []
  );

  useEffect(() => {
    if (!rootRef.current || crepeRef.current) return;

    const root = rootRef.current;
    const crepe = new Crepe({
      root,
      defaultValue: initialMarkdownRef.current,
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        lastKnownMarkdownRef.current = markdown;
        onChangeRef.current(markdown);
      });
    });

    crepe.create().then(() => {
      readyRef.current = true;
      if (pendingInsertsRef.current.length > 0) {
        const current = crepe.getMarkdown() || "";
        const combined = `${current}${pendingInsertsRef.current.join("")}`;
        crepe.editor.action(replaceAll(combined));
        lastKnownMarkdownRef.current = combined;
        onChangeRef.current(combined);
        pendingInsertsRef.current = [];
      }
    });
    crepe.setReadonly(readOnly);
    crepeRef.current = crepe;

    return () => {
      crepe.destroy();
      crepeRef.current = null;
      readyRef.current = false;
      pendingInsertsRef.current = [];
      if (root) {
        root.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    initialMarkdownRef.current = initialMarkdown;
    if (!crepeRef.current || !readyRef.current) return;
    if (initialMarkdown === lastKnownMarkdownRef.current) return;
    crepeRef.current.editor.action(replaceAll(initialMarkdown));
    lastKnownMarkdownRef.current = initialMarkdown;
  }, [initialMarkdown]);

  useEffect(() => {
    if (!crepeRef.current) return;
    crepeRef.current.setReadonly(readOnly);
  }, [readOnly]);

  return <div ref={rootRef} className="workspace-editor" />;
  }
);

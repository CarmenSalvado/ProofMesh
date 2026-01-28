"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Play,
  Square,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCode,
  Terminal,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react";
import { verifyLeanCode, formalizeText } from "@/lib/api";

interface VerificationPanelProps {
  problemId: string;
  leanCode?: string;
  onCodeChange?: (code: string) => void;
  textToFormalize?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

interface VerificationResult {
  success: boolean;
  log: string;
  duration: number;
  timestamp: Date;
}

// Simple Lean syntax highlighting
function highlightLean(code: string): React.ReactNode[] {
  const lines = code.split("\n");
  return lines.map((line, idx) => (
    <div key={idx} className="table-row">
      <span className="table-cell pr-4 text-neutral-500 select-none text-right">
        {idx + 1}
      </span>
      <span className="table-cell">
        {highlightLine(line)}
      </span>
    </div>
  ));
}

function highlightLine(line: string): React.ReactNode {
  // Keywords
  const keywords = /\b(theorem|lemma|def|structure|inductive|class|instance|where|import|open|namespace|end|variable|#check|#eval|sorry|by|have|show|let|in|if|then|else|match|with|fun|return|do|for)\b/g;
  // Types
  const types = /\b(Prop|Type|Bool|Nat|Int|String|List|Option|True|False)\b/g;
  // Tactics
  const tactics = /\b(exact|apply|intro|intros|cases|induction|simp|rfl|rw|ring|norm_num|decide|trivial|assumption|constructor)\b/g;
  // Comments
  const comments = /(--.*$|\/\-[\s\S]*?\-\/)/g;
  // Strings
  const strings = /"[^"]*"/g;
  
  let result = line;
  const spans: { start: number; end: number; className: string; text: string }[] = [];
  
  // Find all matches
  let match;
  
  // Comments (highest priority)
  const commentRegex = /(--.*$)/g;
  while ((match = commentRegex.exec(line)) !== null) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      className: "text-neutral-500 italic",
      text: match[0],
    });
  }
  
  // Only process non-comment parts
  if (spans.length === 0) {
    // Keywords
    while ((match = keywords.exec(line)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        className: "text-purple-400",
        text: match[0],
      });
    }
    
    // Types
    while ((match = types.exec(line)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        className: "text-cyan-400",
        text: match[0],
      });
    }
    
    // Tactics
    while ((match = tactics.exec(line)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        className: "text-amber-400",
        text: match[0],
      });
    }
    
    // Strings
    while ((match = strings.exec(line)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        className: "text-green-400",
        text: match[0],
      });
    }
  }
  
  // Sort by position
  spans.sort((a, b) => a.start - b.start);
  
  // Build result
  if (spans.length === 0) {
    return <span className="text-neutral-300">{line}</span>;
  }
  
  const elements: React.ReactNode[] = [];
  let lastEnd = 0;
  
  spans.forEach((span, idx) => {
    if (span.start > lastEnd) {
      elements.push(
        <span key={`text-${idx}`} className="text-neutral-300">
          {line.slice(lastEnd, span.start)}
        </span>
      );
    }
    elements.push(
      <span key={`span-${idx}`} className={span.className}>
        {span.text}
      </span>
    );
    lastEnd = span.end;
  });
  
  if (lastEnd < line.length) {
    elements.push(
      <span key="text-end" className="text-neutral-300">
        {line.slice(lastEnd)}
      </span>
    );
  }
  
  return <>{elements}</>;
}

export function VerificationPanel({
  problemId,
  leanCode: initialCode,
  onCodeChange,
  textToFormalize,
  collapsed = false,
  onToggle,
}: VerificationPanelProps) {
  const [code, setCode] = useState(initialCode || "");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFormalizing, setIsFormalizing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [history, setHistory] = useState<VerificationResult[]>([]);
  const [showOutput, setShowOutput] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  const handleCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setCode(newCode);
      onCodeChange?.(newCode);
    },
    [onCodeChange]
  );

  const handleFormalize = useCallback(async () => {
    if (!textToFormalize || !problemId) return;

    setIsFormalizing(true);
    try {
      const response = await formalizeText({
        problem_id: problemId,
        text: textToFormalize,
      });
      setCode(response.lean_code);
      onCodeChange?.(response.lean_code);
    } catch (err) {
      console.error("Formalization error:", err);
    } finally {
      setIsFormalizing(false);
    }
  }, [textToFormalize, problemId, onCodeChange]);

  const handleVerify = useCallback(async () => {
    if (!code.trim() || !problemId) return;

    setIsVerifying(true);
    setResult(null);
    const startTime = Date.now();

    try {
      const response = await verifyLeanCode({
        problem_id: problemId,
        lean_code: code,
      });

      const newResult: VerificationResult = {
        success: response.success,
        log: response.log,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      setResult(newResult);
      setHistory((prev) => [newResult, ...prev].slice(0, 5));
    } catch (err) {
      const newResult: VerificationResult = {
        success: false,
        log: err instanceof Error ? err.message : "Verification failed",
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
      setResult(newResult);
    } finally {
      setIsVerifying(false);
    }
  }, [code, problemId]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleClear = useCallback(() => {
    setCode("");
    setResult(null);
    onCodeChange?.("");
  }, [onCodeChange]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-colors"
      >
        <FileCode className="w-4 h-4" />
        <span className="text-sm font-medium">Lean 4 Verifier</span>
      </button>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-3 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-neutral-300">
              Lean 4 Verification
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {textToFormalize && (
            <button
              onClick={handleFormalize}
              disabled={isFormalizing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isFormalizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Formalize
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClear}
            className="p-2 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-2 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Code Editor */}
      <div className="relative">
        <div className="absolute inset-0 overflow-auto p-4 font-mono text-sm pointer-events-none">
          <div className="table">
            {highlightLean(code || "-- Enter Lean 4 code here")}
          </div>
        </div>
        <textarea
          value={code}
          onChange={handleCodeChange}
          placeholder="-- Enter Lean 4 code here"
          spellCheck={false}
          className="w-full h-64 p-4 font-mono text-sm bg-transparent text-transparent caret-white resize-none focus:outline-none"
          style={{ lineHeight: "1.5" }}
        />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-neutral-800/50 border-t border-neutral-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleVerify}
            disabled={isVerifying || !code.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Verify
              </>
            )}
          </button>
          {result && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                result.success
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {result.success ? (
                <Check className="w-4 h-4" />
              ) : (
                <X className="w-4 h-4" />
              )}
              <span>{result.success ? "Passed" : "Failed"}</span>
              <span className="text-neutral-500">•</span>
              <Clock className="w-3.5 h-3.5" />
              <span>{result.duration}ms</span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowOutput(!showOutput)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-400 hover:text-neutral-300 text-sm"
        >
          <Terminal className="w-4 h-4" />
          Output
          {showOutput ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Output Panel */}
      {showOutput && (
        <div className="border-t border-neutral-700">
          <div className="max-h-48 overflow-auto">
            {result ? (
              <pre
                className={`p-4 text-xs font-mono whitespace-pre-wrap ${
                  result.success ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {result.log || (result.success ? "✓ All goals proved!" : "✗ Verification failed")}
              </pre>
            ) : (
              <div className="p-4 text-center text-neutral-500 text-sm">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Run verification to see output</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="px-4 py-2 bg-neutral-800/30 border-t border-neutral-700">
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2">
            Recent Runs
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.slice(1).map((run, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] shrink-0 ${
                  run.success
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {run.success ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                <span>{run.duration}ms</span>
                <span className="text-neutral-500">
                  {run.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

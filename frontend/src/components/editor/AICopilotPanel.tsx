"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  X,
  Sparkles,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileCode,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Zap,
  User,
} from "lucide-react";
import {
  getOrchestrationStatus,
  exploreContext,
  formalizeText,
  critiqueProposal,
  OrchestrationProposal,
} from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  proposals?: OrchestrationProposal[];
  leanCode?: string;
  thinking?: boolean;
}

interface AICopilotPanelProps {
  problemId: string;
  currentContent?: string;
  selectedText?: string;
  onInsertText?: (text: string) => void;
  onInsertFormula?: (formula: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

const QUICK_ACTIONS = [
  { id: "explain", label: "Explain", icon: Lightbulb, prompt: "Explain this concept in simple terms:" },
  { id: "formalize", label: "Formalize", icon: FileCode, prompt: "Formalize this into Lean 4 code:" },
  { id: "critique", label: "Critique", icon: AlertTriangle, prompt: "Critique and find potential issues:" },
  { id: "suggest", label: "Next Steps", icon: Zap, prompt: "Suggest what mathematical concepts to explore next:" },
];

export function AICopilotPanel({
  problemId,
  currentContent,
  selectedText,
  onInsertText,
  onInsertFormula,
  collapsed,
  onToggle,
}: AICopilotPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "I'm Rho, your mathematical assistant. I can help you explore proofs, formalize statements into Lean 4, and suggest improvements. Ask me anything or use the quick actions below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check AI availability
  useEffect(() => {
    getOrchestrationStatus()
      .then((status) => setIsAvailable(status.available))
      .catch(() => setIsAvailable(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((role: "user" | "assistant" | "system", content: string, extras?: Partial<Message>) => {
    const message: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
      ...extras,
    };
    setMessages((prev) => [...prev, message]);
    return message.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  }, []);

  const handleSend = useCallback(async (customPrompt?: string) => {
    const prompt = customPrompt || input.trim();
    if (!prompt || !problemId) return;

    // Add user message
    addMessage("user", prompt);
    setInput("");
    setIsLoading(true);

    // Add thinking message
    const thinkingId = addMessage("assistant", "Thinking...", { thinking: true });

    try {
      // Determine context
      const context = selectedText || currentContent || "";
      const fullPrompt = context
        ? `${prompt}\n\nContext:\n${context}`
        : prompt;

      // Call explore API
      const result = await exploreContext({
        problem_id: problemId,
        context: fullPrompt,
        max_iterations: 3,
      });

      if (result.proposals.length > 0) {
        const bestProposal = result.proposals[0];
        updateMessage(thinkingId, {
          content: bestProposal.content,
          thinking: false,
          proposals: result.proposals,
        });
      } else {
        updateMessage(thinkingId, {
          content: "I couldn't generate any proposals for that. Could you try rephrasing or providing more context?",
          thinking: false,
        });
      }
    } catch (err) {
      updateMessage(thinkingId, {
        content: `Error: ${err instanceof Error ? err.message : "Failed to process request"}`,
        thinking: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, problemId, selectedText, currentContent, addMessage, updateMessage]);

  const handleFormalize = useCallback(async (text: string) => {
    if (!problemId) return;

    const thinkingId = addMessage("assistant", "Formalizing into Lean 4...", { thinking: true });
    setIsLoading(true);

    try {
      const result = await formalizeText({
        problem_id: problemId,
        text,
      });

      updateMessage(thinkingId, {
        content: `Here's the Lean 4 formalization (${(result.confidence * 100).toFixed(0)}% confidence):`,
        thinking: false,
        leanCode: result.lean_code,
      });
    } catch (err) {
      updateMessage(thinkingId, {
        content: `Formalization failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        thinking: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [problemId, addMessage, updateMessage]);

  const handleQuickAction = useCallback((action: typeof QUICK_ACTIONS[0]) => {
    const context = selectedText || currentContent || "";
    if (!context) {
      addMessage("system", "Please select some text or add content to your document first.");
      return;
    }

    if (action.id === "formalize") {
      addMessage("user", `Formalize: "${context.slice(0, 100)}${context.length > 100 ? "..." : ""}"`);
      handleFormalize(context);
    } else {
      handleSend(`${action.prompt} "${context.slice(0, 200)}${context.length > 200 ? "..." : ""}"`);
    }
  }, [selectedText, currentContent, addMessage, handleSend, handleFormalize]);

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleInsertCode = useCallback((code: string) => {
    if (onInsertFormula) {
      onInsertFormula(code);
    }
  }, [onInsertFormula]);

  const handleClearHistory = useCallback(() => {
    setMessages([{
      id: "welcome",
      role: "system",
      content: "Chat history cleared. Rho is ready.",
      timestamp: new Date(),
    }]);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-4 bottom-4 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-colors z-50"
        title="Open Rho Copilot"
      >
        <Bot className="w-6 h-6" />
        {isLoading && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="w-96 bg-white border-l border-neutral-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">Rho Copilot</h3>
              <p className="text-xs text-neutral-500">
                {isAvailable ? "Ready to assist" : "Unavailable"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearHistory}
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggle}
              className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status */}
        {!isAvailable && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Configure GEMINI_API_KEY to enable Rho</span>
            </div>
          </div>
        )}

        {/* Selected Text Preview */}
        {selectedText && (
          <div className="mt-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-indigo-700 mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="font-medium">Selected Text</span>
            </div>
            <p className="text-xs text-indigo-600 line-clamp-2">
              {selectedText}
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading || !isAvailable}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                message.role === "user"
                  ? "bg-neutral-200"
                  : message.role === "system"
                  ? "bg-amber-100"
                  : "bg-indigo-100"
              }`}
            >
              {message.role === "user" ? (
                <User className="w-4 h-4 text-neutral-600" />
              ) : message.role === "system" ? (
                <Sparkles className="w-4 h-4 text-amber-600" />
              ) : (
                <Bot className="w-4 h-4 text-indigo-600" />
              )}
            </div>

            {/* Content */}
            <div
              className={`flex-1 min-w-0 ${
                message.role === "user" ? "text-right" : ""
              }`}
            >
              <div
                className={`inline-block max-w-full text-left rounded-2xl px-4 py-2.5 ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : message.role === "system"
                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                    : "bg-neutral-100 text-neutral-900"
                }`}
              >
                {message.thinking ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{message.content}</span>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}

                {/* Lean Code Block */}
                {message.leanCode && (
                  <div className="mt-3 relative group">
                    <div className="bg-neutral-900 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap">
                        {message.leanCode}
                      </pre>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(message.leanCode!, message.id)}
                        className="p-1.5 bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
                        title="Copy code"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleInsertCode(message.leanCode!)}
                        className="p-1.5 bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200"
                        title="Insert into editor"
                      >
                        <FileCode className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Alternative Proposals */}
                {message.proposals && message.proposals.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    <p className="text-xs text-neutral-500 mb-2">
                      {message.proposals.length - 1} alternative{message.proposals.length > 2 ? "s" : ""}:
                    </p>
                    <div className="space-y-2">
                      {message.proposals.slice(1, 3).map((proposal, idx) => (
                        <button
                          key={proposal.id}
                          onClick={() => onInsertText?.(proposal.content)}
                          className="w-full text-left p-2 bg-neutral-50 hover:bg-neutral-100 rounded-lg text-xs text-neutral-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-neutral-400">Option {idx + 2}</span>
                            <span className="text-neutral-400">
                              {(proposal.score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="line-clamp-2">{proposal.content}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 px-1">
                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-200 shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about proofs, formalization, or next steps..."
            rows={2}
            disabled={!isAvailable || isLoading}
            className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !isAvailable}
            className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-2 text-center">
          Shift + Enter for new line • Enter to send
        </p>
      </div>
    </div>
  );
}

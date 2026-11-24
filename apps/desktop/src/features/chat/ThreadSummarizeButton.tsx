"use client";

import { useState, useCallback } from "react";
import { Sparkle, X } from "@phosphor-icons/react";
import { useEchoApi } from "@/lib/api/echoApi";

interface ThreadSummarizeButtonProps {
  roomId: string;
  eventId: string;
}

export default function ThreadSummarizeButton({ roomId, eventId }: ThreadSummarizeButtonProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = useEchoApi();

  const handleSummarize = useCallback(async () => {
    if (loading || summary) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.summarizeThread(roomId, eventId);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao resumir");
    } finally {
      setLoading(false);
    }
  }, [api, roomId, eventId, loading, summary]);

  const dismiss = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  if (summary) {
    return (
      <div className="mt-2 w-full max-w-md rounded-lg border border-acc/30 bg-acc/5 px-3 py-2 text-xs text-txt/90">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkle size={14} className="text-acc shrink-0" />
            <span className="font-semibold text-acc">Resumo IA</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded p-0.5 text-mut hover:text-txt"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mt-1 leading-relaxed">{summary}</p>
      </div>
    );
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={dismiss}
        className="mt-1 flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-400 hover:bg-red-500/20"
      >
        <span>{error}</span>
        <X size={10} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Resumir thread com IA"
      disabled={loading}
      className="cursor-pointer flex items-center gap-1 rounded-full border border-bd bg-surf2 px-1.5 py-0.5 text-[11px] text-mut hover:border-acc/40 hover:text-acc active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleSummarize}
    >
      <Sparkle size={12} aria-hidden className={loading ? "animate-pulse" : ""} />
      <span>{loading ? "Resumindo…" : "Resumir"}</span>
    </button>
  );
}
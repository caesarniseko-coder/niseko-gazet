"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ModerationItem = {
  id: string;
  type: string;
  content: string;
  submitterEmail: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  reviewedAt: string | null;
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-sunset" },
  approved: { label: "Approved", color: "text-aurora" },
  rejected: { label: "Rejected", color: "text-red-400" },
  escalated: { label: "Escalated", color: "text-yellow-400" },
};

const RISK_COLORS: Record<string, string> = {
  minor_involved: "text-red-400 bg-red-400/10",
  allegation_or_crime_accusation: "text-red-400 bg-red-400/10",
  high_defamation_risk: "text-red-400 bg-red-400/10",
  medical_or_public_health_claim: "text-yellow-400 bg-yellow-400/10",
  identifiable_private_individual: "text-sunset bg-sunset/10",
  ongoing_investigation: "text-sunset bg-sunset/10",
  graphic_content: "text-sunset bg-sunset/10",
  sensitive_location: "text-powder bg-powder/10",
};

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [viewMode, setViewMode] = useState<"all" | "pipeline" | "tips">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch(`/api/moderation?status=${filterStatus}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAction = async (
    id: string,
    decision: "approved" | "rejected" | "escalated"
  ) => {
    setActionLoading(id);
    try {
      await fetch(`/api/moderation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      fetchItems();
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (viewMode === "pipeline") return item.type === "haystack_flagged";
    if (viewMode === "tips") return item.type !== "haystack_flagged";
    return true;
  });

  const pipelineCount = items.filter(
    (i) => i.type === "haystack_flagged"
  ).length;
  const tipCount = items.filter((i) => i.type !== "haystack_flagged").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-snow">
            Moderation Queue
          </h1>
          <p className="text-ice/40 text-sm mt-1">
            Review pipeline-flagged articles, tips, and submissions
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 p-1 glass-panel rounded-xl w-fit">
        {["pending", "approved", "rejected", "escalated"].map((status) => {
          const cfg = STATUS_STYLES[status];
          const isActive = filterStatus === status;

          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`
                relative px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${isActive ? "text-snow" : "text-ice/40 hover:text-ice/60"}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="moderationTab"
                  className="absolute inset-0 bg-white/10 rounded-lg"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Source filter */}
      <div className="flex gap-2 mb-6">
        {(
          [
            { key: "all", label: "All", count: items.length },
            { key: "pipeline", label: "Pipeline Flagged", count: pipelineCount },
            { key: "tips", label: "Tips & Submissions", count: tipCount },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-3 py-1 rounded text-xs transition-colors ${
              viewMode === key
                ? "bg-powder/15 text-powder border border-powder/30"
                : "text-ice/40 hover:text-ice/60"
            }`}
          >
            {label}
            {count > 0 && (
              <span className="ml-1.5 text-[10px] font-mono">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-5">
              <div className="shimmer h-4 w-1/3 rounded mb-3" />
              <div className="shimmer h-3 w-full rounded mb-2" />
              <div className="shimmer h-3 w-2/3 rounded" />
            </div>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center">
            <svg
              className="w-10 h-10 text-ice/20 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
            <p className="font-display text-lg text-ice/40">Queue is clear</p>
            <p className="text-ice/25 text-xs mt-1">
              No {filterStatus} items to review
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredItems.map((item, i) => (
              <ModerationCard
                key={item.id}
                item={item}
                index={i}
                isProcessing={actionLoading === item.id}
                onAction={handleAction}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function ModerationCard({
  item,
  index,
  isProcessing,
  onAction,
}: {
  item: ModerationItem;
  index: number;
  isProcessing: boolean;
  onAction: (
    id: string,
    decision: "approved" | "rejected" | "escalated"
  ) => void;
}) {
  const cfg = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
  const isPipeline = item.type === "haystack_flagged";
  const meta = item.metadata as Record<string, unknown> | null;

  const confidence = meta?.confidence_score as number | undefined;
  const riskFlags = (meta?.risk_flags as string[]) ?? [];
  const topics = (meta?.topics as string[]) ?? [];
  const geoTags = (meta?.geo_tags as string[]) ?? [];
  const enriched = meta?.enriched_data as Record<string, string> | undefined;
  const sourceUrl = meta?.source_url as string | undefined;

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ x: -100, opacity: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass-panel rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
              isPipeline
                ? "text-powder bg-powder/10"
                : "text-ice/40 bg-white/5"
            }`}
          >
            {isPipeline ? "Pipeline Flagged" : item.type.replace(/_/g, " ")}
          </span>
          <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
          {confidence !== undefined && (
            <span
              className={`text-[10px] font-mono ${
                confidence >= 60
                  ? "text-aurora"
                  : confidence >= 30
                    ? "text-ice/50"
                    : "text-sunset"
              }`}
            >
              {confidence}/100
            </span>
          )}
        </div>
        <span className="text-ice/25 text-[10px]">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      </div>

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {riskFlags.map((flag) => (
            <span
              key={flag}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                RISK_COLORS[flag] ?? "text-sunset bg-sunset/10"
              }`}
            >
              {flag.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="text-snow/80 text-sm leading-relaxed mb-3 whitespace-pre-line">
        {item.content}
      </div>

      {/* Enriched data (pipeline items only) */}
      {isPipeline && enriched && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-3 p-2.5 rounded bg-white/[0.02] border border-frost-border">
          {enriched.what && (
            <div className="col-span-2">
              <span className="text-ice/30">What:</span>{" "}
              <span className="text-snow/70">{enriched.what}</span>
            </div>
          )}
          {enriched.who && (
            <div>
              <span className="text-ice/30">Who:</span>{" "}
              <span className="text-snow/70">{enriched.who}</span>
            </div>
          )}
          {enriched.where_location && (
            <div>
              <span className="text-ice/30">Where:</span>{" "}
              <span className="text-snow/70">{enriched.where_location}</span>
            </div>
          )}
          {enriched.when_occurred && (
            <div>
              <span className="text-ice/30">When:</span>{" "}
              <span className="text-snow/70">{enriched.when_occurred}</span>
            </div>
          )}
          {enriched.why && (
            <div>
              <span className="text-ice/30">Why:</span>{" "}
              <span className="text-snow/70">{enriched.why}</span>
            </div>
          )}
        </div>
      )}

      {/* Topics & geo tags */}
      {(topics.length > 0 || geoTags.length > 0) && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {topics.map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.5 rounded bg-powder/10 text-powder/60"
            >
              {t}
            </span>
          ))}
          {geoTags.map((g) => (
            <span
              key={g}
              className="text-[10px] px-1.5 py-0.5 rounded bg-aurora/10 text-aurora/60"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Source link */}
      {sourceUrl && (
        <p className="text-ice/30 text-[11px] mb-3 truncate">
          Source:{" "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-powder/50 hover:text-powder/70 underline"
          >
            {sourceUrl}
          </a>
        </p>
      )}

      {item.submitterEmail && (
        <p className="text-ice/30 text-[11px] mb-3">
          Contact: {item.submitterEmail}
        </p>
      )}

      {/* Action buttons (only for pending) */}
      {item.status === "pending" && (
        <div className="flex gap-2 pt-3 border-t border-frost-border">
          <button
            onClick={() => onAction(item.id, "approved")}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-aurora/15 text-aurora text-xs font-medium hover:bg-aurora/25 transition-colors disabled:opacity-40"
          >
            {isPipeline ? "Approve & Create Field Note" : "Approve"}
          </button>
          <button
            onClick={() => onAction(item.id, "rejected")}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 text-xs font-medium hover:bg-red-400/20 transition-colors disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={() => onAction(item.id, "escalated")}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 text-xs font-medium hover:bg-yellow-400/20 transition-colors disabled:opacity-40"
          >
            Escalate
          </button>
        </div>
      )}
    </motion.div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ModerationItem = {
  id: string;
  type: string;
  content: string;
  submitterEmail: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-sunset" },
  approved: { label: "Approved", color: "text-aurora" },
  rejected: { label: "Rejected", color: "text-red-400" },
  escalated: { label: "Escalated", color: "text-yellow-400" },
};

export default function ModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-snow">
            Moderation Queue
          </h1>
          <p className="text-ice/40 text-sm mt-1">
            Review anonymous tips and user submissions
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 p-1 glass-panel rounded-xl w-fit">
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
        ) : items.length === 0 ? (
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
            <p className="font-display text-lg text-ice/40">
              Queue is clear
            </p>
            <p className="text-ice/25 text-xs mt-1">
              No {filterStatus} items to review
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {items.map((item, i) => {
              const cfg = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
              const isProcessing = actionLoading === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ x: -100, opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-panel rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-ice/40 bg-white/5 px-2 py-0.5 rounded">
                        {item.type.replace(/_/g, " ")}
                      </span>
                      <span className={`text-[10px] ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <span className="text-ice/25 text-[10px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-snow/80 text-sm leading-relaxed mb-4">
                    {item.content}
                  </p>

                  {item.submitterEmail && (
                    <p className="text-ice/30 text-[11px] mb-4">
                      Contact: {item.submitterEmail}
                    </p>
                  )}

                  {/* Action buttons (only for pending) */}
                  {item.status === "pending" && (
                    <div className="flex gap-2 pt-2 border-t border-frost-border">
                      <button
                        onClick={() => handleAction(item.id, "approved")}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg bg-aurora/15 text-aurora text-xs font-medium hover:bg-aurora/25 transition-colors disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "rejected")}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg bg-red-400/10 text-red-400 text-xs font-medium hover:bg-red-400/20 transition-colors disabled:opacity-40"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "escalated")}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg bg-yellow-400/10 text-yellow-400 text-xs font-medium hover:bg-yellow-400/20 transition-colors disabled:opacity-40"
                      >
                        Escalate
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

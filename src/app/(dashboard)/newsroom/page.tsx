"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

type Story = {
  id: string;
  headline: string;
  status: string;
  topicTags: string[];
  authorId: string;
  createdAt: string;
  publishedAt: string | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-ice/60", bg: "bg-ice/10" },
  in_review: { label: "In Review", color: "text-sunset", bg: "bg-sunset/10" },
  approved: { label: "Approved", color: "text-aurora", bg: "bg-aurora/10" },
  published: { label: "Published", color: "text-powder", bg: "bg-powder/10" },
  corrected: {
    label: "Corrected",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  retracted: { label: "Retracted", color: "text-red-400", bg: "bg-red-400/10" },
};

export default function NewsroomPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        setStories(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered =
    filterStatus === "all"
      ? stories
      : stories.filter((s) => s.status === filterStatus);

  const statusCounts = stories.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-snow">
            Newsroom
          </h1>
          <p className="text-ice/40 text-sm mt-1">
            {stories.length} stories in pipeline
          </p>
        </div>
        <Link
          href="/field-notes/new"
          className="px-4 py-2 rounded-lg bg-powder text-navy text-sm font-semibold hover:bg-powder/90 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Field Note
        </Link>
      </div>

      {/* Status overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {Object.entries(STATUS_CONFIG).map(([key, config], i) => (
          <motion.button
            key={key}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() =>
              setFilterStatus(filterStatus === key ? "all" : key)
            }
            className={`
              glass-panel rounded-xl px-4 py-3 text-left transition-all
              ${filterStatus === key ? "border-powder/40 ring-1 ring-powder/20" : "hover:border-frost-border"}
            `}
          >
            <p className={`text-2xl font-bold ${config.color}`}>
              {statusCounts[key] || 0}
            </p>
            <p className="text-ice/40 text-[11px] uppercase tracking-wider mt-1">
              {config.label}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Story list */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-4">
              <div className="shimmer h-5 w-2/3 rounded mb-2" />
              <div className="shimmer h-3 w-1/4 rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center">
            <p className="text-ice/40 font-display text-lg">
              {stories.length === 0
                ? "No stories yet. Start by creating a field note."
                : "No stories match this filter."}
            </p>
          </div>
        ) : (
          filtered.map((story, i) => {
            const cfg = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.draft;
            return (
              <motion.div
                key={story.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="glass-panel rounded-xl p-4 flex items-center justify-between group hover:border-powder/20 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-snow text-sm font-medium truncate group-hover:text-powder transition-colors">
                    {story.headline}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}
                    >
                      {cfg.label}
                    </span>
                    {story.topicTags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-ice/30 text-[10px] uppercase tracking-wider"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-ice/20 text-[10px]">
                      {new Date(story.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <svg
                  className="w-4 h-4 text-ice/20 group-hover:text-ice/50 transition-colors flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

type Story = {
  id: string;
  headline: string;
  summary: string;
  status: string;
  topicTags: string[];
  geoTags: string[];
  isGated: boolean;
  authorId: string;
  createdAt: string;
  publishedAt: string | null;
};

type Version = {
  id: string;
  versionNumber: number;
  versionHash: string;
  contentBlocks: { type: string; content: string }[];
  sourceLog: { source: string; verified: boolean; notes: string }[];
  riskFlags: { type: string; description: string; severity: string }[];
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-ice/60", bg: "bg-ice/10" },
  in_review: { label: "In Review", color: "text-sunset", bg: "bg-sunset/10" },
  approved: { label: "Approved", color: "text-aurora", bg: "bg-aurora/10" },
  published: { label: "Published", color: "text-powder", bg: "bg-powder/10" },
  corrected: { label: "Corrected", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  retracted: { label: "Retracted", color: "text-red-400", bg: "bg-red-400/10" },
};

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/stories/${id}`).then((r) => r.json()),
      fetch(`/api/stories/${id}/versions`).then((r) => r.json()),
    ])
      .then(([s, v]) => {
        setStory(s.error ? null : s);
        setVersions(Array.isArray(v) ? v : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-8 w-2/3 rounded-lg" />
        <div className="shimmer h-4 w-1/3 rounded" />
        <div className="shimmer h-32 w-full rounded-xl mt-6" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="glass-panel rounded-xl p-12 text-center">
        <p className="font-display text-lg text-ice/40">Story not found</p>
        <Link href="/newsroom" className="text-powder text-sm mt-2 inline-block hover:underline">
          Back to Newsroom
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.draft;
  const latestVersion = versions[0];

  return (
    <div>
      {/* Back + Header */}
      <button
        onClick={() => router.push("/newsroom")}
        className="text-ice/40 text-xs hover:text-ice/70 transition-colors flex items-center gap-1 mb-4"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Newsroom
      </button>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-snow leading-tight">
              {story.headline}
            </h1>
            <p className="text-ice/50 text-sm mt-2 leading-relaxed">{story.summary}</p>
          </div>
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full flex-shrink-0 ${cfg.color} ${cfg.bg}`}>
            {cfg.label}
          </span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 mb-6">
          {story.topicTags.map((tag) => (
            <span key={tag} className="text-[10px] uppercase tracking-wider text-powder/70 bg-powder/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
          {story.geoTags.map((tag) => (
            <span key={tag} className="text-[10px] uppercase tracking-wider text-aurora/70 bg-aurora/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
          {story.isGated && (
            <span className="text-[10px] uppercase tracking-wider text-sunset/70 bg-sunset/10 px-2 py-0.5 rounded-full">
              Gated
            </span>
          )}
          <span className="text-ice/25 text-[10px] flex items-center gap-1">
            {new Date(story.createdAt).toLocaleString()}
          </span>
          {story.publishedAt && (
            <span className="text-aurora/40 text-[10px] flex items-center gap-1">
              Published {new Date(story.publishedAt).toLocaleString()}
            </span>
          )}
        </div>
      </motion.div>

      {/* Latest version content */}
      {latestVersion && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-snow uppercase tracking-wider">
              Content
            </h2>
            <span className="text-ice/30 text-[10px] font-mono">
              v{latestVersion.versionNumber} &middot; {latestVersion.versionHash.substring(0, 12)}...
            </span>
          </div>

          <div className="space-y-4">
            {latestVersion.contentBlocks.map((block, i) => (
              <div key={i}>
                {block.type === "text" ? (
                  <p className="text-ice/70 text-sm leading-relaxed">{block.content}</p>
                ) : (
                  <div className="bg-white/5 rounded-lg p-3">
                    <span className="text-aurora text-[9px] uppercase tracking-wider">{block.type}</span>
                    <p className="text-ice/60 text-xs mt-1">{block.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sources */}
      {latestVersion && latestVersion.sourceLog.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="glass-panel rounded-xl p-6 mb-6"
        >
          <h2 className="text-sm font-semibold text-snow uppercase tracking-wider mb-3">
            Sources
          </h2>
          <div className="space-y-2">
            {latestVersion.sourceLog.map((src, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${src.verified ? "bg-aurora" : "bg-ice/20"}`} />
                <div className="min-w-0">
                  <p className="text-snow/80 text-xs font-medium">{src.source}</p>
                  {src.notes && <p className="text-ice/30 text-[10px]">{src.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Risk flags */}
      {latestVersion && latestVersion.riskFlags.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-xl p-6 border-sunset/20"
        >
          <h2 className="text-sm font-semibold text-sunset uppercase tracking-wider mb-3">
            Risk Flags
          </h2>
          <div className="space-y-2">
            {latestVersion.riskFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5">
                <svg className="w-4 h-4 text-sunset flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-snow/80 text-xs font-medium">
                    {flag.type.replace(/_/g, " ")}
                    <span className={`ml-2 text-[9px] uppercase tracking-wider ${
                      flag.severity === "high" ? "text-red-400" : flag.severity === "medium" ? "text-sunset" : "text-ice/40"
                    }`}>
                      {flag.severity}
                    </span>
                  </p>
                  <p className="text-ice/40 text-[10px]">{flag.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Version history */}
      {versions.length > 1 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="glass-panel rounded-xl p-6 mt-6"
        >
          <h2 className="text-sm font-semibold text-snow uppercase tracking-wider mb-3">
            Version History
          </h2>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-frost-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-powder text-xs font-mono">v{v.versionNumber}</span>
                  <span className="text-ice/30 text-[10px] font-mono">{v.versionHash.substring(0, 16)}</span>
                </div>
                <span className="text-ice/25 text-[10px]">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

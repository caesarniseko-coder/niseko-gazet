"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

type PipelineRun = {
  id: string;
  runType: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  stats: Record<string, number>;
  errors: Array<{ error?: string; source_name?: string }>;
  sourcesPolled: string[] | number;
};

type PipelineStats = {
  activeSources: number;
  totalCrawled: number;
  totalFieldNotes: number;
  recentRuns: number;
  totalArticlesProcessed: number;
  totalFieldNotesCreated: number;
};

type TopicTrend = {
  topic: string;
  count: number;
  sourceCount: number;
  trend: "hot" | "rising" | "steady";
};

type SourceStat = {
  id: string;
  name: string;
  sourceType: string;
  reliabilityTier: string;
  reliabilityScore: number;
  recentCrawled: number;
  recentRelevant: number;
  recentPublished: number;
  consecutiveErrors: number;
};

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  completed: { color: "text-aurora", bg: "bg-aurora/10" },
  running: { color: "text-powder", bg: "bg-powder/10" },
  failed: { color: "text-sunset", bg: "bg-sunset/10" },
};

const TREND_STYLES: Record<string, { label: string; color: string }> = {
  hot: { label: "HOT", color: "text-sunset bg-sunset/10" },
  rising: { label: "RISING", color: "text-aurora bg-aurora/10" },
  steady: { label: "STEADY", color: "text-ice/40 bg-ice/5" },
};

const CYCLE_OPTIONS = [
  { value: "main", label: "Main (RSS + Scrape)" },
  { value: "weather", label: "Weather & Snow" },
  { value: "deep_scrape", label: "Deep Scrape" },
  { value: "tips", label: "Tip Ingestion" },
];

export default function PipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [trends, setTrends] = useState<TopicTrend[]>([]);
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"runs" | "trends" | "sources">(
    "runs"
  );
  const [triggering, setTriggering] = useState(false);
  const [triggerCycle, setTriggerCycle] = useState("main");
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const refreshData = () => {
    Promise.all([
      fetch("/api/haystack/runs?limit=30").then((r) => r.json()),
      fetch("/api/haystack/stats").then((r) => r.json()),
      fetch("/api/haystack/analytics?type=trends").then((r) => r.json()),
      fetch("/api/haystack/analytics?type=sources").then((r) => r.json()),
    ])
      .then(([runsData, statsData, trendsData, sourcesData]) => {
        setRuns(Array.isArray(runsData) ? runsData : []);
        setStats(statsData);
        setTrends(Array.isArray(trendsData) ? trendsData : []);
        setSourceStats(Array.isArray(sourcesData) ? sourcesData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/haystack/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle: triggerCycle }),
      });
      const data = await res.json();
      if (res.ok) {
        const created = data.stats?.field_notes_created ?? 0;
        const collected = data.stats?.raw_count ?? 0;
        setTriggerResult(`Collected ${collected} articles, created ${created} field notes`);
        refreshData();
      } else {
        setTriggerResult(`Error: ${data.error}`);
      }
    } catch {
      setTriggerResult("Failed to reach Haystack service");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-snow">Pipeline Monitor</h1>
          <p className="text-ice/50 text-sm mt-1">
            Haystack automated news gathering &amp; analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={triggerCycle}
            onChange={(e) => setTriggerCycle(e.target.value)}
            disabled={triggering}
            className="bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-xs text-ice/70 focus:outline-none focus:border-powder/40"
          >
            {CYCLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              triggering
                ? "bg-ice/10 text-ice/30 cursor-wait"
                : "bg-aurora/20 text-aurora hover:bg-aurora/30 border border-aurora/30"
            }`}
          >
            {triggering ? "Running..." : "Trigger"}
          </button>
        </div>
      </div>

      {triggerResult && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs px-3 py-2 rounded ${
            triggerResult.startsWith("Error") || triggerResult.startsWith("Failed")
              ? "bg-sunset/10 text-sunset/80"
              : "bg-aurora/10 text-aurora/80"
          }`}
        >
          {triggerResult}
        </motion.div>
      )}

      {loading ? (
        <div className="text-ice/40 text-sm py-12 text-center">Loading...</div>
      ) : (
        <>
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Active Sources" value={stats.activeSources} />
              <StatCard label="Articles Crawled" value={stats.totalCrawled} />
              <StatCard
                label="Field Notes"
                value={stats.totalFieldNotes}
                accent
              />
              <StatCard label="Recent Runs" value={stats.recentRuns} />
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-frost-border">
            {(["runs", "trends", "sources"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-medium transition-colors ${
                  activeTab === tab
                    ? "text-powder border-b-2 border-powder"
                    : "text-ice/40 hover:text-ice/60"
                }`}
              >
                {tab === "runs"
                  ? "Run History"
                  : tab === "trends"
                    ? "Topic Trends"
                    : "Source Performance"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "runs" && <RunHistory runs={runs} />}
          {activeTab === "trends" && <TopicTrends trends={trends} />}
          {activeTab === "sources" && (
            <SourcePerformance sources={sourceStats} />
          )}
        </>
      )}
    </motion.div>
  );
}

// ── Run History Tab ─────────────────────────────────

function RunHistory({ runs }: { runs: PipelineRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-ice/40">
        No pipeline runs yet. Use the Trigger button above to start a collection cycle.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run, i) => {
        const s = run.stats ?? {};
        const style = STATUS_STYLES[run.status] ?? STATUS_STYLES.completed;
        const duration = run.completedAt
          ? formatDuration(run.startedAt, run.completedAt)
          : "Running...";

        return (
          <motion.div
            key={run.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className="glass-panel p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}
                >
                  {run.status}
                </span>
                <span className="text-ice/40 text-[10px] uppercase tracking-wider">
                  {run.runType}
                </span>
                <span className="text-ice/30 text-xs font-mono">
                  {run.id.slice(0, 8)}
                </span>
              </div>
              <div className="text-ice/40 text-xs">
                {formatTime(run.startedAt)} · {duration}
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-[11px]">
              <PipelineStat label="Collected" value={s.raw_count} />
              <PipelineStat label="Classified" value={s.classified_count} />
              <PipelineStat label="Enriched" value={s.enriched_count} />
              <PipelineStat
                label="Approved"
                value={s.approved_count}
                color="text-aurora"
              />
              <PipelineStat
                label="Flagged"
                value={s.flagged_count}
                color="text-sunset"
              />
              <PipelineStat
                label="Created"
                value={s.field_notes_created}
                color="text-powder"
              />
              <PipelineStat
                label="Breaking"
                value={s.breaking_count}
                color="text-sunset"
              />
            </div>

            {/* Errors */}
            {run.errors && run.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t border-frost-border">
                {run.errors.slice(0, 2).map((err, j) => (
                  <p key={j} className="text-sunset/60 text-[10px] truncate">
                    {err.source_name ?? "Error"}:{" "}
                    {err.error?.slice(0, 80) ?? "Unknown"}
                  </p>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Topic Trends Tab ────────────────────────────────

function TopicTrends({ trends }: { trends: TopicTrend[] }) {
  if (trends.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-ice/40">
        Not enough data for trend analysis yet. Run a few pipeline cycles first.
      </div>
    );
  }

  const maxCount = Math.max(...trends.map((t) => t.count));

  return (
    <div className="space-y-2">
      {trends.map((trend, i) => {
        const style = TREND_STYLES[trend.trend] ?? TREND_STYLES.steady;
        const barWidth = (trend.count / maxCount) * 100;

        return (
          <motion.div
            key={trend.topic}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="glass-panel p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-snow text-sm font-medium">
                  {trend.topic.replace(/_/g, " ")}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${style.color}`}
                >
                  {style.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-ice/40">
                <span>
                  {trend.count} article{trend.count !== 1 ? "s" : ""}
                </span>
                <span>
                  {trend.sourceCount} source{trend.sourceCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            {/* Trend bar */}
            <div className="h-1 bg-ice/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ delay: i * 0.05 + 0.2, duration: 0.5 }}
                className={`h-full rounded-full ${
                  trend.trend === "hot"
                    ? "bg-sunset/60"
                    : trend.trend === "rising"
                      ? "bg-aurora/60"
                      : "bg-ice/20"
                }`}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Source Performance Tab ───────────────────────────

function SourcePerformance({ sources }: { sources: SourceStat[] }) {
  if (sources.length === 0) {
    return (
      <div className="glass-panel p-8 text-center text-ice/40">
        No source performance data available.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source, i) => {
        const acceptance =
          source.recentRelevant > 0
            ? Math.round(
                (source.recentPublished / source.recentRelevant) * 100
              )
            : 0;

        return (
          <motion.div
            key={source.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="glass-panel p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-snow text-sm font-medium">
                  {source.name}
                </span>
                <span className="text-ice/30 text-[10px] uppercase tracking-wider font-mono">
                  {source.sourceType}
                </span>
                <span className="text-ice/20 text-[10px] uppercase tracking-wider">
                  {source.reliabilityTier}
                </span>
              </div>
              {source.consecutiveErrors > 0 && (
                <span className="text-sunset text-[10px]">
                  {source.consecutiveErrors} error
                  {source.consecutiveErrors > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-6 text-[11px]">
              <span className="text-ice/40">
                Crawled{" "}
                <span className="font-mono text-ice/60">
                  {source.recentCrawled}
                </span>
              </span>
              <span className="text-ice/40">
                Relevant{" "}
                <span className="font-mono text-aurora/70">
                  {source.recentRelevant}
                </span>
              </span>
              <span className="text-ice/40">
                Published{" "}
                <span className="font-mono text-powder">
                  {source.recentPublished}
                </span>
              </span>
              <span className="text-ice/40">
                Acceptance{" "}
                <span
                  className={`font-mono ${acceptance >= 50 ? "text-aurora" : acceptance >= 20 ? "text-ice/60" : "text-sunset/70"}`}
                >
                  {acceptance}%
                </span>
              </span>
              <span className="text-ice/40">
                Score{" "}
                <span className="font-mono text-powder">
                  {source.reliabilityScore?.toFixed(0) ?? "—"}
                </span>
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Shared Components ───────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="glass-panel p-4">
      <p className="text-ice/40 text-[10px] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-display font-bold ${accent ? "text-aurora" : "text-snow"}`}
      >
        {value}
      </p>
    </div>
  );
}

function PipelineStat({
  label,
  value,
  color = "text-ice/50",
}: {
  label: string;
  value?: number;
  color?: string;
}) {
  if (value === undefined || value === null) return null;
  return (
    <span className="text-ice/40">
      {label} <span className={`font-mono ${color}`}>{value}</span>
    </span>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

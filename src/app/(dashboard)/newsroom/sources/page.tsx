"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type SourceFeed = {
  id: string;
  name: string;
  sourceType: string;
  url: string;
  isActive: boolean;
  reliabilityTier: string;
  pollIntervalMinutes: number;
  defaultTopics: string[];
  defaultGeoTags: string[];
  lastFetchedAt: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  createdAt: string;
};

const TIER_STYLES: Record<string, { label: string; color: string }> = {
  official: { label: "Official", color: "text-aurora bg-aurora/10 border-aurora/20" },
  standard: { label: "Standard", color: "text-powder bg-powder/10 border-powder/20" },
  yellow_press: { label: "Yellow Press", color: "text-sunset bg-sunset/10 border-sunset/20" },
};

const TYPE_STYLES: Record<string, string> = {
  rss: "text-aurora",
  scrape: "text-powder",
  api: "text-ice",
  social: "text-sunset",
  tip: "text-snow",
};

const EMPTY_FORM = {
  name: "",
  sourceType: "rss",
  url: "",
  reliabilityTier: "standard",
  pollIntervalMinutes: 15,
  defaultTopics: "",
  defaultGeoTags: "",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/haystack/sources")
      .then((r) => r.json())
      .then((data) => {
        setSources(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleActive = async (source: SourceFeed) => {
    const res = await fetch("/api/haystack/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id, is_active: !source.isActive }),
    });
    if (res.ok) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, isActive: !s.isActive } : s
        )
      );
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    const res = await fetch("/api/haystack/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        sourceType: form.sourceType,
        url: form.url,
        reliabilityTier: form.reliabilityTier,
        pollIntervalMinutes: form.pollIntervalMinutes,
        defaultTopics: form.defaultTopics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        defaultGeoTags: form.defaultGeoTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setSources((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/haystack/sources?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSources((prev) => prev.filter((s) => s.id !== id));
    }
    setDeleting(null);
  };

  const activeCount = sources.filter((s) => s.isActive).length;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-snow">Source Feeds</h1>
          <p className="text-ice/50 text-sm mt-1">
            {activeCount} active source{activeCount !== 1 ? "s" : ""} of{" "}
            {sources.length} configured
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            showForm
              ? "bg-ice/10 text-ice/50"
              : "bg-aurora/20 text-aurora hover:bg-aurora/30 border border-aurora/30"
          }`}
        >
          {showForm ? "Cancel" : "+ Add Source"}
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass-panel p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. NHK Hokkaido"
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-snow placeholder:text-ice/20 focus:outline-none focus:border-powder/40"
                  />
                </div>
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    URL
                  </label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-snow placeholder:text-ice/20 focus:outline-none focus:border-powder/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Type
                  </label>
                  <select
                    value={form.sourceType}
                    onChange={(e) =>
                      setForm({ ...form, sourceType: e.target.value })
                    }
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-ice/70 focus:outline-none focus:border-powder/40"
                  >
                    <option value="rss">RSS</option>
                    <option value="scrape">Scrape</option>
                    <option value="api">API</option>
                    <option value="social">Social</option>
                  </select>
                </div>
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Tier
                  </label>
                  <select
                    value={form.reliabilityTier}
                    onChange={(e) =>
                      setForm({ ...form, reliabilityTier: e.target.value })
                    }
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-ice/70 focus:outline-none focus:border-powder/40"
                  >
                    <option value="official">Official</option>
                    <option value="standard">Standard</option>
                    <option value="yellow_press">Yellow Press</option>
                  </select>
                </div>
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Poll (min)
                  </label>
                  <input
                    type="number"
                    value={form.pollIntervalMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pollIntervalMinutes: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-snow focus:outline-none focus:border-powder/40"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCreate}
                    disabled={saving || !form.name || !form.url}
                    className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      saving || !form.name || !form.url
                        ? "bg-ice/10 text-ice/30 cursor-not-allowed"
                        : "bg-aurora/20 text-aurora hover:bg-aurora/30 border border-aurora/30"
                    }`}
                  >
                    {saving ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Topics (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.defaultTopics}
                    onChange={(e) =>
                      setForm({ ...form, defaultTopics: e.target.value })
                    }
                    placeholder="tourism, safety, local_news"
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-snow placeholder:text-ice/20 focus:outline-none focus:border-powder/40"
                  />
                </div>
                <div>
                  <label className="text-ice/40 text-[10px] uppercase tracking-wider block mb-1">
                    Geo Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={form.defaultGeoTags}
                    onChange={(e) =>
                      setForm({ ...form, defaultGeoTags: e.target.value })
                    }
                    placeholder="niseko, kutchan, hirafu"
                    className="w-full bg-navy-deep border border-frost-border rounded px-2 py-1.5 text-sm text-snow placeholder:text-ice/20 focus:outline-none focus:border-powder/40"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-ice/40 text-sm py-12 text-center">
          Loading sources...
        </div>
      ) : sources.length === 0 ? (
        <div className="glass-panel p-8 text-center text-ice/40">
          No source feeds configured yet. Click &quot;+ Add Source&quot; to get
          started.
        </div>
      ) : (
        <div className="grid gap-3">
          {sources.map((source, i) => {
            const tier =
              TIER_STYLES[source.reliabilityTier] ?? TIER_STYLES.standard;
            const typeColor = TYPE_STYLES[source.sourceType] ?? "text-ice";
            const timeSince = source.lastFetchedAt
              ? formatTimeSince(source.lastFetchedAt)
              : "Never";

            return (
              <motion.div
                key={source.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`glass-panel p-4 ${!source.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-snow text-sm font-medium truncate">
                        {source.name}
                      </h3>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded border ${tier.color}`}
                      >
                        {tier.label}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-mono ${typeColor}`}
                      >
                        {source.sourceType}
                      </span>
                    </div>

                    <p className="text-ice/40 text-xs truncate mb-2">
                      {source.url}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-ice/40">
                      <span>Every {source.pollIntervalMinutes}m</span>
                      <span>Last: {timeSince}</span>
                      {source.consecutiveErrors > 0 && (
                        <span className="text-sunset">
                          {source.consecutiveErrors} error
                          {source.consecutiveErrors > 1 ? "s" : ""}
                        </span>
                      )}
                      {source.lastError && (
                        <span
                          className="text-sunset/60 truncate max-w-xs"
                          title={source.lastError}
                        >
                          {source.lastError.slice(0, 50)}
                        </span>
                      )}
                    </div>

                    {(source.defaultTopics.length > 0 ||
                      source.defaultGeoTags.length > 0) && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {source.defaultTopics.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-powder/10 text-powder/70"
                          >
                            {t}
                          </span>
                        ))}
                        {source.defaultGeoTags.map((g) => (
                          <span
                            key={g}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-aurora/10 text-aurora/70"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Delete "${source.name}"? This cannot be undone.`
                          )
                        ) {
                          handleDelete(source.id);
                        }
                      }}
                      disabled={deleting === source.id}
                      className="text-ice/20 hover:text-sunset transition-colors text-xs"
                      title="Delete source"
                    >
                      {deleting === source.id ? "..." : "\u00D7"}
                    </button>
                    <button
                      onClick={() => toggleActive(source)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        source.isActive ? "bg-aurora/30" : "bg-ice/10"
                      }`}
                    >
                      <motion.div
                        animate={{ x: source.isActive ? 20 : 2 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                        className={`w-4 h-4 rounded-full absolute top-0.5 ${
                          source.isActive ? "bg-aurora" : "bg-ice/30"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function formatTimeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

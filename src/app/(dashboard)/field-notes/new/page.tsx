"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

interface CizerResult {
  error?: string;
  suggested_headline?: string;
  suggested_summary?: string;
  content_blocks?: { type: string; content: string }[];
  edit_suggestions?: string[];
  risk_flags?: { type: string; description: string; severity: string }[];
}

export default function NewFieldNotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cizerLoading, setCizerLoading] = useState(false);
  const [cizerResult, setCizerResult] = useState<CizerResult | null>(null);
  const [form, setForm] = useState({
    who: "",
    what: "",
    whenOccurred: "",
    whereLocation: "",
    why: "",
    how: "",
    rawText: "",
    confidenceScore: 50,
  });

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/field-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          confidenceScore: Number(form.confidenceScore),
        }),
      });

      if (res.ok) {
        router.push("/newsroom");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCizer = async () => {
    setCizerLoading(true);
    setCizerResult(null);

    try {
      const res = await fetch("/api/cizer/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          who: form.who || null,
          what: form.what,
          when_occurred: form.whenOccurred || null,
          where_location: form.whereLocation || null,
          why: form.why || null,
          how: form.how || null,
          raw_text: form.rawText || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCizerResult(data);
      } else {
        setCizerResult({ error: "Cizer is unavailable" });
      }
    } catch {
      setCizerResult({ error: "Cannot reach Cizer service" });
    } finally {
      setCizerLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-snow">
          New Field Note
        </h1>
        <p className="text-ice/40 text-sm mt-1">
          Capture raw observations using the 5W1H framework
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* What (required) */}
          <FieldGroup label="What happened?" required>
            <textarea
              value={form.what}
              onChange={(e) => update("what", e.target.value)}
              rows={3}
              placeholder="Describe the core event or observation..."
              className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-3 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 resize-none transition-colors"
            />
          </FieldGroup>

          {/* Who / Where row */}
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Who">
              <input
                type="text"
                value={form.who}
                onChange={(e) => update("who", e.target.value)}
                placeholder="People involved..."
                className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-2.5 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 transition-colors"
              />
            </FieldGroup>

            <FieldGroup label="Where">
              <input
                type="text"
                value={form.whereLocation}
                onChange={(e) => update("whereLocation", e.target.value)}
                placeholder="Location..."
                className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-2.5 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 transition-colors"
              />
            </FieldGroup>
          </div>

          {/* When / Why row */}
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="When">
              <input
                type="datetime-local"
                value={form.whenOccurred}
                onChange={(e) => update("whenOccurred", e.target.value)}
                className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-2.5 text-snow text-sm focus:outline-none focus:border-powder/40 transition-colors [color-scheme:dark]"
              />
            </FieldGroup>

            <FieldGroup label="Why">
              <input
                type="text"
                value={form.why}
                onChange={(e) => update("why", e.target.value)}
                placeholder="Cause or motivation..."
                className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-2.5 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 transition-colors"
              />
            </FieldGroup>
          </div>

          {/* How */}
          <FieldGroup label="How">
            <input
              type="text"
              value={form.how}
              onChange={(e) => update("how", e.target.value)}
              placeholder="How it happened..."
              className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-2.5 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 transition-colors"
            />
          </FieldGroup>

          {/* Raw text */}
          <FieldGroup label="Raw Notes / Transcript">
            <textarea
              value={form.rawText}
              onChange={(e) => update("rawText", e.target.value)}
              rows={4}
              placeholder="Paste raw notes, interview transcripts, or additional context..."
              className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-3 text-snow text-sm placeholder:text-ice/25 focus:outline-none focus:border-powder/40 resize-none transition-colors font-mono text-xs"
            />
          </FieldGroup>

          {/* Confidence */}
          <FieldGroup label={`Confidence: ${form.confidenceScore}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={form.confidenceScore}
              onChange={(e) =>
                update("confidenceScore", Number(e.target.value))
              }
              className="w-full accent-powder"
            />
          </FieldGroup>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={!form.what || loading}
              className="px-6 py-2.5 rounded-xl bg-powder text-navy font-semibold text-sm hover:bg-powder/90 transition-all disabled:opacity-40"
            >
              {loading ? "Saving..." : "Save Field Note"}
            </button>

            <button
              onClick={handleCizer}
              disabled={!form.what || cizerLoading}
              className="px-6 py-2.5 rounded-xl bg-aurora/15 text-aurora border border-aurora/30 font-semibold text-sm hover:bg-aurora/25 transition-all disabled:opacity-40 flex items-center gap-2"
            >
              {cizerLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-aurora/30 border-t-aurora rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                    />
                  </svg>
                  Process with Cizer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cizer result panel */}
        <div className="lg:col-span-1">
          <div className="glass-panel rounded-xl p-4 sticky top-6">
            <h3 className="text-ice/50 text-[11px] uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-aurora"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              Cizer Output
            </h3>

            {cizerResult ? (
              cizerResult.error ? (
                <p className="text-sunset text-xs">{cizerResult.error}</p>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {cizerResult.suggested_headline && (
                    <div>
                      <p className="text-ice/40 text-[10px] uppercase tracking-wider mb-1">
                        Headline
                      </p>
                      <p className="text-snow font-display text-base font-semibold">
                        {cizerResult.suggested_headline}
                      </p>
                    </div>
                  )}

                  {cizerResult.suggested_summary && (
                    <div>
                      <p className="text-ice/40 text-[10px] uppercase tracking-wider mb-1">
                        Summary
                      </p>
                      <p className="text-ice/70 text-xs leading-relaxed">
                        {cizerResult.suggested_summary}
                      </p>
                    </div>
                  )}

                  {(cizerResult.content_blocks?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-ice/40 text-[10px] uppercase tracking-wider mb-1">
                        Content Blocks ({cizerResult.content_blocks!.length})
                      </p>
                      <div className="space-y-2">
                        {cizerResult.content_blocks!
                          .slice(0, 3)
                          .map((block: Record<string, string>, i: number) => (
                            <div
                              key={i}
                              className="bg-white/5 rounded-lg px-3 py-2"
                            >
                              <span className="text-aurora text-[9px] uppercase tracking-wider">
                                {block.type}
                              </span>
                              <p className="text-ice/60 text-[11px] line-clamp-2 mt-0.5">
                                {block.content}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {(cizerResult.edit_suggestions?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-ice/40 text-[10px] uppercase tracking-wider mb-1">
                        Suggestions
                      </p>
                      <ul className="space-y-1">
                        {cizerResult.edit_suggestions!.map(
                          (s: string, i: number) => (
                            <li
                              key={i}
                              className="text-ice/50 text-[11px] flex gap-1.5"
                            >
                              <span className="text-powder/60">&#x2022;</span>
                              {s}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )
            ) : (
              <p className="text-ice/25 text-xs italic">
                Click &ldquo;Process with Cizer&rdquo; to generate article
                structure from your field note.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-ice/50 text-[11px] uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-sunset ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

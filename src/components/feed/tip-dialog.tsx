"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";

type TipDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TipDialog({ isOpen, onClose }: TipDialogProps) {
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim() || content.length < 10) return;

      setStatus("sending");

      try {
        const res = await fetch("/api/tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            ...(email && { email }),
          }),
        });

        if (!res.ok) throw new Error("Failed");

        setStatus("sent");
        setTimeout(() => {
          onClose();
          setContent("");
          setEmail("");
          setStatus("idle");
        }, 2000);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    },
    [content, email, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl glass-panel p-6 pb-10"
          >
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-ice/30" />
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sunset/20 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-sunset"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-snow">
                  Anonymous Tip
                </h3>
                <p className="text-ice/50 text-[11px]">
                  Your identity is protected
                </p>
              </div>
            </div>

            {status === "sent" ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-12 h-12 rounded-full bg-aurora/20 flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-aurora"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>
                <p className="text-snow font-medium">Tip received</p>
                <p className="text-ice/50 text-xs mt-1">
                  Our team will review it carefully
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Share what you know..."
                    rows={4}
                    className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-3 text-snow text-sm placeholder:text-ice/30 focus:outline-none focus:border-powder/40 resize-none transition-colors"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (optional, for follow-up)"
                    className="w-full bg-white/5 border border-frost-border rounded-xl px-4 py-3 text-snow text-sm placeholder:text-ice/30 focus:outline-none focus:border-powder/40 transition-colors"
                  />
                </div>

                {status === "error" && (
                  <p className="text-sunset text-xs">
                    Failed to submit. Please try again.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={content.length < 10 || status === "sending"}
                  className="w-full py-3 rounded-xl bg-sunset text-navy font-semibold text-sm tracking-wide disabled:opacity-40 hover:bg-sunset/90 transition-all"
                >
                  {status === "sending" ? "Submitting..." : "Submit Tip"}
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

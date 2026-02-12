"use client";

import { motion } from "framer-motion";

export function FeedGatedOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center"
    >
      {/* Frosted blur over content */}
      <div className="absolute inset-0 backdrop-blur-lg bg-navy/60" />

      <div className="relative z-10 text-center px-8 max-w-sm">
        {/* Lock icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mb-6"
        >
          <svg
            className="w-7 h-7 text-powder"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </motion.div>

        <motion.h3
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="font-display text-2xl font-bold text-snow mb-2"
        >
          Subscriber Story
        </motion.h3>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-ice/70 text-sm leading-relaxed mb-6"
        >
          This investigation is available to Niseko Gazet subscribers. Support
          independent local journalism.
        </motion.p>

        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-6 rounded-xl bg-powder text-navy font-semibold text-sm tracking-wide hover:bg-powder/90 transition-colors"
        >
          Subscribe from &yen;500/mo
        </motion.button>

        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-3 text-ice/50 text-xs hover:text-ice/70 transition-colors"
        >
          Already a subscriber? Sign in
        </motion.button>
      </div>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";

const TOPICS = [
  { id: "all", label: "All" },
  { id: "breaking", label: "Breaking" },
  { id: "powder", label: "Powder Report" },
  { id: "community", label: "Community" },
  { id: "business", label: "Business" },
  { id: "culture", label: "Culture" },
  { id: "environment", label: "Environment" },
  { id: "safety", label: "Safety" },
  { id: "events", label: "Events" },
];

type FeedFiltersProps = {
  activeTopic: string;
  onTopicChange: (topic: string) => void;
};

export function FeedFilters({ activeTopic, onTopicChange }: FeedFiltersProps) {
  return (
    <div className="chips-scroll flex gap-2 px-4 py-3">
      {TOPICS.map((topic) => {
        const isActive = activeTopic === topic.id;

        return (
          <motion.button
            key={topic.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTopicChange(topic.id)}
            className={`
              relative flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide
              transition-colors duration-200
              ${
                isActive
                  ? "text-navy"
                  : "text-ice/60 hover:text-ice/90"
              }
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeChip"
                className="absolute inset-0 bg-powder rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {!isActive && (
              <div className="absolute inset-0 rounded-full border border-frost-border" />
            )}
            <span className="relative z-10">{topic.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

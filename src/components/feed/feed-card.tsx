"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { FeedItem } from "@/hooks/use-feed";
import { FeedVideoPlayer } from "./feed-video-player";
import { FeedGatedOverlay } from "./feed-gated-overlay";
import { FeedArticleExpand } from "./feed-article-expand";

type FeedCardProps = {
  item: FeedItem;
  index: number;
  isSubscribed?: boolean;
};

export function FeedCard({ item, index, isSubscribed = false }: FeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const videoBlock = item.contentBlocks.find((b) => b.type === "video");
  const imageBlock = item.contentBlocks.find((b) => b.type === "image");
  const hasMedia = !!videoBlock || !!imageBlock;
  const isGated = item.isGated && !isSubscribed;

  return (
    <>
      <div className="feed-card relative overflow-hidden">
        {/* Background media or gradient */}
        {videoBlock ? (
          <FeedVideoPlayer src={videoBlock.content} />
        ) : imageBlock ? (
          <div className="absolute inset-0">
            <img
              src={imageBlock.content}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg,
                hsl(${210 + index * 15}, 60%, 12%) 0%,
                hsl(${220 + index * 10}, 50%, 8%) 50%,
                hsl(${200 + index * 12}, 55%, 15%) 100%)`,
            }}
          />
        )}

        {/* Gradient overlay for text readability */}
        <div className="mountain-gradient absolute inset-0 z-10" />

        {/* Noise texture */}
        <div className="noise absolute inset-0 z-10 pointer-events-none" />

        {/* Gated overlay */}
        {isGated && <FeedGatedOverlay />}

        {/* Content overlay */}
        {!isGated && (
          <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-24">
            {/* Topic chips */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="flex gap-2 mb-3"
            >
              {item.topicTags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] uppercase tracking-[0.2em] text-aurora font-semibold bg-aurora/10 px-2.5 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {item.geoTags.slice(0, 1).map((geo) => (
                <span
                  key={geo}
                  className="text-[10px] uppercase tracking-[0.2em] text-powder/70 font-medium"
                >
                  {geo}
                </span>
              ))}
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + index * 0.05 }}
              className="font-display text-[28px] leading-[1.15] font-bold text-snow mb-2 max-w-[90%]"
            >
              {item.headline}
            </motion.h2>

            {/* Summary */}
            {item.summary && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="text-ice/65 text-sm leading-relaxed line-clamp-2 mb-4 max-w-[85%]"
              >
                {item.summary}
              </motion.p>
            )}

            {/* Timestamp + Read more */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 + index * 0.05 }}
              className="flex items-center gap-4"
            >
              <time className="text-ice/40 text-xs">
                {new Date(item.publishedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </time>

              <button
                onClick={() => setIsExpanded(true)}
                className="text-powder text-xs font-medium flex items-center gap-1.5 hover:text-powder/80 transition-colors"
              >
                Read full story
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 15.75l7.5-7.5 7.5 7.5"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        )}

        {/* Right-side action bar */}
        {!isGated && (
          <div className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-5">
            <ActionButton icon="bookmark" label="Save" />
            <ActionButton icon="share" label="Share" />
          </div>
        )}
      </div>

      {/* Bottom sheet article expand */}
      <FeedArticleExpand
        item={item}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
      />
    </>
  );
}

function ActionButton({ icon, label }: { icon: string; label: string }) {
  const icons: Record<string, JSX.Element> = {
    bookmark: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
        />
      </svg>
    ),
    share: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
        />
      </svg>
    ),
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      className="flex flex-col items-center gap-1 group"
    >
      <div className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-ice/70 group-hover:text-snow transition-colors">
        {icons[icon]}
      </div>
      <span className="text-[9px] text-ice/40 font-medium">{label}</span>
    </motion.button>
  );
}

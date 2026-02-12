"use client";

import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useCallback, useRef } from "react";
import type { FeedItem } from "@/hooks/use-feed";

type FeedArticleExpandProps = {
  item: FeedItem;
  isOpen: boolean;
  onClose: () => void;
};

export function FeedArticleExpand({
  item,
  isOpen,
  onClose,
}: FeedArticleExpandProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = useCallback(
    (_: any, info: { velocity: { y: number }; offset: { y: number } }) => {
      if (info.velocity.y > 300 || info.offset.y > 150) {
        onClose();
      }
    },
    [onClose]
  );

  const textBlocks = item.contentBlocks.filter((b) => b.type === "text");
  const imageBlocks = item.contentBlocks.filter((b) => b.type === "image");
  const quoteBlocks = item.contentBlocks.filter((b) => b.type === "quote");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />

          {/* Bottom Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] rounded-t-3xl overflow-hidden"
          >
            <div className="glass-panel noise min-h-full">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-ice/30" />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto max-h-[80dvh] px-6 pb-10">
                {/* Topic tags */}
                <div className="flex gap-2 mb-4">
                  {item.topicTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-[0.2em] text-aurora font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Headline */}
                <h1 className="font-display text-3xl font-bold text-snow leading-tight mb-3">
                  {item.headline}
                </h1>

                {/* Meta */}
                <div className="flex items-center gap-3 text-ice/50 text-xs mb-8 pb-6 border-b border-frost-border">
                  <time>
                    {new Date(item.publishedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                  {item.geoTags.length > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-ice/30" />
                      <span>{item.geoTags[0]}</span>
                    </>
                  )}
                </div>

                {/* Summary */}
                {item.summary && (
                  <p className="text-ice/80 text-base leading-relaxed mb-8 font-display italic text-lg">
                    {item.summary}
                  </p>
                )}

                {/* Content blocks */}
                <div className="space-y-6">
                  {item.contentBlocks.map((block, i) => {
                    switch (block.type) {
                      case "text":
                        return (
                          <p
                            key={i}
                            className="text-snow/85 text-[15px] leading-[1.8]"
                          >
                            {block.content}
                          </p>
                        );
                      case "quote":
                        return (
                          <blockquote
                            key={i}
                            className="border-l-2 border-powder/40 pl-5 my-8"
                          >
                            <p className="font-display text-xl italic text-ice/90 leading-relaxed">
                              &ldquo;{block.content}&rdquo;
                            </p>
                            {block.metadata?.speaker != null && (
                              <cite className="block mt-2 text-xs text-ice/50 not-italic uppercase tracking-wider">
                                &mdash; {String(block.metadata.speaker)}
                              </cite>
                            )}
                          </blockquote>
                        );
                      case "image":
                        return (
                          <figure key={i} className="my-8 -mx-6">
                            <div className="aspect-video bg-slate/30 rounded-none overflow-hidden">
                              <img
                                src={block.content}
                                alt={String(block.metadata?.alt ?? "")}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            {block.metadata?.caption != null && (
                              <figcaption className="px-6 mt-2 text-xs text-ice/40">
                                {String(block.metadata.caption)}
                              </figcaption>
                            )}
                          </figure>
                        );
                      default:
                        return (
                          <div
                            key={i}
                            className="text-snow/70 text-sm"
                          >
                            {block.content}
                          </div>
                        );
                    }
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

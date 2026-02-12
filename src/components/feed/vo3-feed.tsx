"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useFeed } from "@/hooks/use-feed";
import { FeedCard } from "./feed-card";
import { FeedFilters } from "./feed-filters";
import { TipDialog } from "./tip-dialog";

export function VO3Feed() {
  const [activeTopic, setActiveTopic] = useState("all");
  const [tipOpen, setTipOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filters =
    activeTopic === "all" ? {} : { topic: activeTopic };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFeed(filters);

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  // Infinite scroll: load more when approaching end
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < clientHeight * 2) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-navy">
      {/* Ambient snow particles */}
      <SnowParticles />

      {/* Top bar with logo + filters */}
      <div className="fixed top-0 left-0 right-0 z-30 safe-area-top">
        <div className="glass-panel border-b border-frost-border">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h1 className="font-display text-lg font-bold tracking-tight text-snow">
              <span className="text-powder">Niseko</span>{" "}
              <span className="font-normal text-ice/70">Gazet</span>
            </h1>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTipOpen(true)}
                className="w-8 h-8 rounded-full bg-sunset/15 flex items-center justify-center hover:bg-sunset/25 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5 text-sunset"
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
              </button>
            </div>
          </div>

          <FeedFilters
            activeTopic={activeTopic}
            onTopicChange={setActiveTopic}
          />
        </div>
      </div>

      {/* Feed scroll container */}
      <div ref={scrollRef} className="feed-scroll pt-0">
        {/* Spacer for top bar */}
        <div className="h-[100px]" />

        {isLoading ? (
          <LoadingSkeleton />
        ) : allItems.length === 0 ? (
          <EmptyState />
        ) : (
          allItems.map((item, i) => (
            <FeedCard key={item.id} item={item} index={i} />
          ))
        )}

        {isFetchingNextPage && (
          <div className="h-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-powder/30 border-t-powder rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Tip dialog */}
      <TipDialog isOpen={tipOpen} onClose={() => setTipOpen(false)} />
    </div>
  );
}

function SnowParticles() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-30">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${((i * 41 + 17) % 100)}%`,
            animationDuration: `${8 + ((i * 7 + 3) % 12)}s`,
            animationDelay: `${((i * 13 + 5) % 10)}s`,
            width: `${1 + ((i * 3 + 1) % 3)}px`,
            height: `${1 + ((i * 3 + 1) % 3)}px`,
          }}
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="feed-card flex flex-col justify-end p-5 pb-24">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="shimmer rounded-full h-4 w-16" />
          <div className="shimmer rounded-full h-4 w-20" />
        </div>
        <div className="shimmer rounded-lg h-8 w-[80%]" />
        <div className="shimmer rounded-lg h-8 w-[65%]" />
        <div className="shimmer rounded-lg h-4 w-[90%]" />
        <div className="shimmer rounded-lg h-4 w-[70%]" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="feed-card flex flex-col items-center justify-center px-8">
      <div className="w-16 h-16 rounded-2xl glass-panel flex items-center justify-center mb-5">
        <svg
          className="w-7 h-7 text-ice/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
          />
        </svg>
      </div>
      <p className="font-display text-xl text-snow mb-2">No stories yet</p>
      <p className="text-ice/50 text-sm text-center">
        Fresh stories from Niseko will appear here
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Subscriber = {
  id: string;
  userId: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string | null;
  email?: string;
  name?: string;
};

const PLAN_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  free: { label: "Free", color: "text-ice/50", bg: "bg-ice/5" },
  basic: { label: "Basic", color: "text-powder", bg: "bg-powder/10" },
  premium: { label: "Premium", color: "text-aurora", bg: "bg-aurora/10" },
  enterprise: { label: "Enterprise", color: "text-sunset", bg: "bg-sunset/10" },
};

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        // API returns a single subscription or list
        setSubscribers(Array.isArray(data) ? data : data?.id ? [data] : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeSubs = subscribers.filter((s) => s.isActive);
  const totalByPlan = subscribers.reduce(
    (acc, s) => {
      acc[s.plan] = (acc[s.plan] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-snow">
          Subscribers
        </h1>
        <p className="text-ice/40 text-sm mt-1">
          Manage subscriber plans and distribution
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-panel rounded-xl px-4 py-3"
        >
          <p className="text-2xl font-bold text-snow">{subscribers.length}</p>
          <p className="text-ice/40 text-[11px] uppercase tracking-wider mt-1">
            Total
          </p>
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="glass-panel rounded-xl px-4 py-3"
        >
          <p className="text-2xl font-bold text-aurora">{activeSubs.length}</p>
          <p className="text-ice/40 text-[11px] uppercase tracking-wider mt-1">
            Active
          </p>
        </motion.div>
        {Object.entries(PLAN_STYLES)
          .filter(([key]) => key !== "free")
          .map(([key, style], i) => (
            <motion.div
              key={key}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-panel rounded-xl px-4 py-3"
            >
              <p className={`text-2xl font-bold ${style.color}`}>
                {totalByPlan[key] || 0}
              </p>
              <p className="text-ice/40 text-[11px] uppercase tracking-wider mt-1">
                {style.label}
              </p>
            </motion.div>
          ))}
      </div>

      {/* Subscriber list */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-4">
              <div className="shimmer h-5 w-1/3 rounded mb-2" />
              <div className="shimmer h-3 w-1/4 rounded" />
            </div>
          ))
        ) : subscribers.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center">
            <svg
              className="w-10 h-10 text-ice/20 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
            <p className="font-display text-lg text-ice/40">
              No subscribers yet
            </p>
            <p className="text-ice/25 text-xs mt-1">
              Subscribers will appear here as readers sign up
            </p>
          </div>
        ) : (
          subscribers.map((sub, i) => {
            const style = PLAN_STYLES[sub.plan] ?? PLAN_STYLES.free;
            return (
              <motion.div
                key={sub.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="glass-panel rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-powder/15 flex items-center justify-center text-powder text-xs font-bold flex-shrink-0">
                    {(sub.name?.[0] ?? sub.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-snow text-sm font-medium truncate">
                      {sub.name ?? sub.email ?? sub.userId}
                    </p>
                    <p className="text-ice/30 text-[10px]">
                      Joined {new Date(sub.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${style.color} ${style.bg}`}
                  >
                    {style.label}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${sub.isActive ? "bg-aurora" : "bg-ice/20"}`}
                  />
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-snow">Settings</h1>
        <p className="text-ice/40 text-sm mt-1">
          Platform configuration and admin tools
        </p>
      </div>

      {/* Profile section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-panel rounded-xl p-6 mb-6"
      >
        <h2 className="text-sm font-semibold text-snow uppercase tracking-wider mb-4">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-powder/20 flex items-center justify-center text-powder text-xl font-bold">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="text-snow font-medium">
              {session?.user?.name ?? "—"}
            </p>
            <p className="text-ice/40 text-sm">{session?.user?.email ?? "—"}</p>
            <p className="text-ice/30 text-[10px] uppercase tracking-wider mt-1">
              {(session?.user as { role?: string })?.role ?? "—"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Platform info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="glass-panel rounded-xl p-6 mb-6"
      >
        <h2 className="text-sm font-semibold text-snow uppercase tracking-wider mb-4">
          Platform
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-frost-border">
            <span className="text-ice/50 text-sm">Application</span>
            <span className="text-snow text-sm">Niseko Gazet</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-frost-border">
            <span className="text-ice/50 text-sm">Environment</span>
            <span className="text-aurora text-sm font-mono text-xs">
              production
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-frost-border">
            <span className="text-ice/50 text-sm">AI Editor</span>
            <span className="text-snow text-sm">Caesar</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-ice/50 text-sm">Database</span>
            <span className="text-snow text-sm">Supabase</span>
          </div>
        </div>
      </motion.div>

      {/* Danger zone placeholder */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-xl p-6 border-red-400/20"
      >
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
          Danger Zone
        </h2>
        <p className="text-ice/30 text-xs">
          Advanced administrative actions will be available here in a future
          update.
        </p>
      </motion.div>
    </div>
  );
}

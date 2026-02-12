"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/newsroom");
    }
  };

  return (
    <div className="min-h-dvh bg-navy relative overflow-hidden flex items-center justify-center">
      {/* Mountain silhouette background */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute bottom-0 w-full"
          viewBox="0 0 1440 600"
          fill="none"
          preserveAspectRatio="xMidYMax slice"
        >
          {/* Far mountain range */}
          <path
            d="M0 600 L0 380 Q120 280 240 340 Q360 200 480 300 Q540 180 660 260 Q780 120 900 220 Q1020 160 1080 240 Q1200 100 1320 200 Q1380 180 1440 220 L1440 600Z"
            fill="rgba(45,55,72,0.3)"
          />
          {/* Near mountain range */}
          <path
            d="M0 600 L0 440 Q180 340 360 400 Q480 280 600 380 Q720 260 840 360 Q960 300 1080 380 Q1200 320 1320 400 Q1380 380 1440 400 L1440 600Z"
            fill="rgba(45,55,72,0.5)"
          />
          {/* Foreground hills */}
          <path
            d="M0 600 L0 500 Q200 460 400 490 Q600 450 800 480 Q1000 440 1200 470 Q1350 460 1440 480 L1440 600Z"
            fill="rgba(10,22,40,0.8)"
          />
        </svg>

        {/* Aurora glow */}
        <div
          className="absolute top-0 left-1/4 w-1/2 h-64 opacity-15"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(56,178,172,0.4) 0%, transparent 70%)",
          }}
        />

        {/* Stars - positions determined by index for render purity */}
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-[1px] h-[1px] bg-snow/40 rounded-full"
            style={{
              left: `${((i * 37 + 13) % 100)}%`,
              top: `${((i * 23 + 7) % 50)}%`,
              animationDelay: `${(i * 0.1) % 3}s`,
            }}
          />
        ))}
      </div>

      {/* Login card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        <div className="glass-panel rounded-2xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-display text-3xl font-bold tracking-tight"
            >
              <span className="text-powder">Niseko</span>{" "}
              <span className="text-ice/60 font-normal">Gazet</span>
            </motion.h1>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-ice/40 text-xs mt-2 uppercase tracking-[0.25em]"
            >
              Newsroom
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <label className="block text-ice/50 text-[11px] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-frost-border rounded-lg px-4 py-2.5 text-snow text-sm placeholder:text-ice/20 focus:outline-none focus:border-powder/40 transition-colors"
                placeholder="reporter@niseko-gazet.com"
              />
            </motion.div>

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-ice/50 text-[11px] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-frost-border rounded-lg px-4 py-2.5 text-snow text-sm placeholder:text-ice/20 focus:outline-none focus:border-powder/40 transition-colors"
                placeholder="••••••••"
              />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sunset text-xs"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-powder text-navy font-semibold text-sm tracking-wide hover:bg-powder/90 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </motion.button>
          </form>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-ice/30 text-[10px] mt-6 uppercase tracking-widest"
        >
          Independent journalism from Hokkaido
        </motion.p>
      </motion.div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Zap,
  RotateCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();

  const [email, setEmail] = useState("anshulnparate@gmail.com");
  const [password, setPassword] = useState("");
  const [destinationMarket, setDestinationMarket] = useState<"perp" | "equities">("perp");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to determine safe redirect target from ?from= query parameter or selected market
  const getRedirectTarget = () => {
    if (typeof window === "undefined") {
      return destinationMarket === "equities" ? "/equities" : "/terminal";
    }
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    if (from && from.startsWith("/") && !from.startsWith("//")) {
      return from;
    }
    return destinationMarket === "equities" ? "/equities" : "/terminal";
  };

  // If already logged in, redirect immediately
  useEffect(() => {
    if (user) {
      const target = getRedirectTarget();
      window.location.replace(target);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await login(email, password);
    if (res.success) {
      const target = getRedirectTarget();
      const targetLabel = target.includes("ai-engine") ? "AI Engine" : "Terminal";
      setSuccessMsg(`✔ Authentication verified. Redirecting to ${targetLabel}...`);
      setTimeout(() => {
        window.location.replace(target);
      }, 350);
    } else {
      setErrorMsg(res.error || "Authentication failed. Check your credentials.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-chrome-bg text-chrome-ink font-body selection:bg-accent-tint selection:text-chrome-ink">
      
      {/* Top Header matching Portfolio & Terminal */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-chrome-line px-4 sm:px-8 py-3.5 flex items-center justify-between select-none shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="size-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            TP
          </span>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
            <span className="font-brand text-lg font-medium tracking-tight text-chrome-ink group-hover:text-accent transition-colors">
              Trader-Pro
            </span>
            <span className="font-mono text-xs lowercase text-chrome-dim hidden sm:inline">
              btc strategy research &amp; paper-trading
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/terminal"
            className="flex items-center gap-1 font-mono text-xs text-chrome-dim hover:text-chrome-ink bg-white border border-chrome-line px-2.5 py-1.5 rounded transition-all shadow-xs hover:border-chrome-ink"
          >
            <span>Terminal Preview</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-chrome-green-ink bg-win-tint border border-win/30 px-2.5 py-1 rounded">
            <span className="size-1.5 rounded-full bg-chrome-green animate-pulse" />
            <span>SECURE GATEWAY</span>
          </div>
        </div>
      </header>

      {/* Main Login Workspace */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          
          {/* Card Container */}
          <div className="bg-white border border-chrome-line rounded-xl p-6 sm:p-8 shadow-card relative overflow-hidden">
            
            {/* Subtle green ambient tint */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Title */}
            <div className="flex flex-col gap-2 text-center items-center mb-6">
              <div className="size-12 rounded-xl bg-win-tint border border-win/30 flex items-center justify-center text-accent shadow-xs mb-1">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="font-brand text-2xl font-medium tracking-tight text-chrome-ink">
                Trader-Pro Sign In
              </h1>
              <p className="text-xs text-chrome-dim font-sans max-w-xs">
                Enter your authorized credentials to access the live quantitative execution terminal &amp; AI models.
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-loss-tint border border-loss/30 text-loss-dark text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-loss" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-win-tint border border-win/30 text-win-dark text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-accent" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* Segregated Market Destination Selector */}
              <div className="flex flex-col gap-1.5 pb-1">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Select Target Trading Terminal
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setDestinationMarket("perp")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all cursor-pointer ${
                      destinationMarket === "perp"
                        ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <span>🪙 Perp (Crypto & Cmdty)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationMarket("equities")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md transition-all cursor-pointer ${
                      destinationMarket === "equities"
                        ? "bg-white text-blue-800 shadow-2xs border border-blue-200"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <span>🇺🇸 US Equities</span>
                  </button>
                </div>
              </div>

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-chrome-dim uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-chrome-icon" /> Authorized Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="anshulnparate@gmail.com"
                    className="w-full bg-chrome-field border border-chrome-line rounded-lg px-3.5 py-2.5 text-sm font-mono text-chrome-ink placeholder-chrome-mute focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-chrome-dim uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-chrome-icon" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-chrome-field border border-chrome-line rounded-lg px-3.5 py-2.5 text-sm font-mono text-chrome-ink placeholder-chrome-mute focus:outline-none focus:border-accent focus:bg-white focus:ring-1 focus:ring-accent transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-chrome-dim hover:text-chrome-ink transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-accent hover:bg-accent-hover active:scale-[0.99] text-white font-mono text-sm font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>AUTHENTICATING...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN TO TRADER-PRO</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Notice */}
            <div className="mt-6 pt-5 border-t border-chrome-line/60 flex items-center justify-between text-[11px] font-mono text-chrome-dim">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-accent" /> MongoDB Atlas Sync
              </span>
              <span>Shark Exchange (0.040%)</span>
            </div>

          </div>

          {/* Quick links below card */}
          <div className="flex items-center justify-between text-xs font-mono text-chrome-dim px-2">
            <Link href="/" className="hover:text-chrome-ink transition-colors">
              ← Return to Home
            </Link>
            <Link href="/ai-engine" className="hover:text-accent transition-colors">
              View AI Engine →
            </Link>
          </div>

        </div>
      </main>

    </div>
  );
}

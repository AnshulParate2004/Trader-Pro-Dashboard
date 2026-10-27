"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  KeyRound,
  RotateCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();

  const [email, setEmail] = useState("anshulnparate@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already logged in, redirect to Terminal
  useEffect(() => {
    if (user) {
      router.push("/terminal");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await login(email, password);
    if (res.success) {
      setSuccessMsg("✔ Authentication verified. Redirecting to Terminal...");
      setTimeout(() => {
        router.push("/terminal");
      }, 700);
    } else {
      setErrorMsg(res.error || "Authentication failed. Check your credentials.");
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = () => {
    setEmail("anshulnparate@gmail.com");
    setPassword("20102004");
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-[#0b0f17] text-white font-sans selection:bg-emerald-500/30">
      
      {/* Top Header */}
      <header className="h-14 border-b border-gray-800/80 px-6 flex items-center justify-between bg-[#0e131f]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded bg-emerald-500 flex items-center justify-center text-gray-950 font-mono text-xs font-black shadow-md">
            TP
          </div>
          <span className="font-mono text-sm font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
            TRADER-PRO <span className="text-emerald-400 font-mono">QUANT</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/terminal"
            className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
          >
            Terminal Preview
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>SECURE GATEWAY</span>
          </div>
        </div>
      </header>

      {/* Main Login Workspace */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md flex flex-col gap-5">
          
          {/* Card Container */}
          <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            
            {/* Subtle glow effect */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Header / Title */}
            <div className="flex flex-col gap-2 text-center items-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-gray-950 shadow-lg shadow-emerald-500/20 mb-1">
                <Shield className="w-6 h-6 text-gray-950" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white font-sans">
                Trader-Pro Sign In
              </h1>
              <p className="text-xs text-gray-400 font-sans max-w-xs">
                Enter your authorized credentials to access the live quantitative execution terminal & AI models.
              </p>
            </div>

            {/* One-Click Quick Fill Helper */}
            <div className="mb-5 p-3 rounded-xl bg-[#182133] border border-gray-700/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono font-bold text-gray-300">Anshul Parate Account</span>
                  <span className="text-[10px] font-mono text-gray-500">anshulnparate@gmail.com</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] font-mono font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 px-2.5 py-1 rounded-md transition-all cursor-pointer"
              >
                Auto Fill
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> Authorized Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="anshulnparate@gmail.com"
                    className="w-full bg-[#0d131f] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0d131f] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-gray-950 font-mono text-sm font-extrabold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
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
            <div className="mt-6 pt-5 border-t border-gray-800/80 flex items-center justify-between text-[11px] font-mono text-gray-500">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-500" /> MongoDB Atlas Sync
              </span>
              <span>Shark Exchange (0.040%)</span>
            </div>

          </div>

          {/* Quick links below card */}
          <div className="flex items-center justify-between text-xs font-mono text-gray-500 px-2">
            <Link href="/" className="hover:text-gray-300 transition-colors">
              ← Return to Home
            </Link>
            <Link href="/ai-engine" className="hover:text-emerald-400 transition-colors">
              View AI Engine →
            </Link>
          </div>

        </div>
      </main>

    </div>
  );
}

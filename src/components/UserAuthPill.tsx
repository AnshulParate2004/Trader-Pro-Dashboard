"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { User, LogOut, Shield, ChevronDown, CheckCircle2 } from "lucide-react";

export default function UserAuthPill() {
  const { user, logout, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-8 w-20 bg-gray-200 animate-pulse rounded-full"></div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-900 hover:text-emerald-600 bg-white hover:bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-full shadow-2xs transition-all"
      >
        <User className="w-3.5 h-3.5 text-gray-600" />
        <span>Sign In</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-full pl-1.5 pr-2.5 py-1 text-xs font-mono font-bold text-gray-900 shadow-2xs transition-all cursor-pointer"
        title={`Signed in as ${user.name}`}
      >
        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
          AP
        </div>
        <span className="hidden sm:inline max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          ></div>
          <div className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 flex flex-col gap-1.5 animate-fade-in font-sans">
            <div className="px-3 py-2 border-b border-gray-100 flex flex-col">
              <span className="font-mono text-xs font-extrabold text-gray-900">{user.name}</span>
              <span className="font-mono text-[10px] text-gray-500 truncate">{user.email}</span>
              <span className="inline-block mt-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                {user.role}
              </span>
            </div>

            <button
              onClick={() => {
                logout();
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-semibold text-rose-600 hover:bg-rose-50 transition-colors w-full text-left cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

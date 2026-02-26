"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  defaultTab?: "signin" | "signup";
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, defaultTab = "signin" }: AuthModalProps) {
  const [tab, setTab] = useState<"signin" | "signup">(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const supabase = createClient();

    if (tab === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }
      onAuthSuccess();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }
      setSignUpSuccess(true);
      setIsLoading(false);
      // Auto-sign in after signup (works when email confirmation is disabled)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        onAuthSuccess();
        return;
      }
      // If auto-sign-in fails, the success message tells them to check email
      return;
    }

    setIsLoading(false);
  };

  const switchTab = (newTab: "signin" | "signup") => {
    setTab(newTab);
    setError("");
    setSignUpSuccess(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-md w-full p-8 border border-gray-700 shadow-2xl">
        {/* Tabs */}
        <div className="flex mb-6 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => switchTab("signin")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === "signin"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchTab("signup")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              tab === "signup"
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {signUpSuccess ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">&#x2709;&#xFE0F;</div>
            <h3 className="text-xl font-semibold text-white mb-2">Check your email</h3>
            <p className="text-gray-400 text-sm">
              We sent a confirmation link to <strong className="text-white">{email}</strong>.
              Click it to activate your account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                placeholder={tab === "signup" ? "At least 6 characters" : "Your password"}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? "Loading..."
                : tab === "signin"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full mt-4 text-gray-400 hover:text-white transition-colors py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

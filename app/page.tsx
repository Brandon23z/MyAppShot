"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import ScreenshotEditor from "@/components/ScreenshotEditor";
import AuthModal from "@/components/AuthModal";
import { createClient } from "@/utils/supabase/client";
import { checkSubscription } from "@/utils/subscription";
import { attemptMigration } from "@/utils/migration";
import { FREE_LIMIT } from "@/utils/freebie";

export default function Home() {
  const [showEditor, setShowEditor] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Set up auth listener
  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const paid = await checkSubscription(user.id);
        setIsPaid(paid);
        // Attempt localStorage migration for existing paid users
        if (!paid) {
          const migrated = await attemptMigration(user.id);
          if (migrated) setIsPaid(true);
        }
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          const paid = await checkSubscription(newUser.id);
          setIsPaid(paid);
          if (!paid) {
            const migrated = await attemptMigration(newUser.id);
            if (migrated) setIsPaid(true);
          }
        } else {
          setIsPaid(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle Stripe success redirect — poll DB for webhook-created subscription
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidParam = params.get("paid") === "true";
    const sessionId = params.get("session_id");

    if (!paidParam || !sessionId) return;

    // Clean URL immediately
    window.history.replaceState({}, "", "/");

    // Wait for user to be loaded, then poll for subscription
    const pollForSubscription = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Poll DB for up to 10 seconds
      for (let i = 0; i < 20; i++) {
        const paid = await checkSubscription(user.id);
        if (paid) {
          setIsPaid(true);
          alert("Welcome to AppShot Pro! You now have unlimited exports and no watermark.");
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      // If polling timed out, the webhook might be slow — check once more on next page load
      alert("Payment received! Your Pro features may take a moment to activate. Please refresh if needed.");
    };

    pollForSubscription();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {!showEditor ? (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                AppShot Pro
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-4">
                Transform your screenshots into stunning visuals
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Add beautiful gradients, device mockups, and professional frames to your screenshots.
                Perfect for presentations, social media, and portfolios.
              </p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 mb-12 mt-12">
              <div className="bg-gray-800/50 backdrop-blur p-6 rounded-xl border border-gray-700">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-lg font-semibold mb-2">Beautiful Templates</h3>
                <p className="text-gray-400 text-sm">Gradients, solids, and custom backgrounds</p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur p-6 rounded-xl border border-gray-700">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="text-lg font-semibold mb-2">Device Mockups</h3>
                <p className="text-gray-400 text-sm">iPhone, MacBook, and browser frames</p>
              </div>
              <div className="bg-gray-800/50 backdrop-blur p-6 rounded-xl border border-gray-700">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold mb-2">Instant Export</h3>
                <p className="text-gray-400 text-sm">Download high-quality PNG in one click</p>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowEditor(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg shadow-purple-500/50"
            >
              Start Creating Free
            </button>

            <p className="text-gray-500 mt-4 text-sm">
              {FREE_LIMIT} free screenshots per month • No credit card required
            </p>

            {/* Auth link */}
            {!authLoading && !user && (
              <p className="text-gray-500 mt-2 text-sm">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-purple-400 hover:text-purple-300 underline transition-colors"
                >
                  Sign in
                </button>
                {" "}to sync your subscription across devices
              </p>
            )}
            {!authLoading && user && (
              <p className="text-gray-500 mt-2 text-sm">
                Signed in as {user.email}
              </p>
            )}
          </div>
        </div>
      ) : (
        <ScreenshotEditor
          onBack={() => setShowEditor(false)}
          user={user}
          isPaid={isPaid}
          onAuthRequired={() => setShowAuthModal(true)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => setShowAuthModal(false)}
      />
    </main>
  );
}

"use client";

import { useState } from "react";
import { FREE_LIMIT } from "../utils/freebie";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        alert('Failed to create checkout session. Please try again.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl max-w-lg w-full p-8 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            You've used all {FREE_LIMIT} free exports this month
          </h2>
          <p className="text-gray-400">
            Upgrade to Pro for unlimited screenshots and premium features
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <span className="text-2xl">♾️</span>
            <div>
              <h3 className="font-semibold text-white">Unlimited Exports</h3>
              <p className="text-sm text-gray-400">Create as many screenshots as you need</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <span className="text-2xl">✨</span>
            <div>
              <h3 className="font-semibold text-white">No Watermark</h3>
              <p className="text-sm text-gray-400">Remove "MyAppShot.com" branding</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            <span className="text-2xl">🎨</span>
            <div>
              <h3 className="font-semibold text-white">Custom Branding</h3>
              <p className="text-sm text-gray-400">Add your own watermark text</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="text-center mb-6">
          <div className="text-5xl font-bold mb-2">
            <span className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              $5
            </span>
            <span className="text-2xl text-gray-400">/month</span>
          </div>
          <p className="text-sm text-gray-500">Cancel anytime • Instant access</p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-4 rounded-lg font-bold text-lg hover:from-purple-600 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-purple-500/50"
        >
          {isLoading ? 'Loading...' : 'Upgrade to AppShot Pro — $5/month'}
        </button>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full mt-4 text-gray-400 hover:text-white transition-colors py-2"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

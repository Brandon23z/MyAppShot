"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import TemplateSelector from "./TemplateSelector";
import PaywallModal from "./PaywallModal";
import { applyTemplate, exportCanvas } from "@/utils/canvas";
import { hasHitFreeLimit, incrementUsage as incrementLocalUsage, getRemainingExports } from "@/utils/freebie";
import { checkSubscription, getUsageCount as getDbUsageCount, incrementUsage as incrementDbUsage } from "@/utils/subscription";
import { createClient } from "@/utils/supabase/client";
import { FREE_LIMIT } from "@/utils/freebie";

interface Template {
  id: string;
  name: string;
  type: "gradient" | "solid" | "device";
  config: any;
}

interface ImageTransform {
  scale: number;
  x: number;
  y: number;
}

interface ScreenshotEditorProps {
  onBack: () => void;
  user: User | null;
  isPaid: boolean;
  onAuthRequired: () => void;
}

export default function ScreenshotEditor({ onBack, user, isPaid, onAuthRequired }: ScreenshotEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeBackground, setActiveBackground] = useState<Template | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customWatermark, setCustomWatermark] = useState("");
  const [imageTransform, setImageTransform] = useState<ImageTransform>({ scale: 1, x: 0, y: 0 });
  const [isTransforming, setIsTransforming] = useState(false);
  const [screenBgColor, setScreenBgColor] = useState<"#ffffff" | "#000000">("#000000");
  const [showPaywall, setShowPaywall] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transformStartRef = useRef<{ x: number; y: number } | null>(null);
  const realScreenDimsRef = useRef<{ width: number; height: number } | null>(null);

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        if (!selectedTemplate) {
          const defaultBg: Template = {
            id: "gradient-purple-pink",
            name: "Purple Dream",
            type: "gradient",
            config: { colors: ["#4c1d95", "#ec4899", "#fce7f3"], angle: 135 }
          };
          setSelectedTemplate(defaultBg);
          setActiveBackground(defaultBg);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) handleFileUpload(file);
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Handle template selection
  const handleTemplateChange = (template: Template) => {
    if (template.type === "gradient" || template.type === "solid") {
      setActiveBackground(template);
      if (selectedTemplate?.type === "device") {
        return;
      }
    }
    if (template.type === "device" && !activeBackground) {
      setActiveBackground({
        id: "gradient-purple-pink",
        name: "Purple Dream",
        type: "gradient",
        config: { colors: ["#4c1d95", "#ec4899", "#fce7f3"], angle: 135 }
      });
    }
    setSelectedTemplate(template);
  };

  // Render canvas when image or template changes
  useEffect(() => {
    if (image && canvasRef.current && selectedTemplate) {
      const renderTemplate = selectedTemplate.type === "device" && activeBackground
        ? { ...selectedTemplate, config: { ...selectedTemplate.config, _background: activeBackground, _screenBgColor: screenBgColor } }
        : selectedTemplate.type === "device"
        ? { ...selectedTemplate, config: { ...selectedTemplate.config, _screenBgColor: screenBgColor } }
        : selectedTemplate;

      applyTemplate(canvasRef.current, image, renderTemplate, customWatermark, imageTransform, isPaid).then(() => {
        if (renderTemplate.config._realScreenDimensions) {
          realScreenDimsRef.current = renderTemplate.config._realScreenDimensions;
        }
      }).catch(err => {
        console.error('Failed to apply template:', err);
      });
    }
  }, [image, selectedTemplate, activeBackground, customWatermark, imageTransform, isPaid, screenBgColor]);

  // Reset transform and cached screen dimensions when template changes
  useEffect(() => {
    if (selectedTemplate?.config?.device) {
      setImageTransform({ scale: 1, x: 0, y: 0 });
      realScreenDimsRef.current = null;
    }
  }, [selectedTemplate?.id]);

  // Auto-fill screen when device template is selected or when image is uploaded
  useEffect(() => {
    if (image && selectedTemplate?.config?.device) {
      const timer = setTimeout(() => {
        handleFillScreen();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [image, selectedTemplate?.id]);

  // Get screen dimensions for the current device template
  const getScreenDimensions = () => {
    if (!selectedTemplate?.config?.device) return { width: 0, height: 0 };
    if (realScreenDimsRef.current) return realScreenDimsRef.current;
    if (selectedTemplate.config.device === "phone") {
      const orientation = selectedTemplate.config.orientation || "portrait";
      return { width: orientation === "portrait" ? 380 : 780, height: orientation === "portrait" ? 780 : 380 };
    }
    if (selectedTemplate.config.device === "ipad") return { width: 1024, height: 768 };
    if (selectedTemplate.config.device === "macbook") return { width: 1280, height: 800 };
    if (selectedTemplate.config.device === "browser") return { width: 1200, height: 675 };
    return { width: 0, height: 0 };
  };

  // Apply a fill transform and force re-render
  const applyFillTransform = (transform: ImageTransform) => {
    setImageTransform(transform);
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      setTimeout(() => {
        if (canvas && image && selectedTemplate) {
          const renderTemplate = selectedTemplate.type === "device" && activeBackground
            ? { ...selectedTemplate, config: { ...selectedTemplate.config, _background: activeBackground, _screenBgColor: screenBgColor } }
            : selectedTemplate.type === "device"
            ? { ...selectedTemplate, config: { ...selectedTemplate.config, _screenBgColor: screenBgColor } }
            : selectedTemplate;
          applyTemplate(canvas, image, renderTemplate, customWatermark, transform, isPaid).catch(err => {
            console.error('Failed to apply template:', err);
          });
        }
      }, 0);
    }
  };

  const handleFillScreen = () => {
    if (!selectedTemplate?.config?.device || !image) return;
    applyFillTransform({ scale: 1, x: 0, y: 0 });
  };

  const handleFillHorizontal = () => {
    if (!selectedTemplate?.config?.device || !image) return;
    const { width: sw, height: sh } = getScreenDimensions();
    const coverScale = Math.max(sw / image.width, sh / image.height);
    const widthScale = sw / image.width;
    const relativeScale = widthScale / coverScale;
    applyFillTransform({ scale: relativeScale, x: 0, y: 0 });
  };

  const handleFillVertical = () => {
    if (!selectedTemplate?.config?.device || !image) return;
    const { width: sw, height: sh } = getScreenDimensions();
    const coverScale = Math.max(sw / image.width, sh / image.height);
    const heightScale = sh / image.height;
    const relativeScale = heightScale / coverScale;
    applyFillTransform({ scale: relativeScale, x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedTemplate?.config?.device) return;
    setIsTransforming(true);
    transformStartRef.current = { x: e.clientX - imageTransform.x, y: e.clientY - imageTransform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isTransforming || !transformStartRef.current) return;
    const startX = transformStartRef.current.x;
    const startY = transformStartRef.current.y;
    setImageTransform(prev => ({
      ...prev,
      x: e.clientX - startX,
      y: e.clientY - startY
    }));
  };

  const handleMouseUp = () => {
    setIsTransforming(false);
    transformStartRef.current = null;
  };

  // Handle manage subscription (logged-in paid users)
  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('An error occurred. Please try again.');
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  // Download handler — dual path: logged-in (DB) vs anonymous (localStorage)
  const handleDownload = async () => {
    if (user) {
      // Logged-in path: check DB subscription/usage
      if (!isPaid) {
        const count = await getDbUsageCount(user.id);
        if (count >= FREE_LIMIT) {
          setShowPaywall(true);
          return;
        }
      }

      // Export the canvas
      if (canvasRef.current) {
        exportCanvas(canvasRef.current, "appshot-pro");
        if (!isPaid) {
          await incrementDbUsage(user.id);
        }
      }
    } else {
      // Anonymous path: localStorage usage tracking
      if (hasHitFreeLimit()) {
        setShowPaywall(true);
        return;
      }

      if (canvasRef.current) {
        exportCanvas(canvasRef.current, "appshot-pro");
        incrementLocalUsage();
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <span>←</span> Back
          </button>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            AppShot Pro
          </h2>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs text-gray-400 hidden sm:inline">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-400 hover:text-white transition-colors border border-gray-700 px-3 py-1.5 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={onAuthRequired}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/30 px-3 py-1.5 rounded-lg"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Canvas Area */}
        <div className="space-y-4">
          {/* Custom Watermark Input */}
          {image && (
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Custom Watermark (optional)
                </label>
                {isPaid && user && (
                  <button
                    onClick={handleManageSubscription}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors underline"
                  >
                    Manage Subscription
                  </button>
                )}
              </div>
              <input
                type="text"
                value={customWatermark}
                onChange={(e) => setCustomWatermark(e.target.value)}
                placeholder="Enter your custom watermark text..."
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <p className="text-xs text-gray-500 mt-2">
                {isPaid
                  ? "Adds your text at bottom center • Pro users have no forced watermark"
                  : `Adds your text at bottom center • "MyAppShot.com" branding shown at bottom right • ${user ? "Sign in tracked" : getRemainingExports() + " free exports remaining this month"}`
                }
              </p>
            </div>
          )}

          {!image ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
                transition-all
                ${isDragging
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                }
              `}
            >
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-semibold mb-2">Drop your screenshot here</h3>
              <p className="text-gray-400 mb-4">or click to browse</p>
              <p className="text-sm text-gray-500">You can also paste (Ctrl/Cmd + V)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Instructions for device frames */}
              {selectedTemplate?.config?.device && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm text-purple-300">
                    <strong>🖼️ Device Controls:</strong> Drag to reposition • Use zoom slider • Fill buttons to auto-fit
                  </p>
                </div>
              )}

              {/* Preview Canvas */}
              <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
                <div className="flex items-center justify-center gap-6">
                  {/* Zoom Slider */}
                  {selectedTemplate?.config?.device && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={handleFillHorizontal}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2 py-1.5 rounded transition-colors font-medium"
                          title="Fill left and right edges"
                        >
                          Fill H
                        </button>
                        <button
                          onClick={handleFillVertical}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2 py-1.5 rounded transition-colors font-medium"
                          title="Fill top and bottom edges"
                        >
                          Fill V
                        </button>
                        <button
                          onClick={handleFillScreen}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2 py-1.5 rounded transition-colors font-medium"
                          title="Fill entire screen (may crop edges)"
                        >
                          Fill All
                        </button>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-400">Screen</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setScreenBgColor("#000000")}
                            className={`w-5 h-5 rounded border-2 bg-black ${screenBgColor === "#000000" ? "border-purple-500" : "border-gray-600"}`}
                            title="Black screen background"
                          />
                          <button
                            onClick={() => setScreenBgColor("#ffffff")}
                            className={`w-5 h-5 rounded border-2 bg-white ${screenBgColor === "#ffffff" ? "border-purple-500" : "border-gray-600"}`}
                            title="White screen background"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2 bg-gray-900/50 rounded-lg p-3">
                        <span className="text-xs text-gray-400">Zoom</span>
                        <input
                          type="range"
                          min="0.5"
                          max="3"
                          step="0.1"
                          value={imageTransform.scale}
                          onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                          className="slider-vertical"
                        />
                        <span className="text-xs text-gray-500">{imageTransform.scale.toFixed(1)}x</span>
                      </div>
                    </div>
                  )}

                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`max-w-full h-auto rounded-lg shadow-2xl ${
                      selectedTemplate?.config?.device ? "cursor-move" : ""
                    }`}
                    style={{ touchAction: "none" }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleDownload}
                  disabled={!selectedTemplate}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  Download PNG
                </button>
                <button
                  onClick={() => {
                    setImage(null);
                    setSelectedTemplate(null);
                  }}
                  className="bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
                >
                  New Screenshot
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Template Selector Sidebar */}
        {image && (
          <div className="lg:sticky lg:top-8 h-fit">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleTemplateChange}
              activeBackground={activeBackground}
            />
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        user={user}
        onAuthRequired={onAuthRequired}
      />
    </div>
  );
}

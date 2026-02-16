"use client";

import { useState, useRef, useEffect } from "react";
import TemplateSelector from "./TemplateSelector";
import PaywallModal from "./PaywallModal";
import { applyTemplate, exportCanvas } from "@/utils/canvas";
import { isPaidUser, hasHitFreeLimit, incrementUsage, getRemainingExports, getSubscriptionId, getCustomerId, revokePaid, isVerificationCached, updateVerificationCache } from "@/utils/freebie";

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

export default function ScreenshotEditor({ onBack }: { onBack: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [customWatermark, setCustomWatermark] = useState("");
  const [imageTransform, setImageTransform] = useState<ImageTransform>({ scale: 1, x: 0, y: 0 });
  const [isTransforming, setIsTransforming] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transformStartRef = useRef<{ x: number; y: number } | null>(null);

  // Check payment status on mount
  useEffect(() => {
    setIsPaid(isPaidUser());
  }, []);

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        // Auto-select first gradient template if no template is selected
        if (!selectedTemplate) {
          setSelectedTemplate({
            id: "gradient-purple",
            name: "Purple Dream",
            type: "gradient",
            config: { colors: ["#667eea", "#764ba2"], angle: 135 }
          });
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

  // Render canvas when image or template changes
  useEffect(() => {
    if (image && canvasRef.current && selectedTemplate) {
      // applyTemplate is now async, so we need to call it properly
      applyTemplate(canvasRef.current, image, selectedTemplate, customWatermark, imageTransform, isPaid).catch(err => {
        console.error('Failed to apply template:', err);
      });
    }
  }, [image, selectedTemplate, customWatermark, imageTransform, isPaid]);

  // Reset transform when template changes
  useEffect(() => {
    if (selectedTemplate?.config?.device) {
      setImageTransform({ scale: 1, x: 0, y: 0 });
    }
  }, [selectedTemplate?.id]);

  // Auto-fill when device template is selected or when image is uploaded with device template active
  useEffect(() => {
    if (image && selectedTemplate?.config?.device) {
      // Delay slightly to ensure canvas is rendered
      const timer = setTimeout(() => {
        handleFillImage();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [image, selectedTemplate?.id]);

  // Handle Fill button - auto-fill image to device screen (cover, not contain)
  const handleFillImage = () => {
    if (selectedTemplate?.config?.device && image) {
      // Use real screen dimensions if available (from loaded PNG frame)
      // Otherwise fall back to hardcoded dimensions
      let screenWidth, screenHeight;
      
      if (selectedTemplate.config._realScreenDimensions) {
        screenWidth = selectedTemplate.config._realScreenDimensions.width;
        screenHeight = selectedTemplate.config._realScreenDimensions.height;
      } else if (selectedTemplate.config.device === "phone") {
        const orientation = selectedTemplate.config.orientation || "portrait";
        screenWidth = orientation === "portrait" ? 380 : 780;
        screenHeight = orientation === "portrait" ? 780 : 380;
      } else if (selectedTemplate.config.device === "ipad") {
        screenWidth = 1024;
        screenHeight = 768;
      } else if (selectedTemplate.config.device === "macbook") {
        screenWidth = 1280;
        screenHeight = 800;
      } else if (selectedTemplate.config.device === "browser") {
        screenWidth = 1200;
        screenHeight = 675;
      }
      
      // Calculate scale to fill (cover) the screen
      // drawImageInPhone calculates baseScale as Math.min (fit mode)
      // We want to cover, so we calculate the ratio between cover and fit
      const fitScale = Math.min(screenWidth / image.width, screenHeight / image.height);
      const coverScale = Math.max(screenWidth / image.width, screenHeight / image.height);
      
      // transform.scale is relative to baseScale (fit), so we need cover/fit ratio
      const relativeScale = coverScale / fitScale;
      
      // Align top of image with top of screen frame
      // Both phone and other devices center the image by default
      // Positive y moves image down, so we need negative to move up... no:
      // For all devices, transform.y = (scaledH - screenH)/2 aligns top
      const scaledHeight = image.height * fitScale * relativeScale;
      const yOffset = (scaledHeight - screenHeight) / 2;
      
      setImageTransform({ 
        scale: relativeScale, 
        x: 0, 
        y: yOffset
      });
      
      // Force canvas re-render
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        setTimeout(() => {
          if (canvas && image && selectedTemplate) {
            applyTemplate(canvas, image, selectedTemplate, customWatermark, { scale: relativeScale, x: 0, y: yOffset }, isPaid).catch(err => {
              console.error('Failed to apply template:', err);
            });
          }
        }, 0);
      }
    }
  };

  // Handle mouse down for dragging (all device frames)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedTemplate?.config?.device) return;
    
    setIsTransforming(true);
    transformStartRef.current = { x: e.clientX - imageTransform.x, y: e.clientY - imageTransform.y };
  };

  // Handle mouse move for dragging
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

  // Handle mouse up
  const handleMouseUp = () => {
    setIsTransforming(false);
    transformStartRef.current = null;
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    const customerId = getCustomerId();
    
    if (!customerId) {
      alert('Customer information not found. Please contact support.');
      return;
    }
    
    try {
      const response = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe billing portal
        window.location.href = data.url;
      } else {
        alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('An error occurred. Please try again.');
    }
  };

  // Download handler
  const handleDownload = async () => {
    // Verify subscription if user is marked as paid
    if (isPaid) {
      const subscriptionId = getSubscriptionId();
      
      // If we have a subscription ID, verify it (unless cached within last hour)
      if (subscriptionId && !isVerificationCached()) {
        try {
          const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription_id: subscriptionId }),
          });
          
          const data = await response.json();
          
          if (!data.active) {
            // Subscription is no longer active
            revokePaid();
            setIsPaid(false);
            alert('Your subscription is no longer active. Please renew to continue using Pro features.');
            setShowPaywall(true);
            return;
          }
          
          // Cache the verification
          updateVerificationCache();
        } catch (error) {
          console.error('Failed to verify subscription:', error);
          // Continue anyway - don't block export on verification failure
        }
      }
    }
    
    // Check if user has hit free limit
    if (!isPaid && hasHitFreeLimit()) {
      setShowPaywall(true);
      return;
    }

    // Export the canvas
    if (canvasRef.current) {
      exportCanvas(canvasRef.current, "appshot-pro");
      
      // Increment usage count for free users
      if (!isPaid) {
        incrementUsage();
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
          <div className="w-20"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Main Canvas Area */}
        <div className="space-y-4">
          {/* Custom Watermark Input - Always visible when image is loaded */}
          {image && (
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Custom Watermark (optional)
                </label>
                {isPaid && getCustomerId() && (
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
                  : `Adds your text at bottom center • "AppShot Free" branding shown at bottom right • ${getRemainingExports()} free exports remaining this month`
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
                    <strong>🖼️ Device Controls:</strong> Drag to reposition • Use zoom slider on the left • Click "Fill" to auto-fit
                  </p>
                </div>
              )}

              {/* Preview Canvas */}
              <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700">
                <div className="flex items-center justify-center gap-6">
                  {/* Zoom Slider - shown for all device frames */}
                  {selectedTemplate?.config?.device && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleFillImage}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded transition-colors font-medium"
                        title="Auto-fit image to screen"
                      >
                        Fill
                      </button>
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
              onSelectTemplate={setSelectedTemplate}
            />
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}

"use client";

import { useState } from "react";

interface Template {
  id: string;
  name: string;
  type: "gradient" | "solid" | "device";
  config: any;
}

const templates: Template[] = [
  // Apple-style premium gradients with multi-stop depth
  {
    id: "gradient-purple-pink",
    name: "Purple Dream",
    type: "gradient",
    config: { colors: ["#4c1d95", "#ec4899", "#fce7f3"], angle: 135 } // deep purple → soft pink → white
  },
  {
    id: "gradient-navy-mint",
    name: "Ocean Breeze",
    type: "gradient",
    config: { colors: ["#1e3a8a", "#14b8a6", "#d1fae5"], angle: 120 } // navy blue → teal → mint
  },
  {
    id: "gradient-sunset",
    name: "Sunset Glow",
    type: "gradient",
    config: { colors: ["#ea580c", "#fdba74", "#fef3c7"], angle: 135 } // orange → peach → cream
  },
  {
    id: "gradient-violet-rose",
    name: "Violet Rose",
    type: "gradient",
    config: { colors: ["#581c87", "#db2777", "#fce7f3"], angle: 120 } // dark violet → magenta → light rose
  },
  {
    id: "gradient-forest",
    name: "Forest Mist",
    type: "gradient",
    config: { colors: ["#14532d", "#10b981", "#d1fae5"], angle: 135 } // forest green → emerald → light sage
  },
  {
    id: "gradient-coral",
    name: "Coral Dream",
    type: "gradient",
    config: { colors: ["#991b1b", "#fb7185", "#fed7aa"], angle: 120 } // deep red → coral → warm peach
  },
  {
    id: "gradient-midnight",
    name: "Midnight Sky",
    type: "gradient",
    config: { colors: ["#1e1b4b", "#7c3aed", "#ddd6fe"], angle: 135 } // midnight blue → purple → lavender
  },
  {
    id: "gradient-gold",
    name: "Golden Hour",
    type: "gradient",
    config: { colors: ["#b45309", "#fbbf24", "#fef3c7"], angle: 120 } // gold → amber → soft yellow
  },
  // Device Mockups
  {
    id: "device-browser",
    name: "Browser Window",
    type: "device",
    config: { device: "browser" }
  },
  {
    id: "device-phone",
    name: "iPhone Frame",
    type: "device",
    config: { device: "phone", orientation: "portrait" }
  },
  {
    id: "device-ipad",
    name: "iPad Pro",
    type: "device",
    config: { device: "ipad" }
  },
  {
    id: "device-macbook",
    name: "MacBook Pro",
    type: "device",
    config: { device: "macbook" }
  },
];

export default function TemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  activeBackground,
}: {
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
  activeBackground?: Template | null;
}) {
  const [phoneOrientation, setPhoneOrientation] = useState<"portrait" | "landscape">("portrait");

  const handlePhoneOrientationToggle = () => {
    const newOrientation = phoneOrientation === "portrait" ? "landscape" : "portrait";
    setPhoneOrientation(newOrientation);
    
    // If iPhone is currently selected, update the template with new orientation
    if (selectedTemplate?.config?.device === "phone") {
      const updatedTemplate = {
        ...selectedTemplate,
        config: { ...selectedTemplate.config, orientation: newOrientation }
      };
      onSelectTemplate(updatedTemplate);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    // If clicking the same template, deselect it (go back to no device frame)
    if (selectedTemplate?.id === template.id && template.type === "device") {
      // Find a gradient background to fall back to
      const fallbackGradient = templates.find(t => t.type === "gradient");
      if (fallbackGradient) {
        onSelectTemplate(fallbackGradient);
      }
      return;
    }
    
    // If selecting iPhone template, apply current orientation
    if (template.config?.device === "phone") {
      const updatedTemplate = {
        ...template,
        config: { ...template.config, orientation: phoneOrientation }
      };
      onSelectTemplate(updatedTemplate);
    } else {
      onSelectTemplate(template);
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
      
      <div className="space-y-6">
        {/* Gradients */}
        <div>
          <h4 className="text-sm text-gray-400 mb-3 font-medium">Backgrounds</h4>
          <div className="grid grid-cols-2 gap-3">
            {templates.filter(t => t.type === "gradient" || t.type === "solid").map((template) => {
              // Highlight based on activeBackground (persists even when device is selected)
              const isActive = activeBackground ? activeBackground.id === template.id : selectedTemplate?.id === template.id;
              return (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`
                  p-3 rounded-lg border-2 transition-all text-left
                  ${isActive
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-gray-700 hover:border-gray-600 bg-gray-900/50"
                  }
                `}
              >
                {template.type === "gradient" ? (
                  <div
                    className="w-full h-12 rounded mb-2"
                    style={{
                      background: `linear-gradient(${template.config.angle}deg, ${template.config.colors.join(", ")})`
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-12 rounded mb-2 border border-gray-700"
                    style={{ background: template.config.color }}
                  />
                )}
                <p className="text-sm font-medium">{template.name}</p>
              </button>
              );
            })}
          </div>
        </div>

        {/* Device Mockups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm text-gray-400 font-medium">Device Frames</h4>
            <span className="text-xs text-gray-500" title="Click active device again to deselect">💡 Click to toggle</span>
          </div>
          <div className="space-y-2">
            {templates.filter(t => t.type === "device").map((template) => (
              <div key={template.id}>
                <button
                  onClick={() => handleTemplateSelect(template)}
                  className={`
                    w-full p-3 rounded-lg border-2 transition-all text-left
                    ${selectedTemplate?.id === template.id
                      ? "border-purple-500 bg-purple-500/20"
                      : "border-gray-700 hover:border-gray-600 bg-gray-900/50"
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {template.config.device === "browser" && "🌐"}
                        {template.config.device === "phone" && "📱"}
                        {template.config.device === "ipad" && "📱"}
                        {template.config.device === "macbook" && "💻"}
                      </div>
                      <p className="text-sm font-medium">{template.name}</p>
                    </div>
                    
                    {/* iPhone orientation toggle */}
                    {template.config.device === "phone" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhoneOrientationToggle();
                        }}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        title="Toggle orientation"
                      >
                        {phoneOrientation === "portrait" ? "⬆️ Portrait" : "↔️ Landscape"}
                      </button>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Free Tier Notice */}
      <div className="mt-6 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
        <p className="text-xs text-gray-400">
          <span className="text-purple-400 font-semibold">Free Tier:</span> 10 screenshots/month
          <br />
          <span className="text-gray-500 text-[10px]">Includes "AppShot Free" watermark</span>
        </p>
      </div>
    </div>
  );
}

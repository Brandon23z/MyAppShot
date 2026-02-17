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

interface DeviceFrameTemplate {
  frame: string;
  mask: string;
  screen: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  frameSize: {
    width: number;
    height: number;
  };
}

// Cache for loaded device frames
const deviceFrameCache: { [key: string]: { image: HTMLImageElement; template: DeviceFrameTemplate } } = {};

// Load device frame PNG and template JSON
async function loadDeviceFrame(framePath: string): Promise<{ image: HTMLImageElement; template: DeviceFrameTemplate } | null> {
  // Check cache first
  if (deviceFrameCache[framePath]) {
    return deviceFrameCache[framePath];
  }

  try {
    // Load template JSON
    const templateResponse = await fetch(framePath.replace('.png', '.json'));
    if (!templateResponse.ok) return null;
    const template: DeviceFrameTemplate = await templateResponse.json();

    // Load frame image
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = framePath;
    });

    // Cache and return
    deviceFrameCache[framePath] = { image, template };
    return { image, template };
  } catch (error) {
    console.error('Failed to load device frame:', error);
    return null;
  }
}

export async function applyTemplate(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  template: Template,
  customWatermark: string = "",
  imageTransform: ImageTransform = { scale: 1, x: 0, y: 0 },
  isPaid: boolean = false
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const padding = 100;
  
  // Set canvas size based on template type
  if (template.type === "device") {
    if (template.config.device === "phone") {
      const orientation = template.config.orientation || "portrait";
      
      // ALWAYS use real PNG device frame (both portrait and landscape)
      const framePath = '/device-frames/iphone-16-pro-max-black.png';
      const deviceFrame = await loadDeviceFrame(framePath);
      
      if (deviceFrame) {
        // Use real PNG device frame (rotated for landscape)
        const { image: frameImage, template: frameTemplate } = deviceFrame;
        
        // Scale factor to make the frame fit nicely on screen
        const displayScale = orientation === "portrait" ? 0.22 : 0.28;
        
        // For landscape: swap width and height since we're rotating 90°
        const canvasWidth = orientation === "portrait" 
          ? frameTemplate.frameSize.width * displayScale
          : frameTemplate.frameSize.height * displayScale;
        const canvasHeight = orientation === "portrait"
          ? frameTemplate.frameSize.height * displayScale
          : frameTemplate.frameSize.width * displayScale;
        
        canvas.width = canvasWidth + padding * 2;
        canvas.height = canvasHeight + padding * 2;
        
        // Draw background
        drawBackground(ctx, canvas, template);
        
        if (orientation === "portrait") {
          // Portrait mode - draw normally
          const screenX = padding + (frameTemplate.screen.x * displayScale);
          const screenY = padding + (frameTemplate.screen.y * displayScale);
          const screenWidth = frameTemplate.screen.width * displayScale;
          const screenHeight = frameTemplate.screen.height * displayScale;
          
          // Store screen dimensions in template config for Fill button
          template.config._realScreenDimensions = {
            width: screenWidth,
            height: screenHeight
          };
          
          drawImageInPhoneReal(ctx, image, screenX, screenY, screenWidth, screenHeight, imageTransform, orientation);
          
          // Draw device frame on top
          ctx.drawImage(frameImage, padding, padding, canvasWidth, canvasHeight);
        } else {
          // Landscape mode - rotate the PNG 90° clockwise
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          
          // Calculate rotated screen area (90° clockwise rotation)
          // In portrait, screen rect is at (sx, sy, sw, sh) within frame (fw, fh)
          // After 90° CW rotation: 
          //   new_x maps from original y
          //   new_y maps from (frame_width - original_x - original_screen_width)
          const origSX = frameTemplate.screen.x;
          const origSY = frameTemplate.screen.y;
          const origSW = frameTemplate.screen.width;
          const origSH = frameTemplate.screen.height;
          const origFW = frameTemplate.frameSize.width;
          const origFH = frameTemplate.frameSize.height;
          
          // After 90° CW, frame occupies canvasWidth x canvasHeight centered on canvas
          // The frame is drawn centered, so offset from top-left of frame area:
          const frameLeft = (canvas.width - canvasWidth) / 2;
          const frameTop = (canvas.height - canvasHeight) / 2;
          
          // Rotated screen coords within the rotated frame
          const screenX = frameLeft + (origSY / origFH) * canvasWidth;
          const screenY = frameTop + ((origFW - origSX - origSW) / origFW) * canvasHeight;
          const screenWidth = (origSH / origFH) * canvasWidth;
          const screenHeight = (origSW / origFW) * canvasHeight;
          
          // Store screen dimensions for Fill button
          template.config._realScreenDimensions = {
            width: screenWidth,
            height: screenHeight
          };
          
          // Draw user image first (with rotated clipping)
          drawImageInPhoneReal(ctx, image, screenX, screenY, screenWidth, screenHeight, imageTransform, orientation);
          
          // Draw device frame rotated 90° clockwise
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(Math.PI / 2); // 90° clockwise
          // After rotation, we draw using ORIGINAL (portrait) dimensions
          // The rotation transform handles the visual swap
          const origW = frameTemplate.frameSize.width * displayScale;
          const origH = frameTemplate.frameSize.height * displayScale;
          ctx.drawImage(
            frameImage,
            -origW / 2,
            -origH / 2,
            origW,
            origH
          );
          ctx.restore();
        }
      } else {
        // Fallback to canvas-drawn frame (for landscape or if PNG fails to load)
        const orientation = template.config.orientation || "portrait";
        const phoneWidth = orientation === "portrait" ? 380 : 780;
        const phoneHeight = orientation === "portrait" ? 780 : 380;
        
        // Store screen dimensions for Fill button
        template.config._realScreenDimensions = {
          width: phoneWidth,
          height: phoneHeight
        };
        
        canvas.width = phoneWidth + padding * 2 + 100;
        canvas.height = phoneHeight + padding * 2 + 100;
        
        // Draw background
        drawBackground(ctx, canvas, template);
        
        // Draw iPhone frame
        drawPhoneFrame(ctx, canvas.width / 2, canvas.height / 2, phoneWidth, phoneHeight, orientation);
        
        // Draw image inside phone with transform
        drawImageInPhone(ctx, image, canvas.width / 2, canvas.height / 2, phoneWidth, phoneHeight, imageTransform, orientation);
      }
    } else if (template.config.device === "ipad") {
      // iPad Pro mockup - landscape orientation, using PNG frame
      const framePath = '/device-frames/ipad-pro-13-landscape-silver.png';
      const deviceFrame = await loadDeviceFrame(framePath);
      
      if (deviceFrame) {
        const { image: frameImage, template: frameTemplate } = deviceFrame;
        
        // Scale factor to make the frame fit nicely on screen
        const displayScale = 0.35;
        
        const canvasWidth = frameTemplate.frameSize.width * displayScale;
        const canvasHeight = frameTemplate.frameSize.height * displayScale;
        
        canvas.width = canvasWidth + padding * 2;
        canvas.height = canvasHeight + padding * 2;
        
        // Draw background
        drawBackground(ctx, canvas, template);
        
        // Calculate screen coordinates
        const screenX = padding + (frameTemplate.screen.x * displayScale);
        const screenY = padding + (frameTemplate.screen.y * displayScale);
        const screenWidth = frameTemplate.screen.width * displayScale;
        const screenHeight = frameTemplate.screen.height * displayScale;
        
        // Store screen dimensions for Fill button
        template.config._realScreenDimensions = {
          width: screenWidth,
          height: screenHeight
        };
        
        // Draw user image in screen area
        drawImageInDeviceScreen(ctx, image, screenX, screenY, screenWidth, screenHeight, imageTransform, 40);
        
        // Draw device frame on top
        ctx.drawImage(frameImage, padding, padding, canvasWidth, canvasHeight);
      } else {
        // Fallback if PNG fails to load
        const ipadWidth = 1024;
        const ipadHeight = 768;
        
        canvas.width = ipadWidth + padding * 2;
        canvas.height = ipadHeight + padding * 2;
        
        drawBackground(ctx, canvas, template);
        
        template.config._realScreenDimensions = {
          width: ipadWidth,
          height: ipadHeight
        };
        
        // Simple fallback rendering
        const x = padding;
        const y = padding;
        ctx.fillStyle = "#000000";
        ctx.fillRect(x, y, ipadWidth, ipadHeight);
        
        const baseScale = Math.min(ipadWidth / image.width, ipadHeight / image.height);
        const scaledWidth = image.width * baseScale * imageTransform.scale;
        const scaledHeight = image.height * baseScale * imageTransform.scale;
        const imageX = x + (ipadWidth - scaledWidth) / 2 + imageTransform.x;
        const imageY = y + (ipadHeight - scaledHeight) / 2 + imageTransform.y;
        
        ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
      }
    } else if (template.config.device === "macbook") {
      // MacBook Pro mockup - screen is 16:10
      const macbookScreenW = 1280;
      const macbookScreenH = 800;
      const mbBezelTop = 28;
      const mbBezelSide = 14;
      const mbBezelBottom = 14;
      const mbLidW = macbookScreenW + mbBezelSide * 2;
      const mbLidH = macbookScreenH + mbBezelTop + mbBezelBottom;
      
      canvas.width = mbLidW + padding * 2 + 80;
      canvas.height = mbLidH + padding * 2 + 80;
      
      // Draw background
      drawBackground(ctx, canvas, template);
      
      const macCenterX = canvas.width / 2;
      const macCenterY = canvas.height / 2;
      
      // Draw MacBook frame
      drawMacBookFrame(ctx, macCenterX, macCenterY, macbookScreenW, macbookScreenH);
      
      // Screen area coordinates (must match drawMacBookFrame)
      const macLidX = macCenterX - mbLidW / 2;
      const macLidY = macCenterY - mbLidH / 2 - 20;
      const screenX = macLidX + mbBezelSide;
      const screenY = macLidY + mbBezelTop;
      
      // Store screen dimensions for Fill button
      template.config._realScreenDimensions = { width: macbookScreenW, height: macbookScreenH };
      
      // Draw image inside MacBook screen with transform support
      const baseScale = Math.min(macbookScreenW / image.width, macbookScreenH / image.height);
      const scaledWidth = image.width * baseScale * imageTransform.scale;
      const scaledHeight = image.height * baseScale * imageTransform.scale;
      const imageX = screenX + (macbookScreenW - scaledWidth) / 2 + imageTransform.x;
      const imageY = screenY + (macbookScreenH - scaledHeight) / 2 + imageTransform.y;
      
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(screenX, screenY, macbookScreenW, macbookScreenH, 2);
      ctx.clip();
      // Black background
      ctx.fillStyle = "#000000";
      ctx.fillRect(screenX, screenY, macbookScreenW, macbookScreenH);
      ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
      ctx.restore();
    } else {
      // Browser window - FIXED 16:9 content area + 40px title bar
      const browserWidth = 1200;
      const browserHeight = 675; // 16:9 content area
      const browserTitleBar = 40;
      
      canvas.width = browserWidth + padding * 2;
      canvas.height = browserHeight + browserTitleBar + padding * 2;
      // Total frame drawn by drawBrowserFrame = browserHeight + 40 (title bar)
      // Canvas = that + padding top/bottom
      
      // Draw background
      drawBackground(ctx, canvas, template);
      
      // Draw browser window
      const windowX = padding;
      const windowY = padding;
      drawBrowserFrame(ctx, windowX, windowY, browserWidth, browserHeight);
      
      // Store screen dimensions for Fill button
      // browserHeight IS the content area — drawBrowserFrame adds 40 for title bar on top
      template.config._realScreenDimensions = { width: browserWidth, height: browserHeight };
      
      // Draw image inside browser with transform support
      const baseScale = Math.min(browserWidth / image.width, browserHeight / image.height);
      const scaledWidth = image.width * baseScale * imageTransform.scale;
      const scaledHeight = image.height * baseScale * imageTransform.scale;
      const imageX = windowX + (browserWidth - scaledWidth) / 2 + imageTransform.x;
      const imageY = windowY + 40 + (browserHeight - scaledHeight) / 2 + imageTransform.y;
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(windowX, windowY + 40, browserWidth, browserHeight);
      ctx.clip();
      ctx.fillStyle = "#000000";
      ctx.fillRect(windowX, windowY + 40, browserWidth, browserHeight);
      ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
      ctx.restore();
    }
  } else {
    // Gradient or solid background
    const maxWidth = 1600;
    const scale = Math.min(maxWidth / image.width, 1);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    
    canvas.width = scaledWidth + padding * 2;
    canvas.height = scaledHeight + padding * 2;
    
    // Draw background
    drawBackground(ctx, canvas, template);
    
    // Draw shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    
    // Draw image with rounded corners
    const imageX = padding;
    const imageY = padding;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imageX, imageY, scaledWidth, scaledHeight, 12);
    ctx.clip();
    ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
    ctx.restore();
    
    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  
  // Add watermark (bigger and more visible)
  addWatermark(ctx, canvas, customWatermark, isPaid);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  template: Template
) {
  // If this is a device template with an attached background, use the background
  const bgSource = template.config?._background || template;
  
  if (bgSource.type === "gradient" && bgSource.config?.colors) {
    const angle = bgSource.config.angle || 135;
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width * Math.cos((angle * Math.PI) / 180),
      canvas.height * Math.sin((angle * Math.PI) / 180)
    );
    
    bgSource.config.colors.forEach((color: string, index: number) => {
      gradient.addColorStop(index / (bgSource.config.colors.length - 1), color);
    });
    
    ctx.fillStyle = gradient;
  } else if (bgSource.type === "solid" && bgSource.config?.color) {
    ctx.fillStyle = bgSource.config.color;
  } else {
    // Default gradient for device mockups - subtle and professional
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#667eea");
    gradient.addColorStop(1, "#764ba2");
    ctx.fillStyle = gradient;
  }
  
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBrowserFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  // Browser window shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  
  // Browser chrome background with subtle gradient
  const chromeGradient = ctx.createLinearGradient(x, y, x, y + 40);
  chromeGradient.addColorStop(0, "#353535");
  chromeGradient.addColorStop(1, "#2a2a2a");
  
  ctx.fillStyle = chromeGradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, 40, [12, 12, 0, 0]);
  ctx.fill();
  
  ctx.restore();
  
  // Traffic light buttons (macOS style) with shadows
  const buttonY = y + 15;
  const buttonSize = 12;
  
  // Red button
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  
  const redGradient = ctx.createRadialGradient(x + 14, buttonY - 1, 1, x + 15, buttonY, buttonSize / 2);
  redGradient.addColorStop(0, "#ff6b5f");
  redGradient.addColorStop(1, "#ff4f43");
  ctx.fillStyle = redGradient;
  ctx.beginPath();
  ctx.arc(x + 15, buttonY, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Yellow button
  const yellowGradient = ctx.createRadialGradient(x + 34, buttonY - 1, 1, x + 35, buttonY, buttonSize / 2);
  yellowGradient.addColorStop(0, "#ffca3a");
  yellowGradient.addColorStop(1, "#ffb020");
  ctx.fillStyle = yellowGradient;
  ctx.beginPath();
  ctx.arc(x + 35, buttonY, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Green button
  const greenGradient = ctx.createRadialGradient(x + 54, buttonY - 1, 1, x + 55, buttonY, buttonSize / 2);
  greenGradient.addColorStop(0, "#32d74b");
  greenGradient.addColorStop(1, "#28c940");
  ctx.fillStyle = greenGradient;
  ctx.beginPath();
  ctx.arc(x + 55, buttonY, buttonSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  // Address bar with depth
  const addressBarX = x + 80;
  const addressBarY = y + 10;
  const addressBarWidth = width - 100;
  const addressBarHeight = 20;
  
  // Address bar background
  ctx.fillStyle = "#1d1d1d";
  ctx.beginPath();
  ctx.roundRect(addressBarX, addressBarY, addressBarWidth, addressBarHeight, 5);
  ctx.fill();
  
  // Address bar inner shadow
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(addressBarX + 0.5, addressBarY + 0.5, addressBarWidth - 1, addressBarHeight - 1, 4.5);
  ctx.stroke();
  
  // Lock icon (HTTPS indicator)
  ctx.fillStyle = "#5a5a5a";
  ctx.font = "12px sans-serif";
  ctx.fillText("🔒", addressBarX + 8, addressBarY + 15);
  
  // Browser window border
  ctx.strokeStyle = "#4a4a4a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height + 40, 12);
  ctx.stroke();
  
  // Subtle inner highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, width - 2, height + 40 - 2, 11);
  ctx.stroke();
}

function drawPhoneFrame(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  orientation: "portrait" | "landscape" = "portrait"
) {
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  const cornerRadius = 48;
  const bezelWidth = 6; // Ultra-thin bezel for modern iPhone
  
  // Outer glow/shadow for premium depth
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 40;
  
  // Phone body - premium titanium finish with depth (iPhone 15 Pro Max style)
  const bodyGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, Math.max(width, height) / 1.5
  );
  bodyGradient.addColorStop(0, "#454545");
  bodyGradient.addColorStop(0.4, "#383838");
  bodyGradient.addColorStop(0.7, "#2d2d2d");
  bodyGradient.addColorStop(1, "#1f1f1f");
  
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.roundRect(x - bezelWidth, y - bezelWidth, width + bezelWidth * 2, height + bezelWidth * 2, cornerRadius);
  ctx.fill();
  
  ctx.restore();
  
  // Titanium edge band - multi-layer effect
  // Outer edge highlight
  const edgeGradient1 = ctx.createLinearGradient(x - bezelWidth, y, x + width + bezelWidth, y);
  edgeGradient1.addColorStop(0, "#656565");
  edgeGradient1.addColorStop(0.25, "#858585");
  edgeGradient1.addColorStop(0.5, "#959595");
  edgeGradient1.addColorStop(0.75, "#858585");
  edgeGradient1.addColorStop(1, "#656565");
  
  ctx.strokeStyle = edgeGradient1;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - bezelWidth + 1, y - bezelWidth + 1, width + bezelWidth * 2 - 2, height + bezelWidth * 2 - 2, cornerRadius - 1);
  ctx.stroke();
  
  // Inner edge shadow
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - bezelWidth + 3, y - bezelWidth + 3, width + bezelWidth * 2 - 6, height + bezelWidth * 2 - 6, cornerRadius - 3);
  ctx.stroke();
  
  // Screen bezel (ultra-thin black border)
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(x - 0.5, y - 0.5, width + 1, height + 1, cornerRadius - bezelWidth);
  ctx.stroke();
  
  // Dynamic Island - iPhone 14/15 Pro Max style with depth
  const islandWidth = 126;
  const islandHeight = 37;
  let islandX, islandY;
  
  if (orientation === "portrait") {
    islandX = centerX - islandWidth / 2;
    islandY = y + 6;
  } else {
    // Landscape - island on the left side (where camera would be)
    islandX = x + 6;
    islandY = centerY - islandWidth / 2;
  }
  
  // Island shadow/depth
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  if (orientation === "portrait") {
    ctx.roundRect(islandX, islandY, islandWidth, islandHeight, 18.5);
  } else {
    ctx.roundRect(islandX, islandY, islandHeight, islandWidth, 18.5);
  }
  ctx.fill();
  
  ctx.restore();
  
  // Island inner rim (subtle depth)
  ctx.strokeStyle = "rgba(20, 20, 20, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (orientation === "portrait") {
    ctx.roundRect(islandX + 1.5, islandY + 1.5, islandWidth - 3, islandHeight - 3, 17);
  } else {
    ctx.roundRect(islandX + 1.5, islandY + 1.5, islandHeight - 3, islandWidth - 3, 17);
  }
  ctx.stroke();
  
  if (orientation === "portrait") {
    // Volume up, Volume down, Silent/Action buttons (left side)
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(x - bezelWidth - 2, y + 120, 3, 28);  // Silent/Action
    ctx.fillRect(x - bezelWidth - 2, y + 165, 3, 48);  // Volume up
    ctx.fillRect(x - bezelWidth - 2, y + 230, 3, 48);  // Volume down
    
    // Power button (right side)
    ctx.fillRect(x + width + bezelWidth - 1, y + 180, 3, 68);
    
    // Button highlights (metallic effect)
    ctx.fillStyle = "#5a5a5a";
    ctx.fillRect(x - bezelWidth - 2, y + 120, 2, 2);
    ctx.fillRect(x - bezelWidth - 2, y + 165, 2, 2);
    ctx.fillRect(x - bezelWidth - 2, y + 230, 2, 2);
    ctx.fillRect(x + width + bezelWidth - 1, y + 180, 2, 2);
  } else {
    // Landscape mode (home button right, camera left):
    // 3 buttons (volume + silent) go on BOTTOM
    // Power button goes on TOP
    ctx.fillStyle = "#3a3a3a";
    
    // Volume and silent buttons (BOTTOM side in landscape)
    ctx.fillRect(x + 120, y + height + bezelWidth - 1, 28, 3);  // Silent/Action
    ctx.fillRect(x + 165, y + height + bezelWidth - 1, 48, 3);  // Volume up
    ctx.fillRect(x + 230, y + height + bezelWidth - 1, 48, 3);  // Volume down
    
    // Power button (TOP side in landscape)
    ctx.fillRect(x + 180, y - bezelWidth - 2, 68, 3);
    
    // Button highlights
    ctx.fillStyle = "#5a5a5a";
    ctx.fillRect(x + 120, y + height + bezelWidth - 1, 2, 2);
    ctx.fillRect(x + 165, y + height + bezelWidth - 1, 2, 2);
    ctx.fillRect(x + 230, y + height + bezelWidth - 1, 2, 2);
    ctx.fillRect(x + 180, y - bezelWidth - 2, 2, 2);
  }
}

// Generic function to draw image in device screen with clipping
function drawImageInDeviceScreen(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  screenX: number,
  screenY: number,
  screenWidth: number,
  screenHeight: number,
  transform: ImageTransform,
  cornerRadius: number = 37
) {
  // Create clipping path for screen area with rounded corners
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, cornerRadius);
  ctx.clip();
  
  // Fill screen background with WHITE
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  
  // Calculate scaled image dimensions
  const baseScale = Math.min(screenWidth / image.width, screenHeight / image.height);
  const finalScale = baseScale * transform.scale;
  const scaledWidth = image.width * finalScale;
  const scaledHeight = image.height * finalScale;
  
  // Calculate position with transform offset
  const screenCenterX = screenX + screenWidth / 2;
  const screenCenterY = screenY + screenHeight / 2;
  const imageCenterX = screenCenterX + transform.x;
  const imageCenterY = screenCenterY + transform.y;
  const imageX = imageCenterX - scaledWidth / 2;
  const imageY = imageCenterY - scaledHeight / 2;
  
  // Draw the image (will be clipped to rounded rectangle)
  ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
  
  ctx.restore();
}

// Draw image in real PNG device frame (screen coordinates based)
function drawImageInPhoneReal(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  screenX: number,
  screenY: number,
  screenWidth: number,
  screenHeight: number,
  transform: ImageTransform,
  orientation: "portrait" | "landscape" = "portrait"
) {
  // iPhone screen has rounded corners - need proper clipping radius
  const screenCornerRadius = 37;
  
  // Create clipping path for screen area with rounded corners
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, screenCornerRadius);
  ctx.clip();
  
  // Fill screen background with WHITE
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  
  // Calculate scaled image dimensions
  // Base scale fits the image to the screen (Math.min = fit/contain mode)
  const baseScale = Math.min(screenWidth / image.width, screenHeight / image.height);
  const finalScale = baseScale * transform.scale;
  const scaledWidth = image.width * finalScale;
  const scaledHeight = image.height * finalScale;
  
  // Calculate position with transform offset
  const screenCenterX = screenX + screenWidth / 2;
  const screenCenterY = screenY + screenHeight / 2;
  const imageCenterX = screenCenterX + transform.x;
  const imageCenterY = screenCenterY + transform.y;
  const imageX = imageCenterX - scaledWidth / 2;
  const imageY = imageCenterY - scaledHeight / 2;
  
  // Draw the image (will be clipped to rounded rectangle)
  ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
  
  ctx.restore();
}

function drawImageInPhone(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  phoneWidth: number,
  phoneHeight: number,
  transform: ImageTransform,
  orientation: "portrait" | "landscape" = "portrait"
) {
  const x = centerX - phoneWidth / 2;
  const y = centerY - phoneHeight / 2;
  const bezelWidth = 8; // Match the new thinner bezel
  
  let screenX, screenY, screenWidth, screenHeight;
  
  // Screen area with thin bezels (just accounting for the physical bezel)
  screenX = x;
  screenY = y;
  screenWidth = phoneWidth;
  screenHeight = phoneHeight;
  
  const cornerRadius = 37;
  
  // Create clipping path for screen area with rounded corners
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, cornerRadius);
  ctx.clip();
  
  // Fill screen background with WHITE
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  
  // Calculate scaled image dimensions
  const baseScale = Math.min(screenWidth / image.width, screenHeight / image.height);
  const finalScale = baseScale * transform.scale;
  const scaledWidth = image.width * finalScale;
  const scaledHeight = image.height * finalScale;
  
  // Calculate position with transform offset
  const imageCenterX = centerX + transform.x;
  const imageCenterY = centerY + transform.y;
  const imageX = imageCenterX - scaledWidth / 2;
  const imageY = imageCenterY - scaledHeight / 2;
  
  // Draw the image (will be clipped to rounded rectangle)
  ctx.drawImage(image, imageX, imageY, scaledWidth, scaledHeight);
  
  ctx.restore();
  
  // Premium glass screen reflection effect
  const reflectionGradient = ctx.createLinearGradient(screenX, screenY, screenX, screenY + screenHeight);
  reflectionGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  reflectionGradient.addColorStop(0.3, "rgba(255, 255, 255, 0.02)");
  reflectionGradient.addColorStop(0.7, "rgba(0, 0, 0, 0.02)");
  reflectionGradient.addColorStop(1, "rgba(0, 0, 0, 0.12)");
  
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, cornerRadius);
  ctx.clip();
  ctx.fillStyle = reflectionGradient;
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  
  // Subtle light reflection in top-left corner
  const cornerGlow = ctx.createRadialGradient(screenX + 60, screenY + 60, 0, screenX + 60, screenY + 60, 150);
  cornerGlow.addColorStop(0, "rgba(255, 255, 255, 0.06)");
  cornerGlow.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
  cornerGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = cornerGlow;
  ctx.fillRect(screenX, screenY, screenWidth, screenHeight);
  
  ctx.restore();
}

function drawMacBookFrame(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number
) {
  const screenWidth = width;
  const screenHeight = height;
  const bezelTop = 28;
  const bezelSide = 14;
  const bezelBottom = 14;
  const lidWidth = screenWidth + bezelSide * 2;
  const lidHeight = screenHeight + bezelTop + bezelBottom;
  const x = centerX - lidWidth / 2;
  const y = centerY - lidHeight / 2 - 20;
  const cornerRadius = 12;
  
  // === LID (screen portion) ===
  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 20;

  // Lid body — Silver aluminum (realistic MacBook color)
  const lidGrad = ctx.createLinearGradient(x, y, x, y + lidHeight);
  lidGrad.addColorStop(0, "#d4d4d8");
  lidGrad.addColorStop(0.3, "#c0c0c4");
  lidGrad.addColorStop(0.6, "#b8b8bc");
  lidGrad.addColorStop(1, "#a8a8ac");
  ctx.fillStyle = lidGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, lidWidth, lidHeight, cornerRadius);
  ctx.fill();
  ctx.restore();

  // Lid edge highlight (top) — bright aluminum edge
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + cornerRadius, y + 0.5);
  ctx.lineTo(x + lidWidth - cornerRadius, y + 0.5);
  ctx.stroke();

  // Lid outer border — subtle dark edge
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, lidWidth, lidHeight, cornerRadius);
  ctx.stroke();
  
  // Notch / camera area
  const notchW = 160;
  const notchH = 18;
  const notchX = centerX - notchW / 2;
  const notchY = y;
  ctx.fillStyle = "#2c2c2e";
  ctx.beginPath();
  ctx.roundRect(notchX, notchY, notchW, notchH, [0, 0, 8, 8]);
  ctx.fill();

  // Camera dot
  ctx.fillStyle = "#0a0a12";
  ctx.beginPath();
  ctx.arc(centerX, notchY + notchH / 2 + 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(40, 50, 80, 0.4)";
  ctx.beginPath();
  ctx.arc(centerX - 0.5, notchY + notchH / 2 + 1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // === SCREEN AREA (black background by default) ===
  const screenX = x + bezelSide;
  const screenY = y + bezelTop;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 2);
  ctx.fill();

  // Inner screen border
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(screenX, screenY, screenWidth, screenHeight, 2);
  ctx.stroke();
  
  // === BASE / KEYBOARD SECTION ===
  const baseGap = 3;
  const baseY2 = y + lidHeight + baseGap;
  const baseHeight = 28;
  const baseWidthTop = lidWidth;
  const baseWidthBottom = lidWidth + 60;

  // Hinge — dark shadow line between lid and base
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x + 2, y + lidHeight, lidWidth - 4, 1);
  ctx.fillStyle = "rgba(180,180,184,1)";
  ctx.fillRect(x + 2, y + lidHeight + 1, lidWidth - 4, baseGap - 1);

  // Base body — tapered trapezoid
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;

  const bLeft = centerX - baseWidthBottom / 2;
  const bRight = centerX + baseWidthBottom / 2;
  const bTopLeft = centerX - baseWidthTop / 2;
  const bTopRight = centerX + baseWidthTop / 2;

  const baseGrad = ctx.createLinearGradient(0, baseY2, 0, baseY2 + baseHeight);
  baseGrad.addColorStop(0, "#c8c8cc");
  baseGrad.addColorStop(0.15, "#bababd");
  baseGrad.addColorStop(0.5, "#adadb0");
  baseGrad.addColorStop(0.85, "#a0a0a4");
  baseGrad.addColorStop(1, "#909094");

  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.moveTo(bTopLeft, baseY2);
  ctx.lineTo(bTopRight, baseY2);
  ctx.lineTo(bRight, baseY2 + baseHeight);
  ctx.lineTo(bLeft, baseY2 + baseHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Base top edge highlight — bright aluminum lip
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bTopLeft + 2, baseY2 + 0.5);
  ctx.lineTo(bTopRight - 2, baseY2 + 0.5);
  ctx.stroke();

  // Base bottom edge — darker
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bLeft + 4, baseY2 + baseHeight);
  ctx.lineTo(bRight - 4, baseY2 + baseHeight);
  ctx.stroke();

  // Front lip cutout (the thin opening slit)
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  const slitW = 80;
  ctx.beginPath();
  ctx.roundRect(centerX - slitW / 2, baseY2 + baseHeight - 2, slitW, 2, 1);
  ctx.fill();

  // Side edges of base
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bTopLeft, baseY2);
  ctx.lineTo(bLeft, baseY2 + baseHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bTopRight, baseY2);
  ctx.lineTo(bRight, baseY2 + baseHeight);
  ctx.stroke();
}

function addWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, customText: string = "", isPaid: boolean = false) {
  // Setup font
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  
  // Only show "AppShot Free" branding if user is NOT paid
  if (!isPaid) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // Reduced opacity, subtle branding
    ctx.textAlign = "right";
    ctx.fillText("AppShot Free", canvas.width - 30, canvas.height - 30);
  }
  
  // If custom watermark provided, show at bottom CENTER with stroke effect
  // Works for both free and paid users
  if (customText && customText.trim() !== "") {
    ctx.textAlign = "center";
    
    // Draw dark stroke/outline for professional look
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.strokeText(customText, canvas.width / 2, canvas.height - 60);
    
    // Draw white fill on top
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.shadowBlur = 0;
    ctx.fillText(customText, canvas.width / 2, canvas.height - 60);
  }
  
  // Reset shadow and stroke
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "transparent";
  ctx.lineWidth = 1;
}

export function exportCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

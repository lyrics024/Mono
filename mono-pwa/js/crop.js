/* ===== Image Crop Modal — aspect-preserving crop with pan/zoom ===== */

let cropState = null;
const CROP_OUTPUT_MAX_SIZE = 720;
const CROP_OUTPUT_TYPE = 'image/jpeg';
const CROP_OUTPUT_QUALITY = 0.78;

function openCropModal(dataUrl) {
  return new Promise((resolve) => {
    // Use a dedicated overlay (not the shared modal) to avoid max-width constraint
    let cropOverlay = document.getElementById('crop-overlay');
    if (!cropOverlay) {
      cropOverlay = document.createElement('div');
      cropOverlay.id = 'crop-overlay';
      cropOverlay.className = 'crop-overlay';
      document.body.appendChild(cropOverlay);
    }

    cropOverlay.innerHTML = `
      <div class="crop-modal">
        <h3>裁切图片</h3>
        <p class="crop-hint">保持原图比例，拖动调整位置，双指或按钮缩放裁切</p>
        <div class="crop-workspace" id="crop-workspace">
          <img id="crop-img" src="" draggable="false" style="display:none;">
          <div class="crop-frame-overlay" id="crop-frame-overlay"></div>
        </div>
        <div class="crop-controls">
          <button class="crop-zoom-btn" id="crop-zoom-out">−</button>
          <span id="crop-zoom-label">100%</span>
          <button class="crop-zoom-btn" id="crop-zoom-in">+</button>
        </div>
        <div class="crop-actions">
          <button class="crop-btn cancel" id="crop-cancel">取消</button>
          <button class="crop-btn confirm" id="crop-confirm">完成</button>
        </div>
      </div>
    `;

    cropOverlay.classList.remove('hidden');
    cropOverlay.style.display = 'flex';

    const img = document.getElementById('crop-img');
    const workspace = document.getElementById('crop-workspace');
    const zoomLabel = document.getElementById('crop-zoom-label');

    cropState = {
      dataUrl,
      naturalW: 0,
      naturalH: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      minScale: 1,
      frameW: 0,
      frameH: 0
    };

    img.onload = () => {
      cropState.naturalW = img.naturalWidth;
      cropState.naturalH = img.naturalHeight;

      const frame = getAspectFrameSize(img.naturalWidth, img.naturalHeight);
      cropState.frameW = frame.width;
      cropState.frameH = frame.height;
      workspace.style.width = frame.width + 'px';
      workspace.style.height = frame.height + 'px';

      const scaleX = frame.width / img.naturalWidth;
      const scaleY = frame.height / img.naturalHeight;
      cropState.minScale = Math.max(scaleX, scaleY);
      cropState.scale = cropState.minScale;

      cropState.offsetX = 0;
      cropState.offsetY = 0;

      img.style.display = 'block';
      updateCropPreview();
    };
    img.src = dataUrl;

    function updateCropPreview() {
      if (!cropState) return;
      const s = cropState.scale;
      constrainCropOffset();

      const displayW = cropState.naturalW * s;
      const displayH = cropState.naturalH * s;

      // Position image so its center is at workspace center + offset
      const centerX = cropState.frameW / 2;
      const centerY = cropState.frameH / 2;

      img.style.width = displayW + 'px';
      img.style.height = displayH + 'px';
      img.style.left = (centerX - displayW / 2 + cropState.offsetX) + 'px';
      img.style.top = (centerY - displayH / 2 + cropState.offsetY) + 'px';
      img.style.position = 'absolute';

      const pct = Math.round((s / cropState.minScale) * 100);
      zoomLabel.textContent = pct + '%';
    }

    function getAspectFrameSize(naturalW, naturalH) {
      const ratio = naturalW / naturalH;
      const maxW = Math.min(window.innerWidth - 64, 640);
      const maxH = Math.min(window.innerHeight - 260, 560);
      let width = maxW;
      let height = width / ratio;

      if (height > maxH) {
        height = maxH;
        width = height * ratio;
      }

      return {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height))
      };
    }

    function constrainCropOffset() {
      const displayW = cropState.naturalW * cropState.scale;
      const displayH = cropState.naturalH * cropState.scale;
      const maxX = Math.max(0, (displayW - cropState.frameW) / 2);
      const maxY = Math.max(0, (displayH - cropState.frameH) / 2);

      cropState.offsetX = Math.max(-maxX, Math.min(maxX, cropState.offsetX));
      cropState.offsetY = Math.max(-maxY, Math.min(maxY, cropState.offsetY));
    }

    // Pan: drag
    let isDragging = false;
    let dragStartX, dragStartY, startOffsetX, startOffsetY;

    function onDragStart(cx, cy) {
      isDragging = true;
      dragStartX = cx;
      dragStartY = cy;
      startOffsetX = cropState.offsetX;
      startOffsetY = cropState.offsetY;
    }
    function onDragMove(cx, cy) {
      if (!isDragging) return;
      cropState.offsetX = startOffsetX + (cx - dragStartX);
      cropState.offsetY = startOffsetY + (cy - dragStartY);
      updateCropPreview();
    }
    function onDragEnd() { isDragging = false; }

    workspace.addEventListener('mousedown', (e) => { e.preventDefault(); onDragStart(e.clientX, e.clientY); });
    const moveHandler = (e) => onDragMove(e.clientX, e.clientY);
    const upHandler = () => onDragEnd();
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);

    workspace.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    workspace.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && !lastPinchDist) {
        e.preventDefault();
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    workspace.addEventListener('touchend', onDragEnd);

    // Pinch zoom
    let lastPinchDist = 0;
    workspace.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isDragging = false;
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    workspace.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist > 0) {
          const ratio = dist / lastPinchDist;
          cropState.scale = Math.max(cropState.minScale, Math.min(cropState.scale * ratio, cropState.minScale * 5));
          updateCropPreview();
        }
        lastPinchDist = dist;
      }
    }, { passive: false });

    // Zoom buttons
    document.getElementById('crop-zoom-in').addEventListener('click', () => {
      cropState.scale = Math.min(cropState.scale * 1.2, cropState.minScale * 5);
      updateCropPreview();
    });
    document.getElementById('crop-zoom-out').addEventListener('click', () => {
      cropState.scale = Math.max(cropState.scale / 1.2, cropState.minScale);
      updateCropPreview();
    });

    // Crop — draw the visible crop frame region onto canvas
    function doCrop() {
      const canvas = document.createElement('canvas');
      const frameRatio = cropState.frameW / cropState.frameH;
      const outW = frameRatio >= 1
        ? CROP_OUTPUT_MAX_SIZE
        : Math.round(CROP_OUTPUT_MAX_SIZE * frameRatio);
      const outH = frameRatio >= 1
        ? Math.round(CROP_OUTPUT_MAX_SIZE / frameRatio)
        : CROP_OUTPUT_MAX_SIZE;
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);

      const s = cropState.scale;
      const centerX = cropState.frameW / 2;
      const centerY = cropState.frameH / 2;

      // Image top-left in workspace pixels
      const displayW = cropState.naturalW * s;
      const displayH = cropState.naturalH * s;
      const imgLeft = centerX - displayW / 2 + cropState.offsetX;
      const imgTop = centerY - displayH / 2 + cropState.offsetY;

      // Crop frame = entire workspace, preserving the frame aspect ratio.
      // Source rect on natural image = (workspacePixels - imgLeft) / scale
      const srcX = (0 - imgLeft) / s;
      const srcY = (0 - imgTop) / s;
      const srcW = cropState.frameW / s;
      const srcH = cropState.frameH / s;

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      const croppedDataUrl = canvas.toDataURL(CROP_OUTPUT_TYPE, CROP_OUTPUT_QUALITY);
      cleanup();
      resolve(croppedDataUrl);
    }

    function cleanup() {
      cropOverlay.style.display = 'none';
      cropOverlay.classList.add('hidden');
      cropState = null;
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    }

    document.getElementById('crop-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
    document.getElementById('crop-confirm').addEventListener('click', doCrop);

    cropOverlay.addEventListener('click', (e) => {
      if (e.target === cropOverlay) { cleanup(); resolve(null); }
    });
  });
}

/** Crop rect to draw a video frame with CSS object-cover into a canvas. */
export function videoCoverSourceRect(
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { sx: number; sy: number; sw: number; sh: number } | null {
  if (videoWidth < 1 || videoHeight < 1 || canvasWidth < 1 || canvasHeight < 1) {
    return null;
  }
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const sw = canvasWidth / scale;
  const sh = canvasHeight / scale;
  return {
    sx: (videoWidth - sw) / 2,
    sy: (videoHeight - sh) / 2,
    sw,
    sh,
  };
}

function arCaptureFileName(date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `sonnen-ar-${stamp}.jpg`;
}

/**
 * Composite live video (object-cover) and AR overlay canvas into a JPEG File.
 */
export async function captureArFrameToFile(
  video: HTMLVideoElement,
  overlay: HTMLCanvasElement,
  fileName = arCaptureFileName()
): Promise<File | null> {
  const w = overlay.width;
  const h = overlay.height;
  const crop = videoCoverSourceRect(video.videoWidth, video.videoHeight, w, h);
  if (!crop || w < 1 || h < 1) return null;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  const { sx, sy, sw, sh } = crop;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  ctx.drawImage(overlay, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
  if (!blob) return null;
  return new File([blob], fileName, { type: "image/jpeg" });
}

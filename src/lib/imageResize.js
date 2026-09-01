// Downscales an uploaded image before it's turned into a base64 string for
// storage. Without this, a full-resolution phone photo (often 3-10MB)
// becomes an oversized insert that Supabase rejects.
const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.8;

// If the original file is bigger than this, ask before touching it rather
// than silently shrinking someone's photo.
export const PROMPT_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10MB

// If it's still this big even after resizing, refuse rather than save
// something likely to fail (or make every page load slow).
export const HARD_CAP_CHARS = 3 * 1024 * 1024; // ~3MB of base64 text

export function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

// The full flow a form should use: checks size, asks before reducing a
// large image, resizes, and refuses anything still too big afterward.
// Returns one of:
//   { ok: true, dataUrl }
//   { ok: false, reason: "cancelled" }        — user said no, do nothing
//   { ok: false, reason: "too-large", message } — show this to the user
//   { ok: false, reason: "unreadable", message }
export async function handleImageUpload(file) {
  if (file.size > PROMPT_THRESHOLD_BYTES) {
    const proceed = window.confirm(
      `This image is ${formatMB(file.size)}MB, larger than what saves reliably. ` +
      `Reduce its resolution to fit before saving? Click Cancel to pick a different photo instead.`
    );
    if (!proceed) return { ok: false, reason: "cancelled" };
  }

  let dataUrl;
  try {
    dataUrl = await resizeImageFile(file);
  } catch (e) {
    return { ok: false, reason: "unreadable", message: e.message || "Couldn't read that image." };
  }

  if (dataUrl.length > HARD_CAP_CHARS) {
    return {
      ok: false,
      reason: "too-large",
      message: "Even reduced, this image is still too large to save reliably. Try cropping it to just the product first, or use a simpler photo.",
    };
  }

  return { ok: true, dataUrl };
}


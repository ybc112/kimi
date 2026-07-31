export interface ThumbnailOptions {
  size?: number;
  quality?: number;
}

/**
 * Convert an AI image (usually a large base64 PNG) into a small JPEG
 * thumbnail suitable for a browser draft/cache. If the source cannot be
 * decoded, callers can continue using the original URL for the current view.
 */
export function createImageThumbnail(
  source: string,
  { size = 192, quality = 0.76 }: ThumbnailOptions = {}
): Promise<string> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new Error("当前环境不支持图片缩略图"));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = "anonymous";
    image.onload = () => {
      const scale = Math.min(1, size / Math.max(image.naturalWidth || size, image.naturalHeight || size));
      const width = Math.max(1, Math.round((image.naturalWidth || size) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || size) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("无法创建图片画布"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("无法压缩图片"));
      }
    };
    image.onerror = () => reject(new Error("图片地址无法加载"));
    image.src = source;
  });
}

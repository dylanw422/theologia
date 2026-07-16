import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgImage,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export default async function TwitterImage() {
  return renderOgImage();
}

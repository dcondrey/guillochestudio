/**
 * Pattern Sharing Service
 * DNA links, QR codes, social sharing, and embed codes
 */

import type { PatternParams } from '@guilloche/shared';
import { PatternDNA } from '@guilloche/core';

export interface ShareOptions {
  title: string;
  description?: string;
  imageUrl?: string;
}

/**
 * Generate QR code data URL using browser canvas
 */
export async function generateQRCode(data: string, size = 256): Promise<string> {
  // Use qrcode library dynamically loaded
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(data, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(data: string): Promise<string> {
  const QRCode = await import('qrcode');
  return QRCode.toString(data, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Create DNA share link
 */
export function createDNALink(
  params: PatternParams,
  baseUrl = ''
): {
  dna: string;
  url: string;
} {
  const dna = PatternDNA.encode(params);
  const url = `${baseUrl || window.location.origin}/dna/${dna}`;
  return { dna, url };
}

/**
 * Create embed code for pattern
 */
export function createEmbedCode(
  dnaCode: string,
  options: {
    width?: number;
    height?: number;
    theme?: 'light' | 'dark';
  } = {}
): string {
  const { width = 400, height = 400, theme = 'dark' } = options;
  const embedUrl = `${window.location.origin}/embed/${dnaCode}?theme=${theme}`;

  return `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allowfullscreen
  title="Guilloché Pattern"
></iframe>`;
}

/**
 * Share to social platforms
 */
export function shareToSocial(
  platform: 'twitter' | 'facebook' | 'linkedin' | 'pinterest' | 'reddit',
  url: string,
  options: ShareOptions
): void {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(options.title);
  const encodedDesc = encodeURIComponent(options.description || '');

  let shareUrl: string;

  switch (platform) {
    case 'twitter':
      shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
      break;
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      break;
    case 'linkedin':
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
      break;
    case 'pinterest':
      shareUrl = `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}${options.imageUrl ? `&media=${encodeURIComponent(options.imageUrl)}` : ''}`;
      break;
    case 'reddit':
      shareUrl = `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
      break;
    default:
      return;
  }

  window.open(shareUrl, '_blank', 'width=600,height=400');
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  }
}

/**
 * Use Web Share API if available
 */
export async function nativeShare(options: ShareOptions & { url: string }): Promise<boolean> {
  if (!navigator.share) return false;

  try {
    await navigator.share({
      title: options.title,
      text: options.description,
      url: options.url,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download QR code as image
 */
export async function downloadQRCode(
  data: string,
  filename = 'guilloche-pattern-qr.png'
): Promise<void> {
  const dataUrl = await generateQRCode(data, 512);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Generate Open Graph metadata for a pattern
 */
export function generateOGMetadata(params: {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}): Record<string, string> {
  return {
    'og:title': params.title,
    'og:description': params.description,
    'og:image': params.imageUrl,
    'og:url': params.url,
    'og:type': 'article',
    'twitter:card': 'summary_large_image',
    'twitter:title': params.title,
    'twitter:description': params.description,
    'twitter:image': params.imageUrl,
  };
}

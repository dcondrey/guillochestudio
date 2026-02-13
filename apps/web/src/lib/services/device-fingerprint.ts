/**
 * Device Fingerprinting & Abuse Detection Service
 *
 * Used to detect:
 * - Multiple accounts from same device
 * - Private browsing bypass attempts
 * - Automated/bot access
 * - Account sharing
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// Types
// =============================================================================

export interface FingerprintComponents {
  userAgent: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  webglVendor?: string;
  webglRenderer?: string;
  canvasHash?: string;
  audioHash?: string;
  fontsHash?: string;
}

export interface FingerprintResult {
  hash: string;
  components: FingerprintComponents;
  riskIndicators: RiskIndicators;
  confidence: number;
}

export interface RiskIndicators {
  isIncognito: boolean;
  isHeadless: boolean;
  isAutomated: boolean;
  hasWebdriver: boolean;
  isVirtualMachine: boolean;
  hasInconsistencies: boolean;
  suspiciousTimezone: boolean;
}

export interface DeviceInfo {
  id: string;
  fingerprintHash: string;
  userId: string | null;
  riskIndicators: RiskIndicators;
  firstSeenAt: Date;
  lastSeenAt: Date;
  visitCount: number;
  associatedUserIds: string[];
}

export interface AbuseCheckResult {
  isAbusive: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  linkedAccounts: number;
  recommendation: 'allow' | 'challenge' | 'block' | 'review';
}

// =============================================================================
// Server-side Fingerprint Processing
// =============================================================================

export class DeviceFingerprintService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Hash fingerprint components server-side
   */
  async hashFingerprint(components: FingerprintComponents): Promise<string> {
    const normalizedData = this.normalizeComponents(components);
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(normalizedData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Normalize fingerprint components to reduce false positives
   */
  private normalizeComponents(components: FingerprintComponents): Record<string, string> {
    return {
      // User agent normalized (remove version numbers that change frequently)
      ua: this.normalizeUserAgent(components.userAgent),
      // Screen dimensions (binned to reduce uniqueness)
      screen: this.binScreenSize(components.screen),
      // Timezone
      tz: components.timezone,
      // Language (just primary)
      lang: components.language.split('-')[0],
      // Platform
      plat: components.platform,
      // Hardware (if available)
      hw: `${components.hardwareConcurrency || 0}:${components.deviceMemory || 0}`,
      // WebGL (if available)
      gl: components.webglVendor && components.webglRenderer
        ? `${components.webglVendor}:${components.webglRenderer}`.substring(0, 100)
        : '',
      // Canvas hash (stable)
      canvas: components.canvasHash || '',
      // Audio hash (stable)
      audio: components.audioHash || '',
    };
  }

  /**
   * Normalize user agent to be more stable across versions
   */
  private normalizeUserAgent(ua: string): string {
    // Extract browser family and OS, ignore version numbers
    const patterns = [
      /Chrome\/[\d.]+/,
      /Firefox\/[\d.]+/,
      /Safari\/[\d.]+/,
      /Edge\/[\d.]+/,
      /Version\/[\d.]+/,
    ];

    let normalized = ua;
    for (const pattern of patterns) {
      normalized = normalized.replace(pattern, (match) => match.split('/')[0] + '/X');
    }
    return normalized;
  }

  /**
   * Bin screen sizes to reduce uniqueness
   */
  private binScreenSize(screen: FingerprintComponents['screen']): string {
    const widthBin = Math.floor(screen.width / 100) * 100;
    const heightBin = Math.floor(screen.height / 100) * 100;
    return `${widthBin}x${heightBin}:${screen.colorDepth}:${Math.round(screen.pixelRatio)}`;
  }

  /**
   * Detect risk indicators from fingerprint
   */
  detectRiskIndicators(
    components: FingerprintComponents,
    requestHeaders: Record<string, string>
  ): RiskIndicators {
    const indicators: RiskIndicators = {
      isIncognito: false,
      isHeadless: false,
      isAutomated: false,
      hasWebdriver: false,
      isVirtualMachine: false,
      hasInconsistencies: false,
      suspiciousTimezone: false,
    };

    const ua = components.userAgent.toLowerCase();

    // Detect headless browsers
    indicators.isHeadless = (
      ua.includes('headless') ||
      ua.includes('phantomjs') ||
      ua.includes('nightmare') ||
      !components.webglVendor ||
      !components.webglRenderer
    );

    // Detect automation frameworks
    indicators.isAutomated = (
      ua.includes('selenium') ||
      ua.includes('puppeteer') ||
      ua.includes('playwright') ||
      ua.includes('webdriver')
    );

    // Check for webdriver
    indicators.hasWebdriver = ua.includes('webdriver');

    // Detect virtual machines (common WebGL renderers)
    if (components.webglRenderer) {
      const renderer = components.webglRenderer.toLowerCase();
      indicators.isVirtualMachine = (
        renderer.includes('swiftshader') ||
        renderer.includes('llvmpipe') ||
        renderer.includes('virtualbox') ||
        renderer.includes('vmware')
      );
    }

    // Check for inconsistencies
    const inconsistencies: string[] = [];

    // Platform vs User Agent mismatch
    if (components.platform === 'Win32' && !ua.includes('windows')) {
      inconsistencies.push('platform_ua_mismatch');
    }
    if (components.platform === 'MacIntel' && !ua.includes('mac')) {
      inconsistencies.push('platform_ua_mismatch');
    }

    // Unrealistic hardware
    if (components.hardwareConcurrency && components.hardwareConcurrency > 64) {
      inconsistencies.push('unrealistic_cpu_cores');
    }

    // Mobile UA with desktop screen
    if (
      (ua.includes('mobile') || ua.includes('android')) &&
      components.screen.width > 1920
    ) {
      inconsistencies.push('mobile_ua_desktop_screen');
    }

    indicators.hasInconsistencies = inconsistencies.length > 0;

    // Check timezone consistency with IP geolocation (if available)
    const cfCountry = requestHeaders['cf-ipcountry'];
    if (cfCountry && components.timezone) {
      indicators.suspiciousTimezone = this.checkTimezoneCountryMismatch(
        components.timezone,
        cfCountry
      );
    }

    return indicators;
  }

  /**
   * Check if timezone matches country from IP
   */
  private checkTimezoneCountryMismatch(timezone: string, countryCode: string): boolean {
    // Map of countries to expected timezone prefixes
    const tzCountryMap: Record<string, string[]> = {
      US: ['America/'],
      GB: ['Europe/London'],
      DE: ['Europe/Berlin'],
      FR: ['Europe/Paris'],
      JP: ['Asia/Tokyo'],
      CN: ['Asia/Shanghai', 'Asia/Hong_Kong'],
      AU: ['Australia/'],
      IN: ['Asia/Kolkata'],
      BR: ['America/Sao_Paulo', 'America/Brasilia'],
      RU: ['Europe/Moscow', 'Asia/'],
    };

    const expectedPrefixes = tzCountryMap[countryCode];
    if (!expectedPrefixes) return false;

    return !expectedPrefixes.some(prefix => timezone.startsWith(prefix));
  }

  /**
   * Register or update device fingerprint in database
   */
  async registerDevice(
    fingerprintHash: string,
    components: FingerprintComponents,
    riskIndicators: RiskIndicators,
    userId: string | null
  ): Promise<DeviceInfo | null> {
    // Check if fingerprint exists
    const { data: existing } = await this.supabase
      .from('device_fingerprints')
      .select('*')
      .eq('fingerprint_hash', fingerprintHash)
      .single();

    if (existing) {
      // Update existing record
      const associatedUserIds = [...new Set([
        ...existing.associated_user_ids,
        ...(userId ? [userId] : []),
      ])];

      const { data, error } = await this.supabase
        .from('device_fingerprints')
        .update({
          user_id: userId || existing.user_id,
          last_seen_at: new Date().toISOString(),
          visit_count: existing.visit_count + 1,
          associated_user_ids: associatedUserIds,
          is_incognito: riskIndicators.isIncognito,
          is_headless: riskIndicators.isHeadless,
          is_automated: riskIndicators.isAutomated,
          has_webdriver: riskIndicators.hasWebdriver,
        })
        .eq('fingerprint_hash', fingerprintHash)
        .select()
        .single();

      if (error) return null;

      return {
        id: data.id,
        fingerprintHash: data.fingerprint_hash,
        userId: data.user_id,
        riskIndicators,
        firstSeenAt: new Date(data.first_seen_at),
        lastSeenAt: new Date(data.last_seen_at),
        visitCount: data.visit_count,
        associatedUserIds: data.associated_user_ids,
      };
    }

    // Create new record
    const { data, error } = await this.supabase
      .from('device_fingerprints')
      .insert({
        fingerprint_hash: fingerprintHash,
        user_id: userId,
        user_agent_hash: await this.hashString(components.userAgent),
        screen_hash: await this.hashString(JSON.stringify(components.screen)),
        timezone: components.timezone,
        language: components.language,
        platform: components.platform,
        webgl_hash: components.webglVendor
          ? await this.hashString(`${components.webglVendor}:${components.webglRenderer}`)
          : null,
        canvas_hash: components.canvasHash,
        audio_hash: components.audioHash,
        fonts_hash: components.fontsHash,
        is_incognito: riskIndicators.isIncognito,
        is_headless: riskIndicators.isHeadless,
        is_automated: riskIndicators.isAutomated,
        has_webdriver: riskIndicators.hasWebdriver,
        associated_user_ids: userId ? [userId] : [],
      })
      .select()
      .single();

    if (error) return null;

    return {
      id: data.id,
      fingerprintHash: data.fingerprint_hash,
      userId: data.user_id,
      riskIndicators,
      firstSeenAt: new Date(data.first_seen_at),
      lastSeenAt: new Date(data.last_seen_at),
      visitCount: data.visit_count,
      associatedUserIds: data.associated_user_ids,
    };
  }

  /**
   * Check for abuse patterns
   */
  async checkForAbuse(
    fingerprintHash: string,
    userId: string,
    ipAddress: string
  ): Promise<AbuseCheckResult> {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Get device info
    const { data: device } = await this.supabase
      .from('device_fingerprints')
      .select('*')
      .eq('fingerprint_hash', fingerprintHash)
      .single();

    // Check for multiple accounts on same device
    let linkedAccounts = 0;
    if (device && device.associated_user_ids) {
      linkedAccounts = device.associated_user_ids.filter(
        (id: string) => id !== userId
      ).length;

      if (linkedAccounts >= 3) {
        reasons.push(`Multiple accounts (${linkedAccounts + 1}) detected on same device`);
        riskLevel = 'high';
      } else if (linkedAccounts >= 1) {
        reasons.push(`Device shared with ${linkedAccounts} other account(s)`);
        riskLevel = 'medium';
      }
    }

    // Check risk indicators
    if (device) {
      if (device.is_automated || device.has_webdriver) {
        reasons.push('Automated browser detected');
        riskLevel = 'critical';
      }
      if (device.is_headless) {
        reasons.push('Headless browser detected');
        riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
      }
    }

    // Check IP reputation
    const { data: ipRep } = await this.supabase
      .from('ip_reputation')
      .select('*')
      .eq('ip_address', ipAddress)
      .single();

    if (ipRep) {
      if (ipRep.is_blocked) {
        reasons.push('IP address is blocked');
        riskLevel = 'critical';
      }
      if (ipRep.is_tor || ipRep.is_proxy) {
        reasons.push('VPN/Proxy/Tor detected');
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }
      if (ipRep.abuse_reports > 0) {
        reasons.push(`IP has ${ipRep.abuse_reports} abuse reports`);
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }
      if (ipRep.reputation_score < 30) {
        reasons.push('Low IP reputation score');
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }
    }

    // Check for existing account links
    const { data: links } = await this.supabase
      .from('account_links')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .is('is_legitimate', null); // Unreviewed links

    if (links && links.length > 0) {
      const highConfidenceLinks = links.filter(l => l.confidence_score > 0.8);
      if (highConfidenceLinks.length > 0) {
        reasons.push(`${highConfidenceLinks.length} high-confidence account link(s) detected`);
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }
    }

    // Determine recommendation
    let recommendation: 'allow' | 'challenge' | 'block' | 'review';
    switch (riskLevel) {
      case 'critical':
        recommendation = 'block';
        break;
      case 'high':
        recommendation = 'review';
        break;
      case 'medium':
        recommendation = 'challenge';
        break;
      default:
        recommendation = 'allow';
    }

    return {
      isAbusive: riskLevel === 'critical' || riskLevel === 'high',
      riskLevel,
      reasons,
      linkedAccounts,
      recommendation,
    };
  }

  /**
   * Detect and record account linking
   */
  async detectAccountLink(
    userId: string,
    fingerprintHash: string,
    ipAddress: string
  ): Promise<{ linkedUsers: string[]; newLinksCreated: number }> {
    // Use database function to detect links
    const { data } = await this.supabase.rpc('detect_account_link', {
      p_user_id: userId,
      p_fingerprint_hash: fingerprintHash,
      p_ip_address: ipAddress,
    });

    return {
      linkedUsers: data?.linked_user_ids || [],
      newLinksCreated: data?.linked_count || 0,
    };
  }

  /**
   * Hash a string using SHA-256
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// =============================================================================
// Client-side Fingerprint Collection (to be run in browser)
// =============================================================================

/**
 * Collect fingerprint components in the browser
 * This should be called from a client-side script
 */
export function collectFingerprintComponents(): FingerprintComponents {
  // This function should only run in browser
  if (typeof window === 'undefined') {
    throw new Error('collectFingerprintComponents must run in browser');
  }

  const components: FingerprintComponents = {
    userAgent: navigator.userAgent,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
  };

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        components.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch {
    // WebGL not available
  }

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Guilloche', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('Studio', 4, 17);
      components.canvasHash = canvas.toDataURL().slice(-50);
    }
  } catch {
    // Canvas not available
  }

  return components;
}

/**
 * Detect if browser is in incognito/private mode
 * This uses various heuristics and may not be 100% accurate
 */
export async function detectIncognitoMode(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Check for reduced storage quota (Chrome incognito)
  try {
    const storage = await navigator.storage?.estimate?.();
    if (storage && storage.quota && storage.quota < 120_000_000) {
      return true;
    }
  } catch {
    // Storage API not available
  }

  // Check for filesystem API (not available in incognito in some browsers)
  try {
    const fs = (window as unknown as { webkitRequestFileSystem?: unknown }).webkitRequestFileSystem;
    if (fs) {
      return new Promise((resolve) => {
        (fs as Function)(
          0, // TEMPORARY
          1,
          () => resolve(false),
          () => resolve(true)
        );
      });
    }
  } catch {
    // Filesystem API not available
  }

  return false;
}

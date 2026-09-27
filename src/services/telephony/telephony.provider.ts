/**
 * Telephony Provider Abstraction Layer (Phase 4)
 *
 * Provides a clean interface for carrier integrations (Plivo Zentrunk, Exotel, etc.)
 * while maintaining strict TRAI/DoT compliance and LiveKit Cloud Mumbai regional anchoring.
 */

import { normalizePhoneNumber, validateSipIdentity } from '../sip.service';

export interface TelephonyConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TelephonyProvider {
  readonly name: string;
  readonly defaultRegion: string;
  readonly supportedCodecs: string[];
  validateConfig(): TelephonyConfigValidation;
  normalizeNumber(raw: string): string;
  validateDestination(target: string): { isValid: boolean; error?: string };
  getSipUri(subdomain: string): string;
  isMediaAnchoredInIndia(): boolean;
}

/**
 * Plivo Zentrunk Adapter for Indian Inbound Telephony
 *
 * Compliant with:
 * - TRAI Media Anchoring mandate (voice media must anchor in Mumbai ap-south)
 * - Plivo India Data Region
 * - G.711u / G.711a PSTN voice codecs
 * - TCP/TLS SIP transport to LiveKit Cloud India endpoint
 */
export class PlivoAdapter implements TelephonyProvider {
  readonly name = 'Plivo';
  readonly defaultRegion = 'ap-south'; // Mumbai, India
  readonly supportedCodecs = ['PCMU', 'PCMA']; // G.711u, G.711a

  validateConfig(): TelephonyConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const isSimMode = process.env.SIP_SIMULATION_MODE === 'true';
    const livekitUri = process.env.LIVEKIT_SIP_URI || '';
    const plivoAuthId = process.env.PLIVO_AUTH_ID || '';
    const plivoAuthToken = process.env.PLIVO_AUTH_TOKEN || '';

    if (!isSimMode) {
      if (!plivoAuthId) {
        errors.push('PLIVO_AUTH_ID is not configured for production mode.');
      }
      if (!plivoAuthToken) {
        errors.push('PLIVO_AUTH_TOKEN is not configured for production mode.');
      }
      if (livekitUri && !livekitUri.includes('india.sip.livekit.cloud')) {
        warnings.push(
          'LIVEKIT_SIP_URI does not specify india.sip.livekit.cloud. Indian PSTN calls may trigger Plivo hangup 4590 (media anchoring violation).'
        );
      }
    } else {
      warnings.push('Operating in SIP_SIMULATION_MODE=true. Carrier requests are simulated locally.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  normalizeNumber(raw: string): string {
    return normalizePhoneNumber(raw);
  }

  validateDestination(target: string): { isValid: boolean; error?: string } {
    return validateSipIdentity(target);
  }

  getSipUri(subdomain: string): string {
    const cleanSub = subdomain.trim().toLowerCase();
    // LiveKit India SIP FQDN pinned to ap-south (Mumbai)
    return `sip:${cleanSub}.india.sip.livekit.cloud;transport=tcp`;
  }

  isMediaAnchoredInIndia(): boolean {
    const livekitUri = process.env.LIVEKIT_SIP_URI || '';
    // Compliant if explicitly configured for India SIP endpoint or simulation mode
    return (
      process.env.SIP_SIMULATION_MODE === 'true' ||
      livekitUri.includes('india.sip.livekit.cloud')
    );
  }
}

// Default export of singleton instance
export const plivoAdapter = new PlivoAdapter();

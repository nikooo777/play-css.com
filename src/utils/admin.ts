export const WRITABLE_BAN_REASONS = [
  'none',
  'illegal_player_count',
  'non_css_application',
  'explicit_fake_client_producer',
  'player_count_mismatch',
  'synthetic_connection_cadence',
  'same_connection_time',
  'duplicate_roster',
] as const;

export const DETECTION_REASONS = [
  'illegal_player_count',
  'non_css_application',
  'explicit_fake_client_producer',
  'player_count_mismatch',
  'synthetic_connection_cadence',
  'same_connection_time',
  'duplicate_roster',
  'steam_metadata_illegal_counts',
  'steam_metadata_duplicate_signature',
] as const;

export type WritableBanReason = typeof WRITABLE_BAN_REASONS[number];

export interface AdminEnvelope<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
}

export interface MutationData extends Record<string, unknown> {
  operation_id?: number;
  operation_key?: string;
  publication_status?: string;
  replayed?: boolean;
  requires_repopulation?: boolean;
  retry_same_key?: boolean;
}

export interface BannedServer {
  address: string;
  banned_at: string;
  abuse_reason: string;
  source: 'manual' | 'tracker' | 'legacy';
  strike_count: number;
  last_detected_at?: string;
  valid: boolean;
  validity_reason?: string;
}

export interface Observation {
  id: number;
  cycle_id: number;
  address: string;
  scope: string;
  reason: string;
  source: string;
  observed_at: string;
  detector_version: string;
  evidence: Record<string, unknown>;
}

export interface ObservationPage {
  next_cursor: string;
  observations: Observation[];
}

export interface AuditSummary {
  legacy_blacklists_by_reason: Record<string, number>;
  legacy_server_bans_by_reason: Record<string, number>;
}

export function asMutationData(value: unknown): MutationData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as MutationData;
}

export function shouldRetryWithSameKey(value: unknown): boolean {
  return asMutationData(value)?.retry_same_key === true;
}

export function formatAdminLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function formatAdminTimestamp(value?: string): string {
  if (!value || value.startsWith('0001-01-01')) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function mutationSuccessMessage(
  action: string,
  data: MutationData | null
): string {
  const details = [action];
  if (data?.replayed === true) {
    details.push('stored result replayed');
  }
  if (typeof data?.publication_status === 'string') {
    details.push(formatAdminLabel(data.publication_status));
  }
  if (data?.requires_repopulation === true) {
    details.push('server discovery is required to repopulate rows');
  }
  return details.join(' · ');
}

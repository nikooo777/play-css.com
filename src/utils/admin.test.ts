import { describe, expect, test } from 'bun:test';
import {
  DETECTION_REASONS,
  WRITABLE_BAN_REASONS,
  asMutationData,
  formatAdminLabel,
  formatAdminTimestamp,
  mutationSuccessMessage,
  shouldRetryWithSameKey,
} from './admin';

describe('admin API helpers', () => {
  test('matches the writable backend reasons', () => {
    expect(WRITABLE_BAN_REASONS).toEqual([
      'none',
      'illegal_player_count',
      'non_css_application',
      'explicit_fake_client_producer',
      'player_count_mismatch',
      'synthetic_connection_cadence',
      'inconsistent_server_identity',
      'same_connection_time',
      'duplicate_roster',
    ]);
    expect(DETECTION_REASONS).toContain('explicit_fake_client_producer');
    expect(DETECTION_REASONS).toContain('synthetic_connection_cadence');
    expect(DETECTION_REASONS).toContain('inconsistent_server_identity');
  });

  test('preserves structured mutation data', () => {
    const data = {
      operation_key: '00000000-0000-4000-8000-000000000000',
      retry_same_key: true,
    };
    expect(asMutationData(data)).toEqual(data);
    expect(shouldRetryWithSameKey(data)).toBe(true);
    expect(shouldRetryWithSameKey(null)).toBe(false);
  });

  test('formats backend labels and timestamps', () => {
    expect(formatAdminLabel('committed_membership_degraded')).toBe(
      'Committed Membership Degraded'
    );
    expect(formatAdminTimestamp('0001-01-01T00:00:00Z')).toBe('—');
    expect(formatAdminTimestamp('invalid')).toBe('invalid');
  });

  test('summarizes meaningful mutation metadata', () => {
    expect(
      mutationSuccessMessage('Server recovered', {
        replayed: true,
        publication_status: 'membership_ready',
        requires_repopulation: true,
      })
    ).toBe(
      'Server recovered · stored result replayed · Membership Ready · server discovery is required to repopulate rows'
    );
  });
});

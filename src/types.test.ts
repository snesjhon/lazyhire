import { describe, it, expect } from 'vitest';
import { JOB_STATUSES, isJobStatus } from './types.js';

describe('isJobStatus', () => {
  it('accepts valid statuses', () => {
    expect(isJobStatus('Pending')).toBe(true);
    expect(isJobStatus('Evaluated')).toBe(true);
    expect(isJobStatus('Offer')).toBe(true);
  });

  it('rejects invalid statuses', () => {
    expect(isJobStatus('Foo')).toBe(false);
    expect(isJobStatus('')).toBe(false);
  });

  it('exports all 7 statuses', () => {
    expect(JOB_STATUSES).toHaveLength(7);
  });
});

import { describe, expect, it } from 'vitest';
import {
  prepareMessagesForTaskExtraction,
} from '../../supabase/functions/scan-messages/messagePreparation.ts';
import type { ExternalMessage } from '../../supabase/functions/_shared/integrations/types.ts';

const message = (index: number, overrides: Partial<ExternalMessage> = {}): ExternalMessage => ({
  externalId: `message-${index}`,
  source: 'email',
  subject: `Subject ${index}`,
  snippet: `Snippet ${index}`,
  sender: `sender-${index}@example.com`,
  receivedAt: '2026-09-15T00:00:00Z',
  ...overrides,
});

describe('prepareMessagesForTaskExtraction', () => {
  it('limits the number of provider messages sent to the model', () => {
    const prepared = prepareMessagesForTaskExtraction(
      Array.from({ length: 100 }, (_, index) => message(index)),
    );

    expect(prepared.selectedCount).toBe(30);
    expect(prepared.text).toContain('[30]');
    expect(prepared.text).not.toContain('[31]');
  });

  it('truncates provider-controlled fields before building the prompt', () => {
    const prepared = prepareMessagesForTaskExtraction([
      message(1, {
        sender: 'x'.repeat(500),
        subject: 's'.repeat(500),
        snippet: 'p'.repeat(5_000),
      }),
    ]);

    expect(prepared.text.length).toBeLessThan(1_000);
    expect(prepared.text).toContain(`${'x'.repeat(120)}...`);
    expect(prepared.text).toContain(`${'s'.repeat(160)}...`);
    expect(prepared.text).toContain(`${'p'.repeat(600)}...`);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260914190000_launch-security-hardening.sql',
);

const readMigration = () => readFileSync(migrationPath, 'utf8');

describe('launch security hardening migration', () => {
  it('separates public self-quota from service-role quota mutation', () => {
    const sql = readMigration();

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(');
    expect(sql).toContain('auth.uid()');
    expect(sql).not.toMatch(/check_and_increment_ai_usage\([^)]*p_user_id/i);
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage_for_user(');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage_for_user(text, integer, uuid) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage_for_user(text, integer, uuid) TO service_role');
  });

  it('adds atomic single-use OAuth state consumption with a TTL', () => {
    const sql = readMigration();

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.consume_oauth_state(');
    expect(sql).toContain('DELETE FROM public.oauth_states');
    expect(sql).toContain('RETURNING');
    expect(sql).toContain("created_at >= now() - interval '10 minutes'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.consume_oauth_state(text) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.consume_oauth_state(text) TO service_role');
  });
});

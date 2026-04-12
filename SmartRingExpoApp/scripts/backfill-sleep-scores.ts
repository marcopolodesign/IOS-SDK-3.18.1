/**
 * One-shot backfill script: computes and persists sleep_score for all night
 * sleep_sessions rows where sleep_score IS NULL.
 *
 * Uses the exact same calculateSleepScoreFromStages formula as the app so
 * scores are identical to what new inserts will produce.
 *
 * Usage:
 *   cd SmartRingExpoApp
 *   npx tsx scripts/backfill-sleep-scores.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (never commit .env.local or the service role key).
 */

import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { calculateSleepScoreFromStages } from '../src/utils/ringData/sleep';

loadDotenv({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['EXPO_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[backfill] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BATCH = 500;
const MIN_TOTAL_MINUTES = 60;

async function run() {
  console.log('[backfill] Starting sleep_score backfill for night sessions...');

  let offset = 0;
  let totalUpdated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('sleep_sessions')
      .select('id, deep_min, light_min, rem_min, awake_min')
      .is('sleep_score', null)
      .eq('session_type', 'night')
      .range(offset, offset + BATCH - 1)
      .order('id');

    if (error) {
      console.error('[backfill] Select error:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    console.log(`[backfill] Batch offset=${offset}: ${data.length} rows`);

    const updates: { id: string; sleep_score: number }[] = [];
    for (const row of data) {
      const deep = row.deep_min ?? 0;
      const light = row.light_min ?? 0;
      const rem = row.rem_min ?? 0;
      const awake = row.awake_min ?? 0;

      if (deep + light + rem < MIN_TOTAL_MINUTES) {
        console.log(`  skip id=${row.id} (total ${deep + light + rem}m < ${MIN_TOTAL_MINUTES}m)`);
        continue;
      }

      const score = calculateSleepScoreFromStages({ deep, light, rem, awake });
      updates.push({ id: row.id as string, sleep_score: score });

      if (offset === 0 && updates.length <= 5) {
        // Dry-run preview for first batch
        console.log(`  preview id=${row.id}: deep=${deep} light=${light} rem=${rem} awake=${awake} → score=${score}`);
      }
    }

    for (const u of updates) {
      const { error: updateErr } = await supabase
        .from('sleep_sessions')
        .update({ sleep_score: u.sleep_score })
        .eq('id', u.id);
      if (updateErr) {
        console.error(`  update error for id=${u.id}:`, updateErr.message);
      }
    }

    totalUpdated += updates.length;
    console.log(`  updated ${updates.length} rows in this batch (total so far: ${totalUpdated})`);

    if (data.length < BATCH) break;
    offset += BATCH;
  }

  console.log(`[backfill] Done. Total rows updated: ${totalUpdated}`);
}

run().catch(err => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});

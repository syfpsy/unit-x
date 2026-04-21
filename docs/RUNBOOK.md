# UNIT-X runbook

Operational procedures. One ritual per section. The README is for
newcomers; this file is for the person on-call.

## Rotate the DeepSeek API key

1. Revoke the old key at <https://platform.deepseek.com/>.
2. Add the new key to every environment:
   ```
   for env in production preview development; do
     vercel env rm DEEPSEEK_API_KEY $env --yes
     printf '%s' '<new key>' | vercel env add DEEPSEEK_API_KEY $env
   done
   ```
3. Force-redeploy so the running function picks up the new env:
   ```
   vercel deploy --prod --yes --force
   ```
4. Pull locally: `vercel env pull .env.local`.

## Rotate the master encryption key (UNITX_MASTER_KEY)

Do this quarterly, or immediately if the key is ever paste-leaked.
The rotation is zero-downtime as long as both keys are present during
the re-encrypt pass.

1. Generate a fresh key:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Demote the current key — move it to `UNITX_MASTER_KEY_PREV` on every env:
   ```
   CURRENT=$(vercel env pull --yes - 2>/dev/null | grep '^UNITX_MASTER_KEY=' | cut -d= -f2-)
   for env in production preview development; do
     printf '%s' "$CURRENT" | vercel env add UNITX_MASTER_KEY_PREV $env
     vercel env rm UNITX_MASTER_KEY $env --yes
     printf '%s' '<new key>' | vercel env add UNITX_MASTER_KEY $env
   done
   ```
3. Deploy so every function has both keys:
   ```
   vercel deploy --prod --yes --force
   ```
4. Re-encrypt every row:
   ```
   vercel env pull .env.local
   npm run keys:rotate
   ```
5. Drop the previous key once the rewrap is clean:
   ```
   for env in production preview development; do
     vercel env rm UNITX_MASTER_KEY_PREV $env --yes
   done
   vercel deploy --prod --yes --force
   ```

## Rotate the Supabase service-role key / DB password

1. In the Supabase dashboard → Settings → API, click "Reset" on
   `service_role` (or Settings → Database for the DB password).
2. Update the corresponding Vercel envs:
   ```
   vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes
   printf '%s' '<new key>' | vercel env add SUPABASE_SERVICE_ROLE_KEY production
   # repeat for preview + development, and for DB password:
   # DATABASE_URL, DIRECT_DATABASE_URL
   ```
3. `vercel deploy --prod --yes --force`.
4. `vercel env pull .env.local`.

## Inspect the retention sweep

The daily cron lives at `/api/cron/retention` and runs at 04:17 UTC
(see `vercel.json`). To run it by hand:

```
npm run retention:sweep               # local, via scripts/retention-sweep.mjs
# or trigger the route directly with the cron secret:
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://unit-x-eta.vercel.app/api/cron/retention
```

## Restore a mis-forgotten memory (within grace period)

Soft-deleted memories keep their ciphertext for 30 days. To restore:

```sql
update memories
set deleted_at = null
where id = '<uuid>';
```

After 30 days the retention sweep overwrites the ciphertext with a
single zero byte; at that point the content is gone and cannot be
restored even by an operator with the master key.

## Kill a user's session (moderation)

```sql
-- Delete the Supabase auth.users row; cascades through operators.
delete from auth.users where email = '<email>';
```

Cascade scope: operators → messages, memories, operator_cosmetics,
stage_transitions.

## Check liveness

```
curl -s https://unit-x-eta.vercel.app/api/health | jq
```

Returns `{status: "ok"|"degraded", checks: {...}}` and a 200 iff every
dependency is reachable.

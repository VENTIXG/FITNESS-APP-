# Integrations

## Ingest API

Create a token in **Settings → Integrations** (shown once; stored hashed). Then:

```
POST /api/ingest
Authorization: Bearer forge_xxx
Content-Type: application/json
```

```json
{
  "source": "apple_health",
  "steps":   [{ "date": "2026-10-05", "steps": 8423 }],
  "weights": [{ "date": "2026-10-05", "weightKg": 82.4 }],
  "sleep":   [{ "date": "2026-10-05", "bedTime": "23:10", "wakeTime": "07:02" }],
  "metrics": [{ "date": "2026-10-05", "metric": "resting_hr", "value": 54 }],
  "cardio":  [{ "date": "2026-10-05", "activity": "running", "durationSeconds": 1820,
               "distanceM": 5000, "avgHeartRate": 152, "externalId": "hk-123" }]
}
```

- `source`: `apple_health`, `health_connect`, `api` or `import`. Dates are local calendar dates; future dates are skipped.
- Steps, sleep and metrics are upserted per day+source (re-posting the same day updates it). Cardio is de-duplicated by `externalId`.
- Weights never overwrite a manual weigh-in for the same day.
- `metric`: `resting_hr`, `avg_hr`, `hrv`, `active_energy`, `vo2max`. Max 500 items per list, 512 KB per request.
- Response: `{ "ok": true, "inserted": n, "updated": n, "skipped": n }`; 401 bad token, 422 validation errors.

## Apple Health (iOS Shortcuts)

1. Shortcuts → Automation → Time of Day (e.g. 23:30 daily).
2. Actions: *Find Health Samples* (Steps, today, sum) → *Find Health Samples* (Body Mass, latest) → *Dictionary* building the JSON above → *Get Contents of URL* (POST, headers above, Request Body = JSON).
3. Run once manually to grant Health permissions.

## Google Health Connect

Health Connect is only available to native Android apps. Use an automation app (e.g. Tasker with a Health Connect plugin, or an export app with HTTP webhooks) to post daily totals to the same endpoint.

## Push reminders

Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `CRON_SECRET`, enable reminders in **Settings → Notifications**, allow notifications on each device, and schedule:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reminders
```

every 15–60 minutes. Each reminder fires at most once per day and only when it is still relevant (e.g. weight not logged yet).

## Open Food Facts

Barcode lookups first search your own and built-in foods, then Open Food Facts (server-side, only the barcode is sent). Saved products are stored as your own foods marked "Open Food Facts". Disable with `OPENFOODFACTS_ENABLED=false`.

## AI coach (optional)

With `ANTHROPIC_API_KEY` set, the Coach page can generate a short weekly narrative. Only aggregated weekly numbers (no names, emails or notes) are sent, and only when you press the button. The prompt forbids diagnoses, medical advice and extreme targets.

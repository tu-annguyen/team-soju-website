# Cloudflare cost observability

## Workers Query Builder

Save a query named `Worker CPU by route` with:

- Dataset: Cloudflare Workers
- Group by: `$metadata.trigger` (the request path is not present on every event)
- Calculations: count; sum and average of `$workers.cpuTimeMs`; P50, P90, and P99 of `$workers.cpuTimeMs`
- Time range for release checks: seven days

Compare seven-day windows using CPU sum and D1 rows read divided by invocation count. The release target is a 90% reduction without increased errors or exceeded-resource events.

## Structured events

The D1 repository emits sampled JSON events for queries reading at least 1,000 rows or taking at least 100 ms:

```json
{"event":"d1_query","queryName":"huntFinder.page","rowsRead":30,"durationMs":12,"returnedRows":30}
```

No SQL parameters, fingerprints, account identifiers, or other personal data are logged. Stable query names currently include `feebas.leaderboard.activity`, `feebas.leaderboard.users`, `huntFinder.locations`, and `huntFinder.page`.

Leaderboard rebuild failures emit `event=feebas_leaderboard_refresh_failed` with the non-personal scope and error message. The previous snapshot remains available.

## Alerts

Configure these alerts in the production observability destination:

- Any `feebas_leaderboard_refresh_failed` event.
- A `feebas_leaderboard_snapshots.refresh_lease_until` value more than two minutes in the past. This should normally be null; use a scheduled health query if database-based alerting is available.
- Hunt Finder P99 CPU above 50 ms for 15 minutes.
- Seven-day `rowsRead / invocation count` increasing by more than 25% week over week for either leaderboard or Hunt Finder query names.

## Rollout order

1. Apply D1 migrations `0010` through `0012`.
2. Regenerate and import the Pokédex SQL so `hunt_spots`, `hunt_spot_species`, and `hunt_spot_egg_groups` are populated.
3. Deploy the Worker and web application.
4. Verify the saved query and structured events, then compare normalized seven-day windows.

# Backend Performance Optimization Plan: Caching & Pagination Layer

See full report at: docs/backend-optimization-plan.md

## Key Findings Summary

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | Slice before KV write (extra sentinel row) | Medium | Low | P1 |
| 2 | No KV cache for inbox first page | High | Low | P1 |
| 3 | No KV cache for clients-with-counts | Medium | Low | P1 |
| 4 | Tasks page fetches full ProjectWithRelations | High | Medium | P1 |
| 5 | getClientsWithProjectCounts two sequential queries | Medium | Medium | P2 |
| 6 | SELECT * in paginated queries | Medium | Low | P1 |
| 7 | useLoadMore accumulates without virtualization | Medium | High | P3 |
| 8 | toMockProject legacy mapping | Low | Medium | P3 |
| 9 | O(n) lookups in callbacks | Low | Low | P2 |
| 10 | Projects page full relations in RSC payload | Medium | Low | P1 |
| 11 | Stale pages 2+ after mutation | Low | Medium | P3 |

## Estimated Impact (P1 items)

| Metric | Current | After P1 | Improvement |
|--------|---------|----------|-------------|
| Inbox page load (KV warm) | ~150ms | ~10ms | ~93% faster |
| Clients page load (KV warm) | ~200ms | ~10ms | ~95% faster |
| Tasks page RSC payload | ~100KB | ~5KB | ~95% smaller |
| Projects page RSC payload | ~80KB | ~35KB | ~56% smaller |
| KV cache entry size (projects) | ~60KB | ~35KB | ~42% smaller |

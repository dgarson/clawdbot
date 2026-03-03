# Performance Audit — Horizon UI Phase 2

**Date:** 2026-03-03  
**Branch:** `feat/horizon-ui-phase1-cleanup`  
**Work dir:** `apps/web-next/`

## Executive Summary

✅ **PASS** — Bundle meets all performance targets:
- 338 code-split JS chunks (target: 300+)
- No chunks exceed 100KB gzip (largest: 93.2KB gzip)
- 98% of chunks under 10KB gzip (excellent lazy loading granularity)
- CSS bundle: 25.07KB gzip

---

## Bundle Statistics

### Overall Size

| Metric | Size (Uncompressed) | Size (Gzip) |
|--------|---------------------|-------------|
| Total JS | 6.1 MB | ~1.8 MB (est.) |
| Total CSS | 163 KB | 25.07 KB |
| Total dist | 6.3 MB | — |

### Chunk Count

| Category | Count |
|----------|-------|
| Total JS chunks | 338 |
| Target | 300+ |
| **Status** | ✅ PASS |

---

## Chunk Size Distribution

| Size Range (Gzip) | Count | Percentage |
|-------------------|-------|------------|
| < 1KB | 55 | 16.3% |
| 1-10KB | 278 | 82.2% |
| 10-50KB | 4 | 1.2% |
| 50-100KB | 1 | 0.3% |
| > 100KB | 0 | 0% |

**Conclusion:** Excellent code splitting granularity. 98% of chunks are under 10KB gzip, enabling efficient lazy loading.

---

## Largest Chunks

| Chunk | Raw Size | Gzip Size |
|-------|----------|-----------|
| `index-CEHMhUdE.js` | 314.12 KB | **93.20 KB** |
| `DataCatalog-MKU_K9k_.js` | 56.00 KB | 13.44 KB |
| `EnvironmentDriftDetector-D0dFvkpn.js` | 53.21 KB | 11.65 KB |
| `SupportTicketDashboard-DNd6WJyZ.js` | 45.50 KB | 10.53 KB |
| `CloudCostOptimizer-ZnOoOi61.js` | 42.47 KB | 10.38 KB |

### Analysis

- **Main bundle (`index-*.js`)**: 93.20 KB gzip — just under the 100KB threshold. Contains shared dependencies and core framework code.
- **Largest route chunks**: All under 15KB gzip, indicating effective route-based code splitting.
- **No chunks exceed 100KB gzip** — ✅ PASS

---

## Build Configuration

- **Bundler:** Vite 6.4.1
- **Target:** ES2023
- **Module format:** ESM
- **Code splitting:** Route-based + component-level

---

## Recommendations

### Short-term (Optional)

1. **Monitor main bundle growth**: At 93.2KB gzip, the main bundle is approaching the 100KB threshold. Consider reviewing shared dependencies for optimization opportunities.

2. **Icon chunks**: 55 chunks under 1KB are primarily icon components. Consider consolidating frequently-used icons into the main bundle if they're loaded on most pages.

### Long-term

1. **Consider dynamic imports for heavy features**: `DataCatalog` and `EnvironmentDriftDetector` could benefit from further splitting if they contain sub-features that aren't always used.

2. **Tree-shaking audit**: Periodically verify that unused code is being eliminated during builds.

---

## Fix Applied

During this audit, a build error was encountered:

```
src/hooks/useGateway.ts(11,33): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
```

**Resolution:** Added `src/vite-env.d.ts` with Vite client type references:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

This file was missing from the branch but is required for TypeScript to recognize Vite's `import.meta.env` types.

---

## Conclusion

**All performance targets met.** The bundle is well-optimized with:
- Excellent code splitting (338 chunks)
- No oversized chunks (max 93.2KB gzip)
- Efficient lazy loading granularity

The Horizon UI Phase 2 bundle configuration is production-ready.

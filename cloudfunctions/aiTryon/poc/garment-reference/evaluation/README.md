# POC-01 Evaluation Protocol

## Purpose

Compare Try-On output quality between **Original** garment reference and **Normalized** garment reference.

## Controlled Variables

Every evaluation pair **must** use the same:

- Avatar (same digital human)
- Garment (same physical item)
- Provider (e.g. Agnes)
- Model version
- Prompt / parameters
- Mode (e.g. virtual try-on)
- All other conditions as consistent as possible

The **only** variable that changes:

| Variant | Description |
|---------|-------------|
| `original` | Raw user-uploaded photo used directly as garment reference |
| `normalized` | Deterministic-normalized reference (POC-01 output) |

## Scoring Rubric

Each dimension scored **0–2**:

| Score | Meaning |
|-------|---------|
| 0 | Significantly degraded or missing |
| 1 | Acceptable but noticeable fidelity loss |
| 2 | Faithful to the original garment |

| Dimension | What to evaluate |
|-----------|-----------------|
| Color | Color accuracy vs. real garment |
| Pattern | Pattern / print / texture fidelity |
| Neckline | Collar / neckline shape accuracy |
| Sleeve | Sleeve shape and length accuracy |
| Length | Overall garment length accuracy |
| Silhouette | Overall contour / shape accuracy |

**Total: 12 points max.**

## Additional Metrics

| Metric | Description |
|--------|-------------|
| personConsistency | Does the avatar body/face remain consistent between original and normalized runs? |
| successRate | Percentage of successful Try-On generations |
| durationMs | Wall-clock time per generation |
| cost | Monetary cost per generation |

## How to Record

Use `schema.json` as the evaluation record format. See `cases.example.json` for placeholder structure.

**Do not fill in fake results.** Only record real evaluation data.

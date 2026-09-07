# V14 V1 Audit Result

## Scope

只针对 4.3-B-1 真实 aitryon 首测的媒体输入链路进行修复。

## Verified

- aiTryon runtime remains image-only.
- Provider remains `aitryon`.
- `aitryon-plus` remains disabled.
- Mock fallback remains disabled.
- Agnes is not selected as a V1 provider.
- Existing SSRF download path is reused.
- JPEG/PNG magic-byte validation remains enforced.
- DashScope async submission remains enabled.
- DashScope OSS resource resolve header remains present for `oss://` references.
- All cloud function JavaScript files pass `node --check`.

## Not performed

- No real DashScope API call was made from local verification.
- No API key was read or fabricated.
- No fake task/result was created.

## Current intended runtime

CloudBase real asset → secure server download → DashScope temporary OSS upload → `oss://` reference → `aitryon` submit → task polling → real result persistence.

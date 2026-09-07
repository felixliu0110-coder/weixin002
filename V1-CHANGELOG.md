# V15 V1 Fix

## Direct bug fixed
V14 resolved CloudBase `cloud://` references to HTTPS in `refs`, but then rebuilt the standard Try-On Context with the original Person Asset `cloud://` fields. `tryon-engine/context.normalizePerson()` selected `person.originalPhoto`, so the Provider received `cloud://...` and `storage.downloadToBuffer()` correctly rejected it with `仅支持 http/https`.

## Fix
The V1 submit path now places the already-resolved `refs[0]` HTTPS person reference into `person.originalPhoto` in the standard Try-On Context. The garment remains `refs[1]`.

No provider, quota, task, mock, video, Agnes, or database-history behavior was changed.


## V17 - Provider SUCCEEDED terminal-state compatibility fix
- Fix aiTryon status handler to recognize terminal success from `status`, `rawStatus`, or `normalized` fields.
- Fix terminal failure recognition from normalized/raw provider state.
- Add explicit observability fields for the terminal-state decision.
- No provider, quota, result schema, or data deletion changes.

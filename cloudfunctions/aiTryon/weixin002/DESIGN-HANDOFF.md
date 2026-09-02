# a5e52af7-27cf-491a-9f28-a8ac03bbc3d0 implementation handoff

This archive is the source of truth for turning the design into production code. Start from `index.html`, then preserve the visual system, responsive behavior, and interactions found in the exported files.

## Implementation target
- Build production UI from the exported design, not a loose reinterpretation.
- Preserve typography scale, spacing rhythm, color tokens, border radii, shadows, motion timing, and component states.
- Replace static placeholders only when the target app has real data or functional equivalents.
- Keep generated product UI free of Open Design chrome, preview labels, or design-process annotations.
- Treat this handoff as a visual contract: if implementation choices conflict, match the exported pixels and behavior first, then refactor internals.

## Source map
- Primary entry: `index.html`
- HTML screens detected: 20
- Stylesheets detected: 1
- Script/component files detected: 1
- Supporting assets detected: 63

## Responsive contract
Validate the implementation across this 2025–2026 viewport matrix:
- Mobile compact: 360×800
- Mobile standard: 390×844
- Mobile large: 430×932
- Foldable / small tablet: 600×960
- Tablet portrait: 820×1180
- Tablet landscape: 1024×768
- Laptop: 1366×768
- Desktop: 1440×900
- Wide desktop: 1920×1080

For responsive web exports, treat these as a modern breakpoint system for one adaptive web experience, not three fixed screenshots. Do not split responsive web into unrelated native app screens unless the project explicitly includes native targets. Use semantic layout thresholds, fluid `clamp()` type/spacing, and container queries where component width matters more than viewport width. Preserve any CSS media queries, container queries, fluid `clamp()` scales, and layout changes already present in the exported files.

## Design fidelity contract
- Extract reusable tokens before writing components: background, surface, foreground, muted text, border, accent, radius, shadow, spacing, type scale, and motion duration/easing.
- Map product screens, in-app modules/components, optional landing page, and optional OS widget surfaces before coding. Keep these surfaces separate in the target architecture.
- Match layout geometry: max-widths, gutters, grid columns, card proportions, sticky/fixed elements, and viewport-specific navigation.
- Preserve real copy, labels, and data shown in the export. Do not replace specific text with generic marketing filler.
- Preserve interactive affordances: hover, focus, pressed, disabled, loading, validation, copy/share, tab/accordion, modal/sheet, and keyboard states where present.
- Preserve accessibility semantics when converting: headings stay hierarchical, controls remain buttons/links/inputs, focus states stay visible.
- Do not keep prototype-only annotations, frame labels, or Open Design chrome in the production UI.

## CJX-ready UX contract
- Use `DESIGN-MANIFEST.json` as the machine-readable map for screens, app modules, OS widgets, landing pages, tokens, interactions, and viewport checks.
- Screen-file-first: when multiple user-facing surfaces exist, implement each HTML screen as its own route/file. Treat `index.html` as a launcher/overview when the manifest marks it that way, not as a combined final UI.
- If `landing.html`, app screens, platform screens, or OS widget files exist, preserve those boundaries in the target app instead of merging them into one page.
- A single self-contained `index.html` is acceptable only when the export truly contains one user-facing screen and its CSS/JS are structured enough to extract tokens, components, states, and behavior.
- If separate `css/` or `js/` files exist, treat them as source of truth for token/component/interactions before porting to React, Vue, SwiftUI, Compose, or another target stack.
- In-app modules/components are product UI blocks inside the app. OS widgets are home-screen/lock-screen/quick-access surfaces outside the app. Do not merge those concepts.

## Color and brand contract
- Use the exported design tokens and product/domain context as the color source of truth.
- Do not introduce warm beige / cream / peach / pink / orange-brown background washes unless they are already explicit brand/reference colors in the export.
- A stylesheet or design/token file was detected; inspect it for canonical color variables before choosing framework theme tokens.

## Implementation sequence for AI coding tools
1. Open `index.html` and `DESIGN-MANIFEST.json`; identify every screen file, launcher/overview file, app module, and interaction before coding.
2. If multiple HTML screens exist, map them to separate routes/surfaces first; do not merge `landing.html`, product app screens, platform screens, or OS widgets into one route.
3. Extract a token table from CSS/root styles and inline styles before building framework components.
4. Build product screens and domain-specific in-app modules from largest layout regions down to controls; avoid starting with isolated atoms that lose spatial intent.
5. Port responsive behavior across the modern viewport matrix and test each semantic breakpoint before cleanup.
6. Port interactions and states, then replace static placeholders only with real app data or functional equivalents.
7. Keep optional landing page and OS widget surfaces as separate surfaces if present.
8. Compare final screenshots against the export at 360×800, 390×844, 430×932, 820×1180, 1024×768, 1366×768, 1440×900, and 1920×1080 before declaring done.

## Entry points
- `我形我衣-单文件演示.html`
- `index.html`
- `screens/01-login.html`
- `screens/02-basic-info.html`
- `screens/03-body-params.html`
- `screens/04-photo-upload.html`
- `screens/05-3d-viewer.html`
- `screens/06-tryon-select.html`
- `screens/07-tryon-result.html`
- `screens/08-profile.html`
- `screens/09-privacy-auth.html`
- `screens/10-generate-progress.html`
- `screens/11-image-preview.html`
- `screens/12-tryon-progress.html`
- `screens/13-tryon-history.html`
- `screens/14-compare-view.html`
- `screens/15-privacy-manage.html`
- `screens/16-feedback-about.html`
- `screens/17-home.html`
- `woxingwoyi-demo.html`

## Styles
- `assets/proto.css`

## Scripts/components
- `assets/proto.js`

## Assets and supporting files
- `%SystemDrive%/ProgramData/SogouInput/Components/Picface/Cloud/sgim_picface_cloud_bak.bin`
- `%SystemDrive%/ProgramData/SogouInput/Components/Picface/Cloud/sgim_picface_cloud.bin`
- `assets/img/p01-hero.png`
- `assets/img/p05-avatar.png`
- `assets/img/p06-hoodie.png`
- `assets/img/p06-jeans.png`
- `assets/img/p06-pants.png`
- `assets/img/p06-shirt.png`
- `assets/img/p06-skirt.png`
- `assets/img/p06-tee.png`
- `assets/img/p07-result.png`
- `assets/img/p11-garment.png`
- `assets/img/p13-1.png`
- `assets/img/p13-2.png`
- `assets/img/p13-3.png`
- `assets/img/p13-4.png`
- `assets/img/p13-5.png`
- `assets/img/p14-left.png`
- `assets/img/p14-right.png`
- `assets/img/p17-avatar.png`
- `assets/img/p17-dress.png`
- `assets/img/p17-shirt.png`
- `assets/img/p17-white.png`
- `assets/img/tmp-p03-a.png`
- `assets/img/tmp-p03-b.png`
- `assets/img/tmp-p03-c.png`
- `assets/img/tmp-p03-cards.png`
- `brand-spec.md`
- `design-audit.md`
- `image-1.png`
- `image-10.png`
- `image-11.png`
- `image-12.png`
- `image-13.png`
- `image-2.png`
- `image-3.png`
- `image-4.png`
- `image-5.png`
- `image-6.png`
- `image-7.png`
- `image-8.png`
- `image-9.png`
- `image.png`
- `page_01_login.png.jpeg`
- `page_02_basic_info.png.jpeg`
- `page_03_body_params.png.jpeg`
- `page_04_photo_upload.png.jpeg`
- `page_05_3d_viewer.png.jpeg`
- `page_06_tryon_select.png.jpeg`
- `page_07_tryon_result.png.jpeg`
- `page_08_profile.png.jpeg`
- `page_09_privacy_auth.png.jpeg`
- `page_10_generate_progress.png.jpeg`
- `page_11_image_preview.png.jpeg`
- `page_12_tryon_progress.png.jpeg`
- `page_13_tryon_history.png.jpeg`
- `page_14_compare_view.png.jpeg`
- `page_15_privacy_manage.png.jpeg`
- `page_16_feedback_about.png.jpeg`
- `page_17_home.png.jpeg`
- `PRD-我形我衣-v1.0.md`
- `README.md`
- `screenshot-2026-08-15T13-19-35-942Z.png`

## Coding checklist for AI tools
1. Inspect `index.html` and `DESIGN-MANIFEST.json` first and identify reusable components before coding.
2. Implement each user-facing screen file as its own route/surface; keep launcher, landing, app, platform, and OS widget files separate.
3. Extract design tokens into the target stack: colors, type scale, spacing, radius, shadows, and motion.
4. Implement layout with real 2025–2026 responsive breakpoints, fluid type/spacing, and container-query-aware component behavior; test with no horizontal overflow.
5. Preserve interactive controls, hover/focus/pressed states, form behavior, validation, and copy actions where present.
6. Implement domain-specific in-app modules with real states; do not flatten them into generic cards.
7. Keep landing page, product screens, and OS widget/quick-access surfaces separate when present.
8. Confirm the production result visually matches the exported design before refactoring internals.
9. Reject implementation shortcuts that flatten the design into generic cards, generic gradients, placeholder stats, or framework-default typography.
10. If a detail is ambiguous, keep the exported HTML/CSS/JS behavior rather than inventing a new pattern.

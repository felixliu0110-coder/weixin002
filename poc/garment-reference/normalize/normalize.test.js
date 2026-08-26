/**
 * POC-01: Deterministic Garment Normalization — Test Suite
 *
 * Run:  node normalize/normalize.test.js
 *
 * Generates synthetic test fixtures via sharp (no real user photos).
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { normalizeGarment, DEFAULT_OPTIONS } = require("./index");

const FIXTURES_DIR = path.join(__dirname, "..", "output", "_test_fixtures");
const OUTPUT_DIR = path.join(__dirname, "..", "output", "_test_output");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log("  ✓ " + message);
  } else {
    failed++;
    console.error("  ✗ " + message);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    message + " (expected ~" + expected + ", got " + actual + ")"
  );
}

// ── Fixture generation ───────────────────────────────────────────────

async function createFixture(name, width, height, color) {
  const filePath = path.join(FIXTURES_DIR, name + ".png");
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color || { r: 128, g: 64, b: 32 }
    }
  })
    .png()
    .toFile(filePath);
  return filePath;
}

async function createFixtureWithEXIF(name, width, height, orientation) {
  // Create a simple image, then embed EXIF Orientation tag.
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } }
  })
    .png()
    .toBuffer();

  // sharp can set EXIF orientation via withMetadata
  const exifBuf = await sharp(buf)
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();

  const filePath = path.join(FIXTURES_DIR, name + ".jpg");
  fs.writeFileSync(filePath, exifBuf);
  return filePath;
}

/**
 * Create a direction-aware fixture: top half red, bottom half blue.
 * When EXIF orientation rotates the image, the color layout changes.
 */
async function createDirectionalFixture(name, width, height, orientation) {
  // Create an image with top=red, bottom=blue using raw pixel data
  const topHalf = Buffer.alloc(width * Math.floor(height / 2) * 3);
  const bottomHalf = Buffer.alloc(width * Math.ceil(height / 2) * 3);

  // Fill top half with red (255, 0, 0)
  for (let i = 0; i < topHalf.length; i += 3) {
    topHalf[i] = 255;     // R
    topHalf[i + 1] = 0;   // G
    topHalf[i + 2] = 0;   // B
  }

  // Fill bottom half with blue (0, 0, 255)
  for (let i = 0; i < bottomHalf.length; i += 3) {
    bottomHalf[i] = 0;     // R
    bottomHalf[i + 1] = 0; // G
    bottomHalf[i + 2] = 255; // B
  }

  const pixels = Buffer.concat([topHalf, bottomHalf]);

  const imgBuf = await sharp(pixels, {
    raw: { width, height, channels: 3 }
  })
    .jpeg()
    .toBuffer();

  // Embed EXIF orientation
  const exifBuf = await sharp(imgBuf)
    .withMetadata({ orientation })
    .jpeg()
    .toBuffer();

  const filePath = path.join(FIXTURES_DIR, name + ".jpg");
  fs.writeFileSync(filePath, exifBuf);
  return filePath;
}

// ── Setup / Teardown ─────────────────────────────────────────────────

function setup() {
  [FIXTURES_DIR, OUTPUT_DIR].forEach((dir) => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
    fs.mkdirSync(dir, { recursive: true });
  });
}

function teardown() {
  // Keep output for inspection; only remove fixtures.
  if (fs.existsSync(FIXTURES_DIR)) {
    fs.rmSync(FIXTURES_DIR, { recursive: true });
  }
}

// ── Tests ────────────────────────────────────────────────────────────

async function testLandscape() {
  console.log("\n[1] Landscape image (4000×3000)");
  const input = await createFixture("landscape", 4000, 3000);
  const output = path.join(OUTPUT_DIR, "landscape_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.inputWidth === 4000, "inputWidth = 4000");
  assert(result.inputHeight === 3000, "inputHeight = 3000");
  assert(result.orientedWidth === 4000, "orientedWidth = 4000 (no EXIF)");
  assert(result.orientedHeight === 3000, "orientedHeight = 3000 (no EXIF)");
  assert(result.scale < 1, "scale < 1 (downscaled)");
  assertApprox(result.scale, 1600 / 4000, 0.01, "scale ≈ 0.4");
  assert(result.resizedWidth === 1600, "resizedWidth = 1600");
  assert(result.resizedHeight === 1200, "resizedHeight = 1200");
  // 1600 > canvasWidth 1024 → fitScale = min(1024/1600, 1024/1200, 1) = 0.64
  assertApprox(result.fitScale, 0.64, 0.01, "fitScale ≈ 0.64");
  assert(result.placedWidth === 1024, "placedWidth = 1024");
  assert(result.placedHeight === 768, "placedHeight = 768");
  assert(result.canvasWidth === 1024, "canvasWidth = 1024");
  assert(result.canvasHeight === 1024, "canvasHeight = 1024");
  assert(result.offsetX === 0, "offsetX = 0 (fills width)");
  assert(result.offsetY > 0, "offsetY > 0 (vertical padding)");
}

async function testPortrait() {
  console.log("\n[2] Portrait image (3000×4000)");
  const input = await createFixture("portrait", 3000, 4000);
  const output = path.join(OUTPUT_DIR, "portrait_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.inputWidth === 3000, "inputWidth = 3000");
  assert(result.inputHeight === 4000, "inputHeight = 4000");
  assert(result.orientedWidth === 3000, "orientedWidth = 3000");
  assert(result.orientedHeight === 4000, "orientedHeight = 4000");
  assert(result.resizedWidth === 1200, "resizedWidth = 1200");
  assert(result.resizedHeight === 1600, "resizedHeight = 1600");
  // 1200 <= 1024? No, 1200 > 1024 → fitScale = min(1024/1200, 1024/1600, 1) = 0.64
  assertApprox(result.fitScale, 0.64, 0.01, "fitScale ≈ 0.64");
  assert(result.placedWidth === 768, "placedWidth = 768");
  assert(result.placedHeight === 1024, "placedHeight = 1024");
  assert(result.offsetX > 0, "offsetX > 0 (horizontal padding)");
  assert(result.offsetY === 0, "offsetY = 0 (fills height)");
}

async function testSquare() {
  console.log("\n[3] Square image (2000×2000)");
  const input = await createFixture("square", 2000, 2000);
  const output = path.join(OUTPUT_DIR, "square_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.resizedWidth === 1600, "resizedWidth = 1600");
  assert(result.resizedHeight === 1600, "resizedHeight = 1600");
  // 1600 > 1024 → fitScale = 1024/1600 = 0.64
  assertApprox(result.fitScale, 0.64, 0.01, "fitScale ≈ 0.64");
  assert(result.placedWidth === 1024, "placedWidth = 1024");
  assert(result.placedHeight === 1024, "placedHeight = 1024");
  assert(result.offsetX === result.offsetY, "offsetX = offsetY (centered)");
}

async function testMaxSideDownscale() {
  console.log("\n[4] Max-side downscale (8000×6000, maxSide=1600)");
  const input = await createFixture("big", 8000, 6000);
  const output = path.join(OUTPUT_DIR, "big_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.resizedWidth === 1600, "resizedWidth = 1600");
  assert(result.resizedHeight === 1200, "resizedHeight = 1200");
  assertApprox(result.scale, 0.2, 0.001, "scale = 0.2");
}

async function testSmallImageNoUpscale() {
  console.log("\n[5] Small image (800×600) — must NOT upscale");
  const input = await createFixture("small", 800, 600);
  const output = path.join(OUTPUT_DIR, "small_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.scale === 1, "scale = 1 (no upscale)");
  assert(result.resizedWidth === 800, "resizedWidth = 800 (unchanged)");
  assert(result.resizedHeight === 600, "resizedHeight = 600 (unchanged)");
  // 800 <= 1024 and 600 <= 1024 → fitScale = 1
  assert(result.fitScale === 1, "fitScale = 1 (fits in canvas)");
  assert(result.placedWidth === 800, "placedWidth = 800");
  assert(result.placedHeight === 600, "placedHeight = 600");
}

async function testCanvasOutputSize() {
  console.log("\n[6] Canvas output is always 1024×1024");
  const input = await createFixture("canvas_test", 2400, 1800);
  const output = path.join(OUTPUT_DIR, "canvas_out.jpg");
  await normalizeGarment(input, output);

  const outMeta = await sharp(output).metadata();
  assert(outMeta.width === 1024, "output width = 1024");
  assert(outMeta.height === 1024, "output height = 1024");
}

async function testAspectRatioPreserved() {
  console.log("\n[7] Aspect ratio preserved");
  const input = await createFixture("ratio", 3200, 2400);
  const output = path.join(OUTPUT_DIR, "ratio_out.jpg");
  const result = await normalizeGarment(input, output);

  const inputRatio = result.orientedWidth / result.orientedHeight;
  const resizedRatio = result.resizedWidth / result.resizedHeight;
  assertApprox(resizedRatio, inputRatio, 0.02, "aspect ratio preserved (resized)");
}

async function testCenteredOffset() {
  console.log("\n[8] Centered offset calculation");
  const input = await createFixture("offset", 1600, 800);
  const output = path.join(OUTPUT_DIR, "offset_out.jpg");
  const result = await normalizeGarment(input, output);

  // 1600×800 → oriented same, scale=1 (1600 <= maxSide 1600)
  // resizedWidth=1600, resizedHeight=800
  // fitScale = min(1024/1600, 1024/800, 1) = 0.64
  // placedWidth = 1024, placedHeight = 512
  // offsetX = (1024 - 1024) / 2 = 0
  // offsetY = (1024 - 512) / 2 = 256
  assert(result.resizedWidth === 1600, "resizedWidth = 1600");
  assert(result.resizedHeight === 800, "resizedHeight = 800");
  assertApprox(result.fitScale, 0.64, 0.01, "fitScale ≈ 0.64");
  assert(result.placedWidth === 1024, "placedWidth = 1024");
  assert(result.placedHeight === 512, "placedHeight = 512");
  assert(result.offsetX === 0, "offsetX = 0");
  assert(result.offsetY === 256, "offsetY = 256");
}

async function testParameterOverride() {
  console.log("\n[9] Parameter override");
  const input = await createFixture("override", 4000, 3000);
  const output = path.join(OUTPUT_DIR, "override_out.jpg");
  const result = await normalizeGarment(input, output, {
    maxSide: 800,
    canvasWidth: 512,
    canvasHeight: 512
  });

  assert(result.canvasWidth === 512, "canvasWidth = 512 (overridden)");
  assert(result.canvasHeight === 512, "canvasHeight = 512 (overridden)");
  assert(result.resizedWidth === 800, "resizedWidth = 800 (maxSide overridden)");
  assert(result.resizedHeight === 600, "resizedHeight = 600");
}

async function testIllegalParameters() {
  console.log("\n[10] Illegal parameters");
  const input = await createFixture("illegal", 100, 100);
  const output = path.join(OUTPUT_DIR, "illegal_out.jpg");

  let caught = false;
  try {
    await normalizeGarment(input, output, { maxSide: 0 });
  } catch (err) {
    caught = err.message.includes("maxSide");
  }
  assert(caught, "maxSide=0 throws Error");

  caught = false;
  try {
    await normalizeGarment(input, output, { canvasWidth: -1 });
  } catch (err) {
    caught = err.message.includes("canvasWidth");
  }
  assert(caught, "canvasWidth=-1 throws Error");

  caught = false;
  try {
    await normalizeGarment(input, output, { canvasHeight: 0 });
  } catch (err) {
    caught = err.message.includes("canvasHeight");
  }
  assert(caught, "canvasHeight=0 throws Error");
}

async function testNonExistentFile() {
  console.log("\n[11] Non-existent file");
  const output = path.join(OUTPUT_DIR, "nofile_out.jpg");

  let caught = false;
  try {
    await normalizeGarment("/tmp/does_not_exist_poc_test.jpg", output);
  } catch (err) {
    caught = err.message.includes("does not exist");
  }
  assert(caught, "non-existent file throws Error");
}

async function testUnparseableImage() {
  console.log("\n[12] Unparseable image");
  const badFile = path.join(FIXTURES_DIR, "bad.jpg");
  fs.writeFileSync(badFile, "this is not an image");
  const output = path.join(OUTPUT_DIR, "bad_out.jpg");

  let caught = false;
  try {
    await normalizeGarment(badFile, output);
  } catch (err) {
    caught = true;
  }
  assert(caught, "unparseable file throws Error");
}

async function testEXIFOrientation() {
  console.log("\n[13] EXIF Orientation — dimension swap");
  // Create a 200×400 image with orientation=6 (rotated 90° CW)
  // After correction, effective dimensions should be 400×200
  const input = await createFixtureWithEXIF("exif_rot", 200, 400, 6);
  const output = path.join(OUTPUT_DIR, "exif_out.jpg");
  const result = await normalizeGarment(input, output);

  // inputWidth/inputHeight: raw pixel dimensions (no EXIF)
  assert(result.inputWidth === 200, "inputWidth = 200 (raw)");
  assert(result.inputHeight === 400, "inputHeight = 400 (raw)");
  // orientedWidth/orientedHeight: after EXIF correction
  assert(result.orientedWidth === 400, "orientedWidth = 400 (post-EXIF)");
  assert(result.orientedHeight === 200, "orientedHeight = 200 (post-EXIF)");
  // scale = 1 (400 <= 1600)
  assert(result.scale === 1, "scale = 1");
  assert(result.resizedWidth === 400, "resizedWidth = 400");
  assert(result.resizedHeight === 200, "resizedHeight = 200");
  // Canvas output
  assert(result.canvasWidth === 1024, "canvasWidth = 1024");
  assert(result.canvasHeight === 1024, "canvasHeight = 1024");
  const outMeta = await sharp(result.outputPath).metadata();
  assert(outMeta.width === 1024, "output width = 1024");
  assert(outMeta.height === 1024, "output height = 1024");
}

async function testEXIFDirectionalVerification() {
  console.log("\n[14] EXIF Orientation — directional pixel verification");
  // Create a directional fixture: top=red, bottom=blue, 200×400, orientation=6
  // Orientation 6 means: rotate 90° CW to display correctly
  // After rotation: the red (was top) should be on the LEFT, blue on the RIGHT
  const input = await createDirectionalFixture("exif_dir", 200, 400, 6);
  const output = path.join(OUTPUT_DIR, "exif_dir_out.jpg");
  const result = await normalizeGarment(input, output);

  // Verify dimensions swapped
  assert(result.orientedWidth === 400, "orientedWidth = 400 (swapped)");
  assert(result.orientedHeight === 200, "orientedHeight = 200 (swapped)");

  // Verify pixel direction: sample left side (should be red-dominant)
  // and right side (should be blue-dominant)
  // The placed image is 400×200, centered in 1024×1024
  // offsetX = (1024-400)/2 = 312, offsetY = (1024-200)/2 = 412
  const { data, info } = await sharp(result.outputPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Sample a pixel on the left side of the placed image (within the image area)
  const sampleX_left = result.offsetX + 10;
  const sampleY_mid = result.offsetY + Math.round(result.placedHeight / 2);
  const idx_left = (sampleY_mid * info.width + sampleX_left) * info.channels;

  // Sample a pixel on the right side
  const sampleX_right = result.offsetX + result.placedWidth - 10;
  const idx_right = (sampleY_mid * info.width + sampleX_right) * info.channels;

  const leftR = data[idx_left];
  const leftB = data[idx_left + 2];
  const rightR = data[idx_right];
  const rightB = data[idx_right + 2];

  // After 90° CW rotation: top (red) → right side, bottom (blue) → left side
  // Wait, let me think again:
  // Original: top=red, bottom=blue (200w × 400h)
  // Orientation 6: "The 0th row is on the right side, and the 0th column is the top"
  // This means rotate 90° CW to display correctly
  // After 90° CW rotation of a top-red/bottom-blue image:
  //   - The top (red) moves to the RIGHT
  //   - The bottom (blue) moves to the LEFT
  // So left side should be blue-dominant, right side should be red-dominant
  assert(leftB > leftR, "left side is blue-dominant (bottom rotated to left)");
  assert(rightR > rightB, "right side is red-dominant (top rotated to right)");
}

async function testDeterministic() {
  console.log("\n[15] Deterministic: same input → same output");
  const input = await createFixture("determ", 2400, 1800);
  const out1 = path.join(OUTPUT_DIR, "determ_1.jpg");
  const out2 = path.join(OUTPUT_DIR, "determ_2.jpg");

  const r1 = await normalizeGarment(input, out1);
  const r2 = await normalizeGarment(input, out2);

  assert(r1.orientedWidth === r2.orientedWidth, "same orientedWidth");
  assert(r1.orientedHeight === r2.orientedHeight, "same orientedHeight");
  assert(r1.resizedWidth === r2.resizedWidth, "same resizedWidth");
  assert(r1.resizedHeight === r2.resizedHeight, "same resizedHeight");
  assert(r1.placedWidth === r2.placedWidth, "same placedWidth");
  assert(r1.placedHeight === r2.placedHeight, "same placedHeight");
  assert(r1.offsetX === r2.offsetX, "same offsetX");
  assert(r1.offsetY === r2.offsetY, "same offsetY");
  assert(r1.scale === r2.scale, "same scale");
  assert(r1.fitScale === r2.fitScale, "same fitScale");

  // Compare output buffers
  const buf1 = fs.readFileSync(out1);
  const buf2 = fs.readFileSync(out2);
  assert(buf1.equals(buf2), "identical output bytes");
}

// ── Runner ───────────────────────────────────────────────────────────

async function run() {
  console.log("=== POC-01 Garment Normalization Tests ===");
  setup();

  try {
    await testLandscape();
    await testPortrait();
    await testSquare();
    await testMaxSideDownscale();
    await testSmallImageNoUpscale();
    await testCanvasOutputSize();
    await testAspectRatioPreserved();
    await testCenteredOffset();
    await testParameterOverride();
    await testIllegalParameters();
    await testNonExistentFile();
    await testUnparseableImage();
    await testEXIFOrientation();
    await testEXIFDirectionalVerification();
    await testDeterministic();
  } catch (err) {
    console.error("\nUnexpected error:", err);
    failed++;
  }

  console.log("\n=== Results ===");
  console.log("Passed: " + passed);
  console.log("Failed: " + failed);
  console.log("Total:  " + (passed + failed));

  teardown();

  if (failed > 0) {
    process.exit(1);
  }
}

run();

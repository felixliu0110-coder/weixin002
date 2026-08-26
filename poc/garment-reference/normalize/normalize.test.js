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
  assert(result.scale < 1, "scale < 1 (downscaled)");
  assertApprox(result.scale, 1600 / 4000, 0.01, "scale ≈ 0.4");
  assert(result.normalizedWidth === 1600, "normalizedWidth = 1600");
  assert(result.normalizedHeight === 1200, "normalizedHeight = 1200");
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
  assert(result.normalizedWidth === 1200, "normalizedWidth = 1200");
  assert(result.normalizedHeight === 1600, "normalizedHeight = 1600");
  assert(result.offsetX > 0, "offsetX > 0 (horizontal padding)");
  assert(result.offsetY === 0, "offsetY = 0 (fills height)");
}

async function testSquare() {
  console.log("\n[3] Square image (2000×2000)");
  const input = await createFixture("square", 2000, 2000);
  const output = path.join(OUTPUT_DIR, "square_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.normalizedWidth === 1600, "normalizedWidth = 1600");
  assert(result.normalizedHeight === 1600, "normalizedHeight = 1600");
  assert(result.offsetX === result.offsetY, "offsetX = offsetY (centered)");
}

async function testMaxSideDownscale() {
  console.log("\n[4] Max-side downscale (8000×6000, maxSide=1600)");
  const input = await createFixture("big", 8000, 6000);
  const output = path.join(OUTPUT_DIR, "big_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.normalizedWidth === 1600, "normalizedWidth = 1600");
  assert(result.normalizedHeight === 1200, "normalizedHeight = 1200");
  assertApprox(result.scale, 0.2, 0.001, "scale = 0.2");
}

async function testSmallImageNoUpscale() {
  console.log("\n[5] Small image (800×600) — must NOT upscale");
  const input = await createFixture("small", 800, 600);
  const output = path.join(OUTPUT_DIR, "small_out.jpg");
  const result = await normalizeGarment(input, output);

  assert(result.scale === 1, "scale = 1 (no upscale)");
  assert(result.normalizedWidth === 800, "normalizedWidth = 800 (unchanged)");
  assert(result.normalizedHeight === 600, "normalizedHeight = 600 (unchanged)");
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

  const inputRatio = result.inputWidth / result.inputHeight;
  const normalizedRatio = result.normalizedWidth / result.normalizedHeight;
  assertApprox(normalizedRatio, inputRatio, 0.02, "aspect ratio preserved");
}

async function testCenteredOffset() {
  console.log("\n[8] Centered offset calculation");
  const input = await createFixture("offset", 1600, 800);
  const output = path.join(OUTPUT_DIR, "offset_out.jpg");
  const result = await normalizeGarment(input, output);

  // 1600×800 → longest=1600, scale=1 (1600 <= maxSide 1600)
  // normalizedWidth=1600, normalizedHeight=800
  // But 1600 > canvasWidth 1024, so fitScale = min(1024/1600, 1024/800, 1) = 0.64
  // finalWidth = 1024, finalHeight = 512
  // offsetX = (1024 - 1024) / 2 = 0
  // offsetY = (1024 - 512) / 2 = 256
  const expectedOffsetX = 0;
  const expectedOffsetY = 256;
  assert(result.offsetX === expectedOffsetX, "offsetX = " + expectedOffsetX);
  assert(result.offsetY === expectedOffsetY, "offsetY = " + expectedOffsetY);
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
  assert(result.normalizedWidth === 800, "normalizedWidth = 800 (maxSide overridden)");
  assert(result.normalizedHeight === 600, "normalizedHeight = 600");
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
  console.log("\n[13] EXIF Orientation correction");
  // Create a 200×400 image with orientation=6 (rotated 90° CW)
  // After correction, effective dimensions should be 400×200
  const input = await createFixtureWithEXIF("exif_rot", 200, 400, 6);
  const output = path.join(OUTPUT_DIR, "exif_out.jpg");
  const result = await normalizeGarment(input, output);

  // After EXIF correction: effective 400×200
  // longest = 400, scale = 1 (400 <= 1600)
  // normalizedWidth = 400, normalizedHeight = 200
  // Both fit within canvas 1024×1024
  // The key check: output image should be correctly oriented
  // Since 400×200 fits in canvas, offsetX and offsetY should center it
  assert(result.canvasWidth === 1024, "canvasWidth = 1024");
  assert(result.canvasHeight === 1024, "canvasHeight = 1024");
  // Verify the output file exists and is valid
  const outMeta = await sharp(result.outputPath).metadata();
  assert(outMeta.width === 1024, "output width = 1024");
  assert(outMeta.height === 1024, "output height = 1024");
}

async function testDeterministic() {
  console.log("\n[14] Deterministic: same input → same output");
  const input = await createFixture("determ", 2400, 1800);
  const out1 = path.join(OUTPUT_DIR, "determ_1.jpg");
  const out2 = path.join(OUTPUT_DIR, "determ_2.jpg");

  const r1 = await normalizeGarment(input, out1);
  const r2 = await normalizeGarment(input, out2);

  assert(r1.normalizedWidth === r2.normalizedWidth, "same normalizedWidth");
  assert(r1.normalizedHeight === r2.normalizedHeight, "same normalizedHeight");
  assert(r1.offsetX === r2.offsetX, "same offsetX");
  assert(r1.offsetY === r2.offsetY, "same offsetY");
  assert(r1.scale === r2.scale, "same scale");

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

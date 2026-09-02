/**
 * POC-01: Deterministic Garment Reference Normalization
 *
 * Pure deterministic image preprocessing:
 *   1. EXIF orientation correction
 *   2. Max-side constraint (downscale only, never upscale)
 *   3. Aspect-ratio-preserving resize
 *   4. Fixed canvas with centered padding
 *
 * No AI, no segmentation, no background removal, no GPU.
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const DEFAULT_OPTIONS = {
  maxSide: 1600,
  canvasWidth: 1024,
  canvasHeight: 1024
};

/**
 * Normalize a garment photo into a deterministic reference image.
 *
 * @param {string} inputPath  - Absolute path to the source image.
 * @param {string} outputPath - Absolute path for the normalized output.
 * @param {object} [options]  - Override default parameters.
 * @returns {Promise<object>}  Metadata about the normalization result.
 */
async function normalizeGarment(inputPath, outputPath, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);

  // ── Validate parameters ──────────────────────────────────────────
  if (opts.maxSide <= 0) {
    throw new Error("maxSide must be > 0");
  }
  if (opts.canvasWidth <= 0) {
    throw new Error("canvasWidth must be > 0");
  }
  if (opts.canvasHeight <= 0) {
    throw new Error("canvasHeight must be > 0");
  }

  // ── Validate input file ──────────────────────────────────────────
  if (!inputPath || typeof inputPath !== "string") {
    throw new Error("inputPath must be a non-empty string");
  }
  if (!fs.existsSync(inputPath)) {
    throw new Error("Input file does not exist: " + inputPath);
  }

  const stat = fs.statSync(inputPath);
  if (!stat.isFile()) {
    throw new Error("Input path is not a file: " + inputPath);
  }

  // ── Read metadata ────────────────────────────────────────────────
  let sourceMeta;
  try {
    sourceMeta = await sharp(inputPath, { failOn: "none" }).metadata();
  } catch (err) {
    throw new Error("Unable to parse image: " + err.message);
  }

  // Raw pixel dimensions (no EXIF correction)
  const inputWidth = sourceMeta.width;
  const inputHeight = sourceMeta.height;

  if (!inputWidth || inputWidth <= 0) {
    throw new Error("Invalid image width: " + inputWidth);
  }
  if (!inputHeight || inputHeight <= 0) {
    throw new Error("Invalid image height: " + inputHeight);
  }

  // EXIF-aware visual dimensions (after auto-orientation)
  // Use rotate().metadata() to get post-orientation dimensions.
  let orientedWidth = inputWidth;
  let orientedHeight = inputHeight;

  if (sourceMeta.orientation && sourceMeta.orientation >= 5) {
    // Orientations 5-8 involve a 90°/270° rotation → dimensions swap
    orientedWidth = inputHeight;
    orientedHeight = inputWidth;
  }

  // ── Step 1: EXIF orientation correction ──────────────────────────
  // sharp().rotate() without arguments reads EXIF Orientation tag
  // and rotates the pixel data accordingly.
  let pipeline = sharp(inputPath, { failOn: "none" }).rotate();

  // ── Step 2: Max-side constraint (downscale only) ─────────────────
  const longestSide = Math.max(orientedWidth, orientedHeight);
  let scale = 1;

  if (longestSide > opts.maxSide) {
    scale = opts.maxSide / longestSide;
  }
  // If longestSide <= maxSide → scale stays 1 (no upscale).

  const resizedWidth = Math.round(orientedWidth * scale);
  const resizedHeight = Math.round(orientedHeight * scale);

  if (scale < 1) {
    pipeline = pipeline.resize(resizedWidth, resizedHeight, {
      fit: "fill",
      kernel: "lanczos3"
    });
  }

  // ── Step 3: Convert to sRGB ──────────────────────────────────────
  pipeline = pipeline.toColourspace("srgb");

  // ── Step 4: Fixed canvas with centered padding ───────────────────
  // If the resized image exceeds canvas dimensions, scale it down to fit.
  const fitScale = Math.min(
    opts.canvasWidth / resizedWidth,
    opts.canvasHeight / resizedHeight,
    1 // never upscale
  );

  const placedWidth = Math.round(resizedWidth * fitScale);
  const placedHeight = Math.round(resizedHeight * fitScale);

  if (fitScale < 1) {
    pipeline = pipeline.resize(placedWidth, placedHeight, {
      fit: "fill",
      kernel: "lanczos3"
    });
  }

  const offsetX = Math.round((opts.canvasWidth - placedWidth) / 2);
  const offsetY = Math.round((opts.canvasHeight - placedHeight) / 2);

  // Create a white canvas and composite the placed image on top.
  const canvas = sharp({
    create: {
      width: opts.canvasWidth,
      height: opts.canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  });

  const placedBuffer = await pipeline.toBuffer();

  const finalPipeline = canvas.composite([
    {
      input: placedBuffer,
      left: offsetX,
      top: offsetY
    }
  ]);

  // ── Step 5: Write output ─────────────────────────────────────────
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await finalPipeline
    .jpeg({ quality: 92, mozjpeg: false })
    .toFile(outputPath);

  return {
    inputWidth,
    inputHeight,
    orientedWidth,
    orientedHeight,
    resizedWidth,
    resizedHeight,
    placedWidth,
    placedHeight,
    canvasWidth: opts.canvasWidth,
    canvasHeight: opts.canvasHeight,
    scale,
    fitScale,
    offsetX,
    offsetY,
    outputPath
  };
}

module.exports = { normalizeGarment, DEFAULT_OPTIONS };

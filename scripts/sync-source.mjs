#!/usr/bin/env node
/**
 * Import only dachitech's already-published projection and the images it names.
 * The source tree is opened read-only; no raw workbook, photos, or private audits
 * are copied into this app.
 *
 * Usage: node scripts/sync-source.mjs /absolute/path/to/dachitech [--check]
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceArgument = process.argv[2];
const checkOnly = process.argv.includes('--check');

if (!sourceArgument || sourceArgument.startsWith('--') || !isAbsolute(sourceArgument)) {
  console.error('Usage: node scripts/sync-source.mjs /absolute/path/to/dachitech [--check]');
  process.exit(2);
}

const sourceRoot = await realpath(sourceArgument);
const sourceJson = join(sourceRoot, 'src/data/restaurants.generated.json');
const targetJson = join(projectRoot, 'src/data/restaurants.generated.json');
const targetManifest = join(projectRoot, 'data/source-manifest.json');
const sourcePublicRoot = await realpath(join(sourceRoot, 'public'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const fail = (message) => { throw new Error(message); };

function requireField(record, key, type) {
  if (typeof record[key] !== type) fail(`Invalid ${key} on restaurant ${record.id ?? '(missing id)'}`);
}

function validateRestaurant(record, index) {
  if (!record || typeof record !== 'object') fail(`Restaurant ${index} is not an object`);
  for (const key of ['id', 'slug', 'regionSlug', 'actualCity', 'brand', 'reviewText', 'address']) {
    requireField(record, key, 'string');
  }
  for (const key of ['cuisineTags', 'dishes', 'branches', 'images']) {
    if (!Array.isArray(record[key])) fail(`Invalid ${key} on ${record.id}`);
  }
  if (!['s3', 's2', 's1', 'bib', 'sel', 'tbd', 'daiChi'].includes(record.recommendationLevel)) {
    fail(`Unknown guide level on ${record.id}`);
  }
  if (![null, 'GCJ02', 'WGS84'].includes(record.coordSystem)) fail(`Unknown coordinate system on ${record.id}`);
  if ((record.lng === null) !== (record.lat === null)) fail(`Incomplete coordinate pair on ${record.id}`);
  if (record.lng !== null && (!Number.isFinite(record.lng) || !Number.isFinite(record.lat))) {
    fail(`Invalid coordinates on ${record.id}`);
  }
  if (record.lng !== null && record.coordSystem === null) fail(`Coordinate system missing on ${record.id}`);
  if (record.coverImage !== null && typeof record.coverImage !== 'string') fail(`Invalid coverImage on ${record.id}`);
  for (const image of record.images) {
    if (!image || typeof image.src !== 'string' || typeof image.thumb !== 'string') fail(`Invalid image on ${record.id}`);
  }
}

function validateImagePath(relativePath) {
  // All imported assets must be public restaurant WebP files; reject traversal and links.
  if (!/^images\/r\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.webp$/.test(relativePath)) {
    fail(`Unsafe or unexpected image path: ${relativePath}`);
  }
  return relativePath;
}

async function atomicWrite(path, buffer) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.sync-${process.pid}`;
  await writeFile(temporary, buffer);
  await rename(temporary, path);
}

const sourceBytes = await readFile(sourceJson);
const parsed = JSON.parse(sourceBytes.toString('utf8'));
if (!Array.isArray(parsed.restaurants) || !Array.isArray(parsed.regions) || typeof parsed.generatedAt !== 'string') {
  fail('Unexpected public projection schema');
}

const ids = new Set();
const imagePaths = new Set();
for (const [index, restaurant] of parsed.restaurants.entries()) {
  validateRestaurant(restaurant, index);
  if (ids.has(restaurant.id)) fail(`Duplicate restaurant ID: ${restaurant.id}`);
  ids.add(restaurant.id);
  if (restaurant.coverImage) imagePaths.add(validateImagePath(restaurant.coverImage));
  for (const image of restaurant.images) {
    imagePaths.add(validateImagePath(image.src));
    imagePaths.add(validateImagePath(image.thumb));
  }
}

// Validate every referenced asset before changing any target file.
const images = [];
for (const relativePath of [...imagePaths].sort()) {
  const sourcePath = await realpath(join(sourcePublicRoot, relativePath));
  if (!sourcePath.startsWith(`${sourcePublicRoot}${sep}`)) fail(`Image escaped public directory: ${relativePath}`);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) fail(`Not a file: ${relativePath}`);
  const bytes = await readFile(sourcePath);
  images.push({ path: relativePath, sha256: sha256(bytes), bytes: bytes.length, sourcePath });
}

const manifest = {
  source: 'dachitech public projection',
  generatedAt: parsed.generatedAt,
  projectionSha256: sha256(sourceBytes),
  restaurantCount: parsed.restaurants.length,
  imageAssetCount: images.length,
  imageAssetBytes: images.reduce((total, image) => total + image.bytes, 0),
  images: images.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })),
};

if (checkOnly) {
  const importedBytes = await readFile(targetJson);
  if (sha256(importedBytes) !== manifest.projectionSha256) fail('Imported projection differs from source');
  const importedManifest = JSON.parse(await readFile(targetManifest, 'utf8'));
  if (JSON.stringify(importedManifest) !== JSON.stringify(manifest)) fail('Import manifest differs from source');
  for (const image of images) {
    const imported = await readFile(join(projectRoot, 'public', image.path));
    if (sha256(imported) !== image.sha256) fail(`Imported image differs from source: ${image.path}`);
  }
} else {
  await atomicWrite(targetJson, sourceBytes);
  for (const image of images) {
    const destination = join(projectRoot, 'public', image.path);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.sync-${process.pid}`;
    await copyFile(image.sourcePath, temporary);
    await rename(temporary, destination);
  }
  await atomicWrite(targetManifest, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
}

console.log(`${checkOnly ? 'Verified' : 'Imported'} ${manifest.restaurantCount} restaurants and ${manifest.imageAssetCount} images (${(manifest.imageAssetBytes / 1024 / 1024).toFixed(1)} MiB).`);
console.log(`Projection SHA-256: ${manifest.projectionSha256}`);

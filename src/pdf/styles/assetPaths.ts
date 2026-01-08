/**
 * Asset Path Utilities
 * 
 * Helper functions to resolve filesystem paths for assets (fonts, images, etc.)
 * in Node.js serverless environments.
 * 
 * IMPORTANT: In serverless environments, assets must be accessed via filesystem
 * paths using process.cwd(), NOT web URLs.
 */

import path from 'node:path';

/**
 * Gets the base path for the application.
 * In serverless environments (Vercel, Lambda), process.cwd() returns
 * the correct deployment directory.
 */
function getBasePath(): string {
  return process.cwd();
}

/**
 * Resolves an absolute filesystem path to a font file.
 * 
 * @param filename - Font filename (e.g., 'NotoSans-Regular.ttf')
 * @returns Absolute filesystem path to the font file
 */
export function getFontPath(filename: string): string {
  return path.join(getBasePath(), 'public', 'fonts', filename);
}

/**
 * Resolves an absolute filesystem path to an image file.
 * 
 * @param filename - Image filename (e.g., 'logo.svg', 'logo.png')
 * @returns Absolute filesystem path to the image file
 */
export function getImagePath(filename: string): string {
  return path.join(getBasePath(), 'public', filename);
}

/**
 * Resolves an absolute filesystem path to any asset in the public directory.
 * 
 * @param relativePath - Relative path from public directory (e.g., 'images/logo.png')
 * @returns Absolute filesystem path to the asset
 */
export function getPublicAssetPath(relativePath: string): string {
  return path.join(getBasePath(), 'public', relativePath);
}

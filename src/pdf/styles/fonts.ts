/**
 * Font Configuration for PDF Generation
 * 
 * Registers embedded fonts with full PT-BR character support.
 * Uses Noto Sans which includes accents, cedilla, and other
 * Portuguese-specific characters.
 * 
 * IMPORTANT: Fonts must be embedded in the repository (public/fonts/)
 * and loaded using filesystem paths in Node.js serverless environments.
 */

import { Font } from '@react-pdf/renderer';
import { getFontPath } from './assetPaths';

// Track whether fonts have been registered
let fontsRegistered = false;

/**
 * Registers Noto Sans font family for PDF rendering.
 * Safe to call multiple times - only registers once per process.
 * 
 * Noto Sans provides excellent PT-BR support including:
 * - All Portuguese accents (á, é, í, ó, ú, â, ê, ô, ã, õ)
 * - Cedilla (ç, Ç)
 * - Typographic quotes („ ")
 * - Em-dash (—) and other special characters
 */
export function registerFonts(): void {
  if (fontsRegistered) {
    return;
  }

  // Register Noto Sans family with multiple weights and styles
  // CRITICAL: Use filesystem paths via getFontPath(), not web URLs
  Font.register({
    family: 'NotoSans',
    fonts: [
      {
        src: getFontPath('NotoSans-Regular.ttf'),
        fontWeight: 400,
        fontStyle: 'normal',
      },
      {
        src: getFontPath('NotoSans-Italic.ttf'),
        fontWeight: 400,
        fontStyle: 'italic',
      },
      {
        src: getFontPath('NotoSans-Medium.ttf'),
        fontWeight: 500,
        fontStyle: 'normal',
      },
      {
        src: getFontPath('NotoSans-Bold.ttf'),
        fontWeight: 700,
        fontStyle: 'normal',
      },
    ],
  });

  fontsRegistered = true;
}

// Register fonts at module load time
registerFonts();

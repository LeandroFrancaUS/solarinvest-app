/**
 * Font Configuration for PDF Generation
 * 
 * Registers fonts to be used in PDF documents.
 * Using system-independent fonts to ensure consistent rendering
 * in serverless environments.
 */

import { Font } from '@react-pdf/renderer';

// Track whether fonts have been registered
let fontsRegistered = false;

/**
 * Registers fonts for PDF rendering.
 * Safe to call multiple times - only registers once per process.
 * 
 * Uses Helvetica (built-in PDF font) which is available without
 * external files and works reliably in serverless environments.
 */
export function registerFonts(): void {
  if (fontsRegistered) {
    return;
  }

  // Note: Helvetica is a built-in PDF font, no registration needed
  // If custom fonts are needed later, download .ttf files and register:
  // Font.register({
  //   family: 'Roboto',
  //   fonts: [
  //     { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
  //     { src: '/fonts/Roboto-Medium.ttf', fontWeight: 500 },
  //     { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
  //   ]
  // });

  fontsRegistered = true;
}

// Register fonts at module load time
registerFonts();

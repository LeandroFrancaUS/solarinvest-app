/**
 * Paragraph Component for PDF
 * 
 * Renders formatted text paragraphs with optional conditional rendering.
 */

import { Text } from '@react-pdf/renderer';
import { styles } from '../styles/theme';
import { isNotEmpty } from '../styles/formatters';

export interface ParagraphProps {
  children: string | null | undefined;
  bold?: boolean;
  style?: Record<string, unknown>;
}

/**
 * Renders a paragraph only if the content is not empty.
 * Returns null if content is empty (following the rule to omit empty fields).
 */
export function Paragraph({ children, bold = false, style }: ParagraphProps) {
  if (!isNotEmpty(children)) {
    return null;
  }

  const textStyle = bold ? styles.bodyBold : styles.body;

  return (
    <Text style={[styles.paragraph, textStyle, style]}>
      {children}
    </Text>
  );
}

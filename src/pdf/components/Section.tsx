/**
 * Section Component for PDF
 * 
 * Renders a titled section with content.
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles/theme';
import type { ReactNode } from 'react';

export interface SectionProps {
  title?: string;
  titleLevel?: 'h2' | 'h3' | 'h4';
  children: ReactNode;
}

export function Section({ title, titleLevel = 'h2', children }: SectionProps) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles[titleLevel]}>{title}</Text>}
      {children}
    </View>
  );
}

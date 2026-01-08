/**
 * Header Component for PDF
 * 
 * Renders the header section of PDF documents with title and optional metadata.
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles/theme';
import type { ReactNode } from 'react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.h1}>{title}</Text>
      {subtitle && <Text style={[styles.body, { textAlign: 'center', marginBottom: 8 }]}>{subtitle}</Text>}
      {children}
    </View>
  );
}

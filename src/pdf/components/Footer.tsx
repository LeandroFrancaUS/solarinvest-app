/**
 * Footer Component for PDF
 * 
 * Renders the footer section with page numbers and optional text.
 */

import { View, Text } from '@react-pdf/renderer';
import { styles } from '../styles/theme';

export interface FooterProps {
  text?: string;
  showPageNumbers?: boolean;
}

export function Footer({ text, showPageNumbers = true }: FooterProps) {
  return (
    <View style={styles.footer} fixed>
      {text && <Text style={{ marginBottom: 4 }}>{text}</Text>}
      {showPageNumbers && (
        <Text
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          fixed
        />
      )}
    </View>
  );
}

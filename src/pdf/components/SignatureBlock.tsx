/**
 * SignatureBlock Component for PDF
 * 
 * Renders signature lines for contract parties and witnesses.
 */

import { View, Text } from '@react-pdf/renderer';
import { styles, SPACING } from '../styles/theme';
import { isNotEmpty } from '../styles/formatters';

export interface SignatureProps {
  name: string;
  document?: string;
  role?: string;
}

export interface SignatureBlockProps {
  contractorSignature?: SignatureProps;
  contracteeSignature?: SignatureProps;
  witnesses?: SignatureProps[];
  cityDate?: string;
}

export function SignatureBlock({
  contractorSignature,
  contracteeSignature,
  witnesses = [],
  cityDate,
}: SignatureBlockProps) {
  return (
    <View style={styles.signatureBlock}>
      {/* City and Date */}
      {isNotEmpty(cityDate) && (
        <Text style={[styles.body, { marginBottom: SPACING.xl, textAlign: 'center' }]}>
          {cityDate}
        </Text>
      )}

      {/* Contractor Signature */}
      {contractorSignature && (
        <View style={{ marginBottom: SPACING.xl }}>
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{contractorSignature.name}</Text>
            {isNotEmpty(contractorSignature.document) && (
              <Text style={styles.small}>{contractorSignature.document}</Text>
            )}
            {isNotEmpty(contractorSignature.role) && (
              <Text style={styles.small}>{contractorSignature.role}</Text>
            )}
          </View>
        </View>
      )}

      {/* Contractee Signature */}
      {contracteeSignature && (
        <View style={{ marginBottom: SPACING.xl }}>
          <View style={styles.signatureLine}>
            <Text style={styles.body}>{contracteeSignature.name}</Text>
            {isNotEmpty(contracteeSignature.document) && (
              <Text style={styles.small}>{contracteeSignature.document}</Text>
            )}
            {isNotEmpty(contracteeSignature.role) && (
              <Text style={styles.small}>{contracteeSignature.role}</Text>
            )}
          </View>
        </View>
      )}

      {/* Witnesses */}
      {witnesses.length > 0 && (
        <View>
          <Text style={[styles.h4, { marginTop: SPACING.xl, marginBottom: SPACING.md }]}>
            TESTEMUNHAS:
          </Text>
          {witnesses.map((witness, index) => (
            <View key={index} style={{ marginBottom: SPACING.lg }}>
              <View style={styles.signatureLine}>
                <Text style={styles.body}>{witness.name}</Text>
                {isNotEmpty(witness.document) && (
                  <Text style={styles.small}>{witness.document}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

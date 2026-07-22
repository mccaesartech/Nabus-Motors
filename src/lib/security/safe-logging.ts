const SENSITIVE_FIELD_PATTERN =
  /address|authorization|body|code|email|message|name|notes|otp|password|phone|secret|token|url/i;

export type SafeRecordSummary = {
  fieldCount: number;
  fields: string[];
  sensitiveFieldsOmitted: string[];
};

/**
 * Describe an operational payload without serializing any values. Sensitive
 * field names are grouped separately so logs can prove redaction occurred.
 */
export function summarizeRecordForLog(
  record: Record<string, unknown>
): SafeRecordSummary {
  const fields: string[] = [];
  const sensitiveFieldsOmitted: string[] = [];

  for (const key of Object.keys(record).sort()) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      sensitiveFieldsOmitted.push(key);
    } else {
      fields.push(key);
    }
  }

  return {
    fieldCount: fields.length + sensitiveFieldsOmitted.length,
    fields,
    sensitiveFieldsOmitted,
  };
}

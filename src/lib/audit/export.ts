import type { AuditLogRow } from "./types";
import { formatAuditLocation } from "./types";
import { AUDIT_ACTION_LABELS, isAuditAction } from "./actions";

const CSV_COLUMNS = [
  "timestamp",
  "action",
  "success",
  "actor_name",
  "actor_role",
  "actor_user_id",
  "target_type",
  "target_id",
  "target_name",
  "ip_address",
  "location",
  "browser",
  "operating_system",
  "request_id",
  "error_message",
  "metadata",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function actionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

function rowToCsvRecord(row: AuditLogRow): Record<(typeof CSV_COLUMNS)[number], string> {
  return {
    timestamp: row.timestamp,
    action: actionLabel(row.action),
    success: row.success ? "success" : "failed",
    actor_name: row.actor_name ?? "",
    actor_role: row.actor_role ?? "",
    actor_user_id: row.actor_user_id ?? "",
    target_type: row.target_type ?? "",
    target_id: row.target_id ?? "",
    target_name: row.target_name ?? "",
    ip_address: row.ip_address ?? "",
    location: formatAuditLocation(row),
    browser: row.browser ?? "",
    operating_system: row.operating_system ?? "",
    request_id: row.request_id ?? "",
    error_message: row.error_message ?? "",
    metadata: JSON.stringify(row.metadata ?? {}),
  };
}

/** CSV export (also opens cleanly in Excel). No xlsx dependency in this repo. */
export function auditLogToCsv(rows: AuditLogRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const body = rows.map((row) => {
    const record = rowToCsvRecord(row);
    return CSV_COLUMNS.map((column) => csvCell(record[column])).join(",");
  });
  return [header, ...body].join("\n");
}

/** Simple printable HTML for client-side PDF (html2pdf.js already in the app). */
export function auditLogToPrintableHtml(rows: AuditLogRow[]): string {
  const escape = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const trs = rows
    .map((row) => {
      const location = formatAuditLocation(row);
      return `<tr class="${row.success ? "" : "fail"}">
        <td>${escape(row.timestamp)}</td>
        <td>${escape(actionLabel(row.action))}</td>
        <td>${row.success ? "OK" : "FAIL"}</td>
        <td>${escape(row.actor_name ?? "—")}</td>
        <td>${escape(row.actor_role ?? "—")}</td>
        <td>${escape(row.target_type ?? "—")}${row.target_name ? ` / ${escape(row.target_name)}` : ""}</td>
        <td>${escape(row.ip_address ?? "—")}</td>
        <td>${escape(location)}</td>
        <td>${escape(row.error_message ?? "")}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Nabus Motors Audit Log</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; font-size: 11px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    p { margin: 0 0 16px; color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    tr.fail td { background: #fde8e8; color: #7f1d1d; }
  </style>
</head>
<body>
  <h1>Nabus Motors — Audit Log</h1>
  <p>Exported ${escape(new Date().toISOString())} · ${rows.length} row(s)</p>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th><th>Action</th><th>Result</th><th>Actor</th><th>Role</th>
        <th>Target</th><th>IP</th><th>Location</th><th>Error</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>
</body>
</html>`;
}

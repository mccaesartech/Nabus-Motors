"use client";

import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { PlatformDateTime } from "@/components/platform/platform-datetime";

type ActivityDetailsProps = {
  action: string;
  metadata: Record<string, unknown>;
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role as PlatformRole] ?? role;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function GenericDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return <span className="text-[var(--platform-text-secondary)]">—</span>;

  return (
    <dl className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="inline font-medium text-[var(--platform-text-primary)] after:content-[':']">
            {key.replace(/_/g, " ")}
          </dt>{" "}
          <dd className="inline break-words text-[var(--platform-text-secondary)]">
            {formatMetadataValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TeamMessageDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const body = typeof metadata.body === "string" ? metadata.body : null;
  const conversationLabel =
    typeof metadata.conversation_label === "string" ? metadata.conversation_label : null;
  const channelType = typeof metadata.channel_type === "string" ? metadata.channel_type : null;
  const sentAt = typeof metadata.sent_at === "string" ? metadata.sent_at : null;
  const senderRole =
    typeof metadata.sender_role_label === "string"
      ? metadata.sender_role_label
      : typeof metadata.sender_role === "string"
        ? roleLabel(metadata.sender_role)
        : null;
  const senderName = typeof metadata.sender_name === "string" ? metadata.sender_name : null;
  const senderEmail = typeof metadata.sender_email === "string" ? metadata.sender_email : null;
  const participants = Array.isArray(metadata.participants)
    ? (metadata.participants as Array<{ name?: string; email?: string; role?: string }>)
    : [];

  return (
    <div className="max-w-md space-y-2">
      {conversationLabel ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--platform-surface-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--platform-text-primary)]">
            {conversationLabel}
          </span>
          {channelType ? (
            <span className="text-xs text-[var(--platform-text-secondary)] capitalize">
              {channelType.replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
      ) : null}

      {body ? (
        <blockquote className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-elevated)] px-3 py-2 text-sm text-[var(--platform-text-primary)] whitespace-pre-wrap break-words">
          {body}
        </blockquote>
      ) : (
        <p className="text-xs italic text-[var(--platform-text-secondary)]">Message content unavailable</p>
      )}

      <dl className="space-y-1 text-xs">
        {(senderName || senderEmail || senderRole) && (
          <div>
            <dt className="font-medium text-[var(--platform-text-primary)]">Sender</dt>
            <dd className="text-[var(--platform-text-secondary)]">
              {[senderName, senderEmail, senderRole].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
        {sentAt ? (
          <div>
            <dt className="font-medium text-[var(--platform-text-primary)]">Message sent</dt>
            <dd className="text-[var(--platform-text-secondary)]">
              <PlatformDateTime value={sentAt} className="text-xs" />
            </dd>
          </div>
        ) : null}
        {participants.length > 0 ? (
          <div>
            <dt className="font-medium text-[var(--platform-text-primary)]">Participants</dt>
            <dd className="text-[var(--platform-text-secondary)]">
              {participants
                .map((p) => {
                  const parts = [p.name, p.email, p.role ? roleLabel(p.role) : null].filter(Boolean);
                  return parts.join(" · ");
                })
                .join("; ")}
            </dd>
          </div>
        ) : null}
        {typeof metadata.message_id === "string" ? (
          <div>
            <dt className="font-medium text-[var(--platform-text-primary)]">Message ID</dt>
            <dd className="font-mono text-[10px] text-[var(--platform-text-secondary)] break-all">
              {metadata.message_id}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function ActivityDetails({ action, metadata }: ActivityDetailsProps) {
  const meta = metadata ?? {};

  if (action === "team_message_sent") {
    return <TeamMessageDetails metadata={meta} />;
  }

  return <GenericDetails metadata={meta} />;
}

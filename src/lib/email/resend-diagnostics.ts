import "server-only";

import { Resend } from "resend";
import { readResendApiKey } from "@/lib/email/platform-invite";
import { parseResendFromAddress } from "@/lib/email/resend";
import { RESEND_DOMAIN_SETUP_URL } from "@/lib/email/resend-constants";

/**
 * "The <domain> domain is not verified" is Resend's answer whenever the API key
 * cannot see a verified domain — whether the domain lives in another Resend
 * team, or the key bound to this deployment is not the one the operator thinks
 * they pasted. The send path cannot tell those apart, so this module asks
 * Resend directly which domains the *deployed* key can see.
 *
 * Everything returned here is safe to render to an authenticated admin: the API
 * key is reduced to its last four characters and never leaves this module whole.
 */

/** Shape we rely on from `GET /domains`; Resend may add fields at any time. */
export type ResendDomainRecord = {
  name?: string | null;
  status?: string | null;
  region?: string | null;
  capabilities?: { sending?: string | null } | null;
};

export type ResendDomainSummary = {
  name: string;
  status: string;
  /** Sending region, e.g. `eu-west-1`. Informational — see `regionNote`. */
  region: string | null;
  sendingEnabled: boolean | null;
  matchesFromDomain: boolean;
};

export type ResendProviderFailure = {
  message: string;
  code: string | null;
  statusCode: number | null;
};

export type ResendDomainListResult =
  | { ok: true; domains: ResendDomainRecord[] }
  | ({ ok: false } & ResendProviderFailure);

export type ResendDiagnosticsStatus =
  /** Key works and the From domain is verified for sending. */
  | "ok"
  /** Key works, domain exists, but Resend has not verified it yet. */
  | "from_domain_unverified"
  /** Key works but the From domain is absent — wrong Resend team, or wrong key. */
  | "from_domain_not_in_account"
  /** RESEND_API_KEY / RESEND_FROM_EMAIL missing on this environment. */
  | "not_configured"
  /** RESEND_FROM_EMAIL is present but not a usable sender. */
  | "from_address_invalid"
  /** Sending-only key: valid, but not allowed to enumerate domains. */
  | "key_restricted"
  /** Resend rejected the key outright. */
  | "key_rejected"
  /** Resend could not be reached or returned an unexpected failure. */
  | "provider_unreachable";

export type ResendDiagnostics = {
  status: ResendDiagnosticsStatus;
  /** Last four characters of RESEND_API_KEY — enough to compare against Resend. */
  apiKeyLast4: string | null;
  apiKeyConfigured: boolean;
  /** Configured sender, safe to display. */
  fromAddress: string | null;
  fromDomain: string | null;
  /** null when the key could not enumerate domains. */
  fromDomainVerified: boolean | null;
  domains: ResendDomainSummary[];
  /** null when the domain list could not be read. */
  domainCount: number | null;
  providerError: ResendProviderFailure | null;
  /** Which Vercel environment answered — Production and Preview hold separate values. */
  environment: ResendDiagnosticsEnvironment;
  verdict: string;
  nextAction: string;
  regionNote: string;
  checkedAt: string;
};

export type ResendDiagnosticsEnvironment = {
  /** `production` | `preview` | `development`, or null outside Vercel. */
  vercelEnv: string | null;
  /** Commit the running build was made from, when Vercel exposes it. */
  commitSha: string | null;
};

/**
 * Resend hosts one API (`api.resend.com`) for every region; a domain's region
 * only decides where mail is dispatched from.
 * https://resend.com/docs/dashboard/domains/regions
 */
const REGION_NOTE =
  "A domain's region (for example eu-west-1) only controls where Resend dispatches mail from. Resend serves every region from the single api.resend.com host and API keys are not region-scoped, so an EU-hosted domain needs no extra configuration here.";

const RESTRICTED_KEY_PATTERN = /restricted to only send emails/i;
const INVALID_KEY_PATTERN = /api key is invalid|missing api key/i;

/** Last four characters only. Returns null for values too short to mask safely. */
export function maskResendApiKey(apiKey: string | undefined | null): string | null {
  const key = apiKey?.trim() ?? "";
  if (key.length < 8) return null;
  return key.slice(-4);
}

function readEnvironment(): ResendDiagnosticsEnvironment {
  return {
    vercelEnv: process.env.VERCEL_ENV?.trim() || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim()?.slice(0, 7) || null,
  };
}

function summarizeDomains(
  domains: ResendDomainRecord[],
  fromDomain: string | null
): ResendDomainSummary[] {
  return domains
    .map((domain) => {
      const name = domain.name?.trim().toLowerCase() ?? "";
      const sending = domain.capabilities?.sending?.trim().toLowerCase() ?? null;
      return {
        name,
        status: domain.status?.trim().toLowerCase() || "unknown",
        region: domain.region?.trim() || null,
        sendingEnabled: sending ? sending === "enabled" : null,
        matchesFromDomain: Boolean(fromDomain) && name === fromDomain,
      };
    })
    .filter((domain) => domain.name.length > 0);
}

/** Resend reports `verified` once DNS passes; partial states cannot send freely. */
function isVerified(domain: ResendDomainSummary): boolean {
  return domain.status === "verified";
}

function classifyFailure(failure: ResendProviderFailure): ResendDiagnosticsStatus {
  const haystack = `${failure.code ?? ""} ${failure.message}`;
  if (RESTRICTED_KEY_PATTERN.test(haystack) || failure.code === "restricted_api_key") {
    return "key_restricted";
  }
  if (INVALID_KEY_PATTERN.test(haystack) || failure.code === "invalid_api_key") {
    return "key_rejected";
  }
  return "provider_unreachable";
}

export type ResendDiagnosticsInput = {
  apiKey: string | undefined | null;
  /** Raw RESEND_FROM_EMAIL value. */
  fromEmail: string | undefined | null;
  /** Result of `GET /domains`, or null when it was not attempted. */
  domainList: ResendDomainListResult | null;
  environment?: ResendDiagnosticsEnvironment;
  now?: Date;
};

/**
 * Pure report builder — no I/O, so the wording of every verdict is testable.
 */
export function buildResendDiagnostics({
  apiKey,
  fromEmail,
  domainList,
  environment = { vercelEnv: null, commitSha: null },
  now = new Date(),
}: ResendDiagnosticsInput): ResendDiagnostics {
  const key = apiKey?.trim() || null;
  const from = parseResendFromAddress(fromEmail ?? undefined);
  const envLabel = environment.vercelEnv ?? "local";

  const base = {
    apiKeyLast4: maskResendApiKey(key),
    apiKeyConfigured: Boolean(key),
    fromAddress: from?.address ?? (fromEmail?.trim() || null),
    fromDomain: from?.domain ?? null,
    domains: [] as ResendDomainSummary[],
    domainCount: null as number | null,
    providerError: null as ResendProviderFailure | null,
    environment,
    regionNote: REGION_NOTE,
    checkedAt: now.toISOString(),
  };

  if (!key) {
    return {
      ...base,
      status: "not_configured",
      fromDomainVerified: null,
      verdict: `RESEND_API_KEY is not set on the ${envLabel} environment, so no email can be sent from here.`,
      nextAction: `Add RESEND_API_KEY in Vercel → Settings → Environment Variables with the ${envLabel} environment ticked, then redeploy.`,
    };
  }

  if (!from) {
    return {
      ...base,
      status: "from_address_invalid",
      fromDomainVerified: null,
      verdict: fromEmail?.trim()
        ? `RESEND_FROM_EMAIL is set on the ${envLabel} environment but is not a usable sender address.`
        : `RESEND_FROM_EMAIL is not set on the ${envLabel} environment.`,
      nextAction:
        'Set RESEND_FROM_EMAIL to "noreply@yourdomain.com" or "Name <noreply@yourdomain.com>", with no surrounding quotes, then redeploy.',
    };
  }

  if (!domainList) {
    return {
      ...base,
      status: "provider_unreachable",
      fromDomainVerified: null,
      verdict: "Resend's domain list was not read, so the key's account could not be identified.",
      nextAction: "Retry this check. If it keeps failing, confirm the deployment can reach api.resend.com.",
    };
  }

  if (!domainList.ok) {
    const providerError: ResendProviderFailure = {
      message: domainList.message,
      code: domainList.code,
      statusCode: domainList.statusCode,
    };
    const status = classifyFailure(providerError);

    if (status === "key_restricted") {
      return {
        ...base,
        status,
        providerError,
        fromDomainVerified: null,
        verdict: `The RESEND_API_KEY ending ${base.apiKeyLast4 ?? "????"} on the ${envLabel} environment is valid but has sending-only access, so it cannot list domains. This check cannot confirm which Resend team owns it.`,
        nextAction: `Create a Full access key in the same Resend team that shows ${from.domain} as Verified, put it in Vercel for the ${envLabel} environment, and redeploy — or read the domain owner from ${RESEND_DOMAIN_SETUP_URL} while signed into that team.`,
      };
    }

    if (status === "key_rejected") {
      return {
        ...base,
        status,
        providerError,
        fromDomainVerified: null,
        verdict: `Resend rejected the RESEND_API_KEY ending ${base.apiKeyLast4 ?? "????"} that is bound to the ${envLabel} environment.`,
        nextAction: `Create a fresh API key in the Resend team that owns ${from.domain}, replace RESEND_API_KEY for the ${envLabel} environment in Vercel, and redeploy.`,
      };
    }

    return {
      ...base,
      status,
      providerError,
      fromDomainVerified: null,
      verdict: `Resend returned an unexpected failure while listing domains for the key ending ${base.apiKeyLast4 ?? "????"}.`,
      nextAction: "Retry shortly; if it persists check https://resend-status.com before changing configuration.",
    };
  }

  const domains = summarizeDomains(domainList.domains, from.domain);
  const match = domains.find((domain) => domain.matchesFromDomain) ?? null;
  const withCounts = {
    ...base,
    domains,
    domainCount: domains.length,
  };

  if (!match) {
    const visible = domains.length
      ? `It can see ${domains.length} domain(s): ${domains.map((d) => d.name).join(", ")}.`
      : "It can see no domains at all.";
    return {
      ...withCounts,
      status: "from_domain_not_in_account",
      fromDomainVerified: false,
      verdict: `The RESEND_API_KEY ending ${base.apiKeyLast4 ?? "????"} bound to the ${envLabel} environment belongs to a Resend team that does not contain ${from.domain}. ${visible} This is why Resend replies "The ${from.domain} domain is not verified" even though your dashboard shows it Verified — the dashboard and this key are looking at different teams.`,
      nextAction: `Sign in to the Resend team where ${from.domain} shows Verified, create an API key there, and set it as RESEND_API_KEY in Vercel with the ${envLabel} environment ticked. Then redeploy and re-run this check — the key's last four characters must change.`,
    };
  }

  if (!isVerified(match)) {
    return {
      ...withCounts,
      status: "from_domain_unverified",
      fromDomainVerified: false,
      verdict: `${from.domain} exists in this key's Resend team but its status is "${match.status}", so Resend will only deliver to the account owner's own inbox.`,
      nextAction: `Finish DNS verification for ${from.domain} at ${RESEND_DOMAIN_SETUP_URL} until it reads Verified, then retry the invite.`,
    };
  }

  if (match.sendingEnabled === false) {
    return {
      ...withCounts,
      status: "from_domain_unverified",
      fromDomainVerified: true,
      verdict: `${from.domain} is verified in this key's Resend team but its sending capability is disabled.`,
      nextAction: `Enable sending for ${from.domain} at ${RESEND_DOMAIN_SETUP_URL}, then retry the invite.`,
    };
  }

  return {
    ...withCounts,
    status: "ok",
    fromDomainVerified: true,
    verdict: `The RESEND_API_KEY ending ${base.apiKeyLast4 ?? "????"} on the ${envLabel} environment can see ${from.domain} as Verified${match.region ? ` in ${match.region}` : ""}, and ${from.address} is a valid sender. Invites to any recipient should now deliver.`,
    nextAction: "Send a real invite from Platform → Users and confirm the toast reads \"Invite emailed to …\".",
  };
}

/** Reads `GET /domains` with the deployed key, normalising both outcomes. */
export async function listResendDomains(apiKey: string): Promise<ResendDomainListResult> {
  try {
    const { data, error } = await new Resend(apiKey).domains.list();

    if (error) {
      const failure = error as { message?: string; name?: string; statusCode?: number | null };
      return {
        ok: false,
        message: failure.message?.trim() || "Resend did not explain the failure.",
        code: failure.name?.trim() || null,
        statusCode: failure.statusCode ?? null,
      };
    }

    return { ok: true, domains: (data?.data ?? []) as ResendDomainRecord[] };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach Resend.",
      code: null,
      statusCode: null,
    };
  }
}

/**
 * Ask Resend which domains the key on *this* deployment can actually see.
 * Never throws — a failed lookup is itself a diagnostic result.
 */
export async function inspectResendConfiguration(): Promise<ResendDiagnostics> {
  const apiKey = readResendApiKey();
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const environment = readEnvironment();

  if (!apiKey) {
    return buildResendDiagnostics({ apiKey: null, fromEmail, domainList: null, environment });
  }

  // A malformed sender is worth reporting without spending a provider call.
  if (!parseResendFromAddress(fromEmail)) {
    return buildResendDiagnostics({ apiKey, fromEmail, domainList: null, environment });
  }

  return buildResendDiagnostics({
    apiKey,
    fromEmail,
    domainList: await listResendDomains(apiKey),
    environment,
  });
}

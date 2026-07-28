import "server-only";

/** Meta Cloud API template parameter mapping (code registry + site_settings names). */

export type MetaTemplateKind =
  | "password_reset"
  | "team_invite"
  | "team_welcome"
  | "team_role_changed"
  | "team_password_set";

export type MetaTemplateComponent = {
  type: "body" | "button";
  sub_type?: "url";
  index?: number;
  parameters: Array<{ type: "text"; text: string }>;
};

export type MetaTemplatePayload = {
  name: string;
  language: { code: string };
  components?: MetaTemplateComponent[];
};

export const META_TEMPLATE_SETTING_KEYS: Record<MetaTemplateKind, string> = {
  password_reset: "whatsapp_template_password_reset",
  team_invite: "whatsapp_template_team_invite",
  team_welcome: "whatsapp_template_team_welcome",
  team_role_changed: "whatsapp_template_team_role_changed",
  team_password_set: "whatsapp_template_team_password_set",
};

export const DEFAULT_META_TEMPLATE_NAMES: Record<MetaTemplateKind, string> = {
  password_reset: "password_reset",
  team_invite: "team_invite",
  team_welcome: "team_welcome",
  team_role_changed: "team_role_changed",
  team_password_set: "team_password_set",
};

export function resolveMetaTemplateName(
  kind: MetaTemplateKind,
  settings?: Record<string, string | undefined>
): string {
  const key = META_TEMPLATE_SETTING_KEYS[kind];
  const fromSettings = settings?.[key]?.trim();
  return fromSettings || DEFAULT_META_TEMPLATE_NAMES[kind];
}

export function resolveMetaTemplateLanguage(
  settings?: Record<string, string | undefined>
): string {
  return settings?.whatsapp_template_language?.trim() || "en";
}

/** Build Meta template components from ordered body params (+ optional URL button param). */
export function buildMetaTemplateComponents(params: {
  bodyParameters?: string[];
  buttonUrlParameter?: string;
}): MetaTemplateComponent[] | undefined {
  const components: MetaTemplateComponent[] = [];
  const bodyParameters = (params.bodyParameters ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((text) => ({ type: "text", text })),
    });
  }

  const buttonUrl = params.buttonUrlParameter?.trim();
  if (buttonUrl) {
    components.push({
      type: "button",
      sub_type: "url",
      index: 0,
      parameters: [{ type: "text", text: buttonUrl }],
    });
  }

  return components.length > 0 ? components : undefined;
}

export function buildMetaTemplatePayload(params: {
  kind: MetaTemplateKind;
  settings?: Record<string, string | undefined>;
  bodyParameters?: string[];
  buttonUrlParameter?: string;
  /** Override resolved template name from settings. */
  templateName?: string;
  languageCode?: string;
}): MetaTemplatePayload {
  return {
    name:
      params.templateName?.trim() ||
      resolveMetaTemplateName(params.kind, params.settings),
    language: {
      code: params.languageCode?.trim() || resolveMetaTemplateLanguage(params.settings),
    },
    components: buildMetaTemplateComponents({
      bodyParameters: params.bodyParameters,
      buttonUrlParameter: params.buttonUrlParameter,
    }),
  };
}

/** Render a simple mustache-lite template: `{{name}}` replacements. */
export function renderTemplateString(
  template: string,
  data: Record<string, string | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return data[key]?.trim() ?? "";
  });
}

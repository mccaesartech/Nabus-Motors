export async function submitInquiry(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok && data.ok, message: data.message ?? data.error };
}

export function formValue(form: HTMLFormElement, id: string): string {
  const el = form.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement | null;
  return el?.value?.trim() ?? "";
}

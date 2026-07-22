export function quotePostgrestFilterValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function userOrEmailFilter(
  userId: string,
  email: string,
  emailColumn = "email"
): string {
  return [
    `user_id.eq.${quotePostgrestFilterValue(userId)}`,
    `${emailColumn}.ilike.${quotePostgrestFilterValue(email)}`,
  ].join(",");
}

import { cn } from "@/lib/utils";

type NabusDataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

type NabusDataTableProps<T> = {
  columns: NabusDataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
};

export function NabusDataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found",
  className,
}: NabusDataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)] px-6 py-12 text-center text-sm text-[var(--nabus-text-secondary)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--nabus-border)] bg-[var(--nabus-surface)]",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--nabus-border)] bg-[var(--nabus-background)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--nabus-text-secondary)]",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-[var(--nabus-border)] last:border-0 transition-colors hover:bg-[var(--nabus-background)]"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 text-[var(--nabus-charcoal)]", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

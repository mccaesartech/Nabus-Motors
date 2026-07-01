type MaintenanceBannerProps = {
  message: string;
};

export function MaintenanceBanner({ message }: MaintenanceBannerProps) {
  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-950 dark:text-amber-100"
    >
      {message}
    </div>
  );
}

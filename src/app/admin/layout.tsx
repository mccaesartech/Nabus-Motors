import "../platform/platform.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="platform-theme min-h-dvh overflow-x-clip">{children}</div>;
}

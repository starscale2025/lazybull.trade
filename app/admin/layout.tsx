// Admin cockpit layout — full-bleed, no marketing chrome (no Nav, no
// Footer). The auth gate lives in `app/admin/page.tsx` so the gate runs
// before any module-level imports of admin-only components.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-bg text-fg">
      {children}
    </div>
  );
}

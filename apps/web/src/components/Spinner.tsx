/** A small brand-colored ring spinner. Works in light and dark themes. */
export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-brand-500/25 border-t-brand-500 ${className}`}
    />
  );
}

/** Full-height centered spinner for page-level loading states. */
export function PageLoader() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

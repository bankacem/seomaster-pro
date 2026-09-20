import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 2L2 7l10 5 10-5-10-5z"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        </svg>
      </div>
      {withText && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight text-ink-900">
            SEOMaster
            <span className="ml-1 text-brand-600">Pro</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
            SEO Suite Platform
          </span>
        </div>
      )}
    </div>
  );
}

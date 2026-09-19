"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));
const badgeStyles = cva("inline-flex items-center rounded-full font-medium", { variants: { color: { success: "bg-emerald-500/15 text-emerald-300", warning: "bg-amber-500/15 text-amber-300", error: "bg-red-500/15 text-red-300", info: "bg-blue-500/15 text-blue-300", neutral: "bg-slate-700 text-slate-300" }, size: { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm" } }, defaultVariants: { color: "neutral", size: "md" } });
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeStyles> {}
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, color, size, ...props }, ref) => <span ref={ref} className={cn(badgeStyles({ color, size }), className)} {...props} />);
Badge.displayName = "Badge";

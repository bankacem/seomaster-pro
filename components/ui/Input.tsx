"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));
const inputStyles = cva("block w-full rounded-lg border bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50", { variants: { variant: { default: "border-slate-700 focus:border-blue-500 focus:ring-blue-500/20", filled: "border-transparent bg-slate-800 focus:border-blue-500 focus:ring-blue-500/20", outlined: "border-2 border-slate-600 focus:border-blue-500 focus:ring-blue-500/20" } }, defaultVariants: { variant: "default" } });

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof inputStyles> { label?: string; error?: string; helperText?: string; icon?: ReactNode; }
export const Input = forwardRef<HTMLInputElement, InputProps>(({ id, label, error, helperText, icon, variant, className, ...props }, ref) => {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;
  return <div className="w-full"><label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-200">{label}</label><div className="relative">{icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">{icon}</span>}<input ref={ref} id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={cn(inputStyles({ variant }), icon && "pl-10", error && "border-red-500 focus:border-red-500 focus:ring-red-500/20", className)} {...props} /></div>{error ? <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-red-400">{error}</p> : helperText ? <p id={`${inputId}-help`} className="mt-1.5 text-sm text-slate-400">{helperText}</p> : null}</div>;
});
Input.displayName = "Input";

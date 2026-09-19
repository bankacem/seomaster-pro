"use client";

import { forwardRef, useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));
export interface ModalProps extends HTMLAttributes<HTMLDivElement> { open: boolean; onClose: () => void; title?: string; children: ReactNode; closeOnBackdrop?: boolean; }

export const Modal = forwardRef<HTMLDivElement, ModalProps>(({ open, onClose, title, children, className, closeOnBackdrop = true, ...props }, forwardedRef) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = "modal-title";
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = Array.from(focusable());
      if (!elements.length) return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    (focusable()[0] ?? dialogRef.current)?.focus();
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; previous?.focus(); };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}><div ref={(node) => { dialogRef.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} tabIndex={-1} className={cn("w-full max-w-lg animate-in fade-in zoom-in-95 rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl backdrop-blur-xl", className)} {...props}>{title && <h2 id={titleId} className="mb-4 text-lg font-semibold text-white">{title}</h2>}{children}</div><div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm" /></div>, document.body);
});
Modal.displayName = "Modal";

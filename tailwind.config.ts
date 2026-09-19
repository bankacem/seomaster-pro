import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { fontFamily: { sans: ["var(--font-inter)", "ui-sans-serif"] }, keyframes: { float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } } }, animation: { float: "float 6s ease-in-out infinite" } } }, plugins: [] };
export default config;

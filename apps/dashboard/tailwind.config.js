/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#1b988d",
                "background-light": "#f9fafa",
                "background-dark": "#131416",
                "surface-dark": "#1A1C1E",
                "border-dark": "#2C2E33",
                "sidebar": "#12211f",
                "panel": "#1c312f",
                "status-installed": "#42C942",
                "status-planned": "#CC3333",
                "status-warning": "#E6AA1A",
                "input-bg": "#1c1e20",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
                "heading": ["Space Grotesk", "sans-serif"],
                "mono": ["Space Grotesk", "monospace"],
            },
            borderRadius: {
                "lg": "0.5rem",
                "xl": "0.75rem",
            },
            boxShadow: {
                'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fadeIn": {
          from: {
            opacity: '0',
            transform: 'translateY(-110%)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(-100%)',
          },
        },
        "fadeInUp": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "pulse": {
          "0%": { transform: "scale(1) rotate(0deg)" },
          "50%": { transform: "scale(1.1) rotate(180deg)" },
          "100%": { transform: "scale(1) rotate(360deg)" },
        },
        "pulse-text": {
          "0%": { opacity: 0.7 },
          "50%": { opacity: 1 },
          "100%": { opacity: 0.7 },
        },
        tabActivate: {
          from: {
            transform: 'scaleX(0)',
          },
          to: {
            transform: 'scaleX(1)',
          },
        },
        tooltipFadeIn: {
          from: {
            opacity: '0',
            transform: 'translateY(-90%)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(-100%)',
          },
        },
        spin: {
          from: {
            transform: 'rotate(0deg)',
          },
          to: {
            transform: 'rotate(360deg)',
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fadeIn": "fadeIn 0.2s ease-out",
        "fadeInUp": "fadeInUp 0.5s ease-out forwards",
        "pulse": "pulse 2s ease-in-out infinite",
        "pulse-text": "pulse-text 2s ease-in-out infinite",
        "tabActivate": "tabActivate 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "tooltipFadeIn": "tooltipFadeIn 0.2s ease-out",
        "spin": "spin 1s linear infinite",
      },
      zIndex: {
        '1000': '1000',
      },
      backdropBlur: {
        'lg': '8px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    'pdf-container-mobile',
    'resizer-horizontal-mobile',
    'tabs-container-mobile',
    'mindmap-container',
    'highlight-area-tooltip',
  ],
}

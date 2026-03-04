// =====================================================================
// 🎨 PrintGo Color Palette — SINGLE SOURCE OF TRUTH
// =====================================================================
// 
// Want to try a different color scheme? Change values ONLY in this file.
// Both light and dark modes will update automatically.
//
// Format: plain hex strings (no # prefix — added in globals.css)
// =====================================================================

export const colors = {
    light: {
        // --- Core surfaces ---
        background: "255 253 246",   // #FFFDF6  — warm cream
        foreground: "26 26 46",      // #1a1a2e  — near-black ink
        card: "255 255 255",   // #FFFFFF
        cardForeground: "26 26 46",      // #1a1a2e
        popover: "255 255 255",   // #FFFFFF
        popoverForeground: "26 26 46",      // #1a1a2e

        // --- Brand accents ---
        primary: "160 200 120",   // #A0C878  — PrintGo green (main CTA)
        primaryForeground: "255 255 255",   // #FFFFFF
        secondary: "250 246 233",   // #FAF6E9  — soft cream
        secondaryForeground: "26 26 46",      // #1a1a2e
        accent: "221 235 157",   // #DDEB9D  — light lime
        accentForeground: "26 26 46",      // #1a1a2e
        success: "160 200 120",   // #A0C878  — green
        successForeground: "255 255 255",   // #FFFFFF

        // --- Utility ---
        muted: "241 245 249",   // #f1f5f9
        mutedForeground: "100 116 139",   // #64748b
        destructive: "239 68 68",     // #ef4444
        destructiveForeground: "255 255 255", // #FFFFFF

        // --- Borders / inputs / focus ring ---
        border: "226 232 240",   // #e2e8f0
        input: "226 232 240",   // #e2e8f0
        ring: "160 200 120",   // #A0C878

        // --- PrintGo custom ---
        navbar: "211 232 118",   // #d3e876
        footer: "160 200 120",   // #A0C878
        surface: "250 246 233",   // #FAF6E9
        textPrimary: "45 55 72",      // #2D3748
        textLight: "113 128 150",   // #718096
    },

    dark: {
        // --- Core surfaces ---
        background: "13 17 23",      // #0d1117  — GitHub dark bg
        foreground: "230 237 243",    // #e6edf3  — soft white text
        card: "22 27 34",      // #161b22  — card panels
        cardForeground: "230 237 243",    // #e6edf3
        popover: "22 27 34",      // #161b22
        popoverForeground: "230 237 243",    // #e6edf3

        // --- Brand accents (adjusted for dark) ---
        primary: "126 180 80",    // #7eb450  — slightly brighter green
        primaryForeground: "13 17 23",      // #0d1117
        secondary: "30 36 44",      // #1e242c
        secondaryForeground: "230 237 243",    // #e6edf3
        accent: "56 78 36",      // #384e24  — muted dark olive
        accentForeground: "221 235 157",   // #DDEB9D
        success: "126 180 80",    // #7eb450
        successForeground: "13 17 23",      // #0d1117

        // --- Utility ---
        muted: "30 36 44",      // #1e242c
        mutedForeground: "139 148 158",   // #8b949e
        destructive: "248 81 73",     // #f85149
        destructiveForeground: "230 237 243",  // #e6edf3

        // --- Borders / inputs / focus ring ---
        border: "48 54 61",      // #30363d
        input: "48 54 61",      // #30363d
        ring: "126 180 80",    // #7eb450

        // --- PrintGo custom ---
        navbar: "22 27 34",      // #161b22  — blends into header
        footer: "22 27 34",      // #161b22
        surface: "22 27 34",      // #161b22
        textPrimary: "230 237 243",   // #e6edf3
        textLight: "139 148 158",   // #8b949e
    },
} as const;

// Export type so other modules can reference palette keys
export type ColorPalette = typeof colors.light;
export type ThemeMode = "light" | "dark";

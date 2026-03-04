export const theme = {
  colors: {
    primary: '#FFFDF6',    // Main background - light cream
    secondary: '#FAF6E9',  // Soft cream
    accent: '#DDEB9D',     // Navbar - light green
    success: '#A0C878',    // Footer - medium green
    background: '#FFFDF6',
    surface: '#FAF6E9',
    text: '#2D3748',       // Dark gray for text
    textLight: '#718096',  // Lighter gray
    navbar: '#d3e876ff',     // Navbar color
    footer: '#A0C878',     // Footer color
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
};

export type Theme = typeof theme;
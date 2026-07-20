# Shared Theme Configuration for SUPERSYSTEMS Platform
# Used by frontend templates and API responses for consistent UI

THEME = {
    "colors": {
        "primary": "#1976D2",
        "secondary": "#424242",
        "success": "#4CAF50",
        "warning": "#FF9800",
        "error": "#F44336",
        "info": "#2196F3",
        "background": "#FAFAFA",
        "surface": "#FFFFFF",
        "border": "#E0E0E0",
        "text": {
            "primary": "#212121",
            "secondary": "#757575",
            "disabled": "#BDBDBD",
        },
    },
    "dark_colors": {
        "primary": "#90CAF9",
        "secondary": "#B0BEC5",
        "background": "#121212",
        "surface": "#1E1E1E",
        "border": "#333333",
        "text": {
            "primary": "#FFFFFF",
            "secondary": "#B0B0B0",
            "disabled": "#666666",
        },
    },
    "typography": {
        "font_family": "'Inter', 'Roboto', sans-serif",
        "h1": {"size": "2.5rem", "weight": 700, "line_height": 1.2},
        "h2": {"size": "2rem", "weight": 600, "line_height": 1.3},
        "h3": {"size": "1.5rem", "weight": 600, "line_height": 1.4},
        "h4": {"size": "1.25rem", "weight": 500, "line_height": 1.4},
        "body1": {"size": "1rem", "weight": 400, "line_height": 1.5},
        "body2": {"size": "0.875rem", "weight": 400, "line_height": 1.5},
        "caption": {"size": "0.75rem", "weight": 400, "line_height": 1.4},
    },
    "spacing": {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "xxl": "48px",
    },
    "radius": {
        "sm": "4px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
        "full": "9999px",
    },
    "shadows": {
        "sm": "0 1px 2px rgba(0,0,0,0.05)",
        "md": "0 4px 6px rgba(0,0,0,0.1)",
        "lg": "0 10px 15px rgba(0,0,0,0.1)",
        "xl": "0 20px 25px rgba(0,0,0,0.15)",
    },
    "breakpoints": {
        "xs": "0px",
        "sm": "600px",
        "md": "960px",
        "lg": "1280px",
        "xl": "1920px",
    },
}

LAYOUT = {
    "header": {"height": "64px", "position": "fixed"},
    "sidebar": {"width": "260px", "collapsed_width": "64px"},
    "footer": {"height": "48px"},
    "content": {"max_width": "1440px", "padding": "24px"},
}

ICONS = {
    "library": "Material Icons",
    "format": "svg",
    "sizes": {"sm": 16, "md": 24, "lg": 32, "xl": 48},
}

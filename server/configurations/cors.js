const corsOptions = {
  origin: [
    "http://localhost:5173",   // React app during development
    "http://10.120.108.202:5173",

  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allowed HTTP methods
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  exposedHeaders: ["Authorization"], // Headers browser can access
  credentials: true,                 // Allow cookies/auth credentials
  optionsSuccessStatus: 200,         // For legacy browsers
  preflightContinue: false,          // Stop after preflight response
};
export default corsOptions;
const corsOptions = {
    origin: [
        "http://localhost:5173",
        "http://10.120.108.202:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    exposedHeaders: ["Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
    preflightContinue: false,
};

export default corsOptions;

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const supabase = require("./supabaseClient");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const relationshipRoutes = require("./routes/relationshipRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const contactRoutes = require("./routes/contactRoutes");
const messageRoutes = require("./routes/messagesRoutes");

const app = express();

// Trust proxy when deployed behind a proxy (CDN/load balancer)
app.set("trust proxy", 1);

// Global rate limiter to protect against abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const allowedOrigins = [
  "https://paziuk.chasonjia-dev.workers.dev",
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin),
    );
    return isAllowed
      ? callback(null, true)
      : callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
};

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "connect-src": ["'self'", "https://*.supabase.co"], // Allow connections to Supabase
        "script-src": ["'self'", "'unsafe-inline'"],
        "object-src": ["'none'"],
      },
    },
  }),
);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "200kb" }));

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/relationships", relationshipRoutes);
app.use("/people", peopleRoutes);
app.use("/contact", contactRoutes);
app.use("/messages", messageRoutes);
// Health check
app.get("/", (req, res) => res.send("Server is running"));

// Start server
const port = process.env.PORT || 8080;
// app.listen(port, () => {
//   console.log(`Family Tree app listening on port ${port}`);
// });

(async () => {
  await supabase.from("people").select("id").limit(1);
  console.log("Supabase warmed");
  app.listen(port, () => console.log("Family Tree app listening"));
})();

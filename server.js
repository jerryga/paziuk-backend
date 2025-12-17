require("dotenv").config();

const express = require("express");
const cors = require("cors");
const supabase = require("./supabaseClient");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const relationshipRoutes = require("./routes/relationshipRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const contactRoutes = require("./routes/contactRoutes");
const messageRoutes = require("./routes/messagesRoutes");

const app = express();

const allowedOrigins = [
  "https://paziuk.chasonjia-dev.workers.dev",
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) =>
        typeof allowed === "string" ? allowed === origin : allowed.test(origin)
      );
      return isAllowed
        ? callback(null, true)
        : callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

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

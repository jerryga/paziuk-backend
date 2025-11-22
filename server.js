const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const relationshipRoutes = require("./routes/relationshipRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const contactRoutes = require("./routes/contactRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/relationships", relationshipRoutes);
app.use("/people", peopleRoutes);
app.use("/contact", contactRoutes);

// Health check
app.get("/", (req, res) => res.send("Server is running"));

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Family Tree app listening on port ${port}`);
});

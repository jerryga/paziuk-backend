const express = require("express");
const { Resend } = require("resend");
const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

router.post("/", async (req, res) => {
  try {
    const { email, message } = req.body;

    if (!message || String(message).trim() === "") {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const data = await resend.emails.send({
      from: "onboarding@chason.app",
      to: "davidpaziuk@gmail.com",
      subject: "New Contact From Family Tree Website",
      html: `
        <h3>New Contact</h3>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Message:</strong><br>${safeMessage}</p>
      `,
    });
    console.log(data);
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error });
  }
});

module.exports = router;

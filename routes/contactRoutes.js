const express = require("express");
const { Resend } = require("resend");
const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", async (req, res) => {
  try {
    const { email, message } = req.body;

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "chasonjia.dev@gmail.com",
      subject: "New Contact From Family Tree Website",
      html: `
        <h3>New Contact</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong><br>${message}</p>
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

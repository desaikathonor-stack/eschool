const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

function sendReminderEmail(toEmail, todoText, reminderTime) {
  return transporter.sendMail({
    from: `"eSchool Reminders" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `📚 Reminder: "${todoText}"`,
    html: `<div style="font-family:sans-serif;max-width:480px">
      <h2 style="color:#6366f1">📋 Task Reminder</h2>
      <div style="background:#f5f5ff;padding:16px;border-radius:8px;
                  border-left:4px solid #6366f1">
        <strong>${todoText}</strong>
      </div>
      <p style="color:#666;margin-top:16px">Set for: ${reminderTime}</p>
      <p>Log in to eSchool to mark it complete.</p>
    </div>`
  });
}

module.exports = { sendReminderEmail };
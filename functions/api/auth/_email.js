import nodemailer from "nodemailer";
import { originOf } from "./_auth.js";

function required(env, key) {
  const value = String(env?.[key] || "").trim();
  if (!value) throw new Error("Missing " + key);
  return value;
}

function transporter(env) {
  const user = required(env, "SMTP_USER");
  const pass = required(env, "SMTP_PASS");
  const smtpUrl = String(env.SMTP_URL || "").trim();
  if (smtpUrl) return nodemailer.createTransport(smtpUrl);
  const host = String(env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(env.SMTP_PORT || 465);
  const secure = String(env.SMTP_SECURE || (port === 465 ? "true" : "false")).toLowerCase() === "true";
  const servername = String(env.SMTP_TLS_SERVERNAME || "").trim();
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(servername ? { tls: { servername } } : {})
  });
}

export async function sendVerificationEmail(request, env, { email, name, code, token, purpose = "signup" }) {
  const from = String(env.EMAIL_FROM || env.SMTP_USER || "").trim() || required(env, "EMAIL_FROM");
  const base = originOf(request, env);
  const kind = purpose === "reset" ? "reset your Cookie password" : "verify your Cookie account";
  const subject = purpose === "reset" ? "Reset your Cookie password" : "Verify your Cookie account";
  const path = purpose === "reset" ? "/?reset=" + encodeURIComponent(token) : "/?verify=" + encodeURIComponent(token);
  const link = base + path;
  const safeName = String(name || "there").replace(/[<>]/g, "");
  const text = [
    "Hi " + safeName + ",",
    "",
    "Use this code to " + kind + ": " + code,
    "The code expires in 10 minutes and can be used once.",
    "",
    "You can also use this secure link:",
    link,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Cookie AI"
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;background:#111;color:#eee;font-family:Inter,Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;padding:32px;background:#1a1a1a;border:1px solid #2c2c2c;border-radius:22px">
  <div style="font-size:26px;font-weight:800;letter-spacing:-.04em;margin-bottom:24px">Cookie</div>
  <p style="font-size:16px;line-height:1.6">Hi ${safeName},</p>
  <p style="font-size:16px;line-height:1.6">Use the code below to ${kind}.</p>
  <div style="font-size:34px;letter-spacing:.24em;font-weight:800;padding:22px 18px;background:#111;border:1px solid #333;border-radius:16px;text-align:center;margin:20px 0">${code}</div>
  <p style="font-size:13px;color:#999;line-height:1.6">This code expires in 10 minutes and can only be used once.</p>
  <a href="${link}" style="display:inline-block;margin-top:8px;padding:12px 18px;background:#fff;color:#111;text-decoration:none;border-radius:12px;font-weight:700">Continue securely</a>
  <p style="font-size:12px;color:#777;line-height:1.6;margin-top:24px">If you did not request this email, you can safely ignore it.</p>
</div></body></html>`;
  await transporter(env).sendMail({
    from,
    to: email,
    subject,
    text,
    html
  });
}

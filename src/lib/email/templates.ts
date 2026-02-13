const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://niseko-gazet.vercel.app";

export function storyNotificationEmail(params: {
  headline: string;
  summary: string;
  slug: string;
  topicTags: string[];
  geoTags: string[];
}): { subject: string; html: string } {
  const storyUrl = `${BASE_URL}/stories/${params.slug}`;
  const unsubUrl = `${BASE_URL}/settings/notifications`;

  const tags = [...params.topicTags, ...params.geoTags]
    .map(
      (t) =>
        `<span style="display:inline-block;background:#1a2a42;color:#7eb8da;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:4px;">${escapeHtml(t)}</span>`
    )
    .join("");

  return {
    subject: params.headline,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1f35;border-radius:12px;border:1px solid rgba(126,184,218,0.1);">
        <!-- Header -->
        <tr><td style="padding:24px 24px 16px;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7eb8da;">Niseko Gazet</p>
        </td></tr>
        <!-- Headline -->
        <tr><td style="padding:0 24px 12px;">
          <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;line-height:1.3;color:#e8f0f7;">
            <a href="${escapeHtml(storyUrl)}" style="color:#e8f0f7;text-decoration:none;">${escapeHtml(params.headline)}</a>
          </h1>
        </td></tr>
        <!-- Summary -->
        <tr><td style="padding:0 24px 16px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#8fa8c0;">${escapeHtml(params.summary)}</p>
        </td></tr>
        <!-- Tags -->
        ${tags ? `<tr><td style="padding:0 24px 16px;">${tags}</td></tr>` : ""}
        <!-- CTA -->
        <tr><td style="padding:0 24px 24px;">
          <a href="${escapeHtml(storyUrl)}" style="display:inline-block;background:#38b2ac;color:#0a1628;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">
            Read Full Story
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 24px;border-top:1px solid rgba(126,184,218,0.1);">
          <p style="margin:0;font-size:11px;color:#4a6a85;">
            <a href="${escapeHtml(unsubUrl)}" style="color:#4a6a85;text-decoration:underline;">Manage notifications</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

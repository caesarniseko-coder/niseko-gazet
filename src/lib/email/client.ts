import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Niseko Gazet <noreply@niseko-gazet.local>";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send a transactional email via Resend.
 * Returns { success, messageId } on success, or { success: false, error } on failure.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown email error";
    return { success: false, error: message };
  }
}

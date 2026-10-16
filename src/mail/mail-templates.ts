export interface ActionEmail {
    subject: string;
    html: string;
    text: string;
}

interface ActionEmailOptions {
    subject: string;
    title: string;
    intro: string;
    buttonText: string;
    url: string;
    expiresText: string;
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Простое брендированное письмо с одной кнопкой. Вёрстка таблицами и inline-стилями —
 * так её одинаково показывают почтовые клиенты (включая Outlook и мобильные).
 */
function buildActionEmail({ subject, title, intro, buttonText, url, expiresText }: ActionEmailOptions): ActionEmail {
    const safeUrl = escapeHtml(url);

    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#111827;padding:20px 32px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">InvestHold</td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(intro)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:8px;background:#2563eb;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(buttonText)}</a>
        </td></tr></table>
        <p style="margin:24px 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">Если кнопка не работает, скопируйте ссылку в браузер:</p>
        <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" target="_blank" style="color:#2563eb;">${safeUrl}</a></p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(expiresText)}</p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">Если это были не вы — просто проигнорируйте письмо.</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">InvestHold — учёт криптоинвестиций</p>
  </td></tr>
</table>
</body>
</html>`;

    const text = [
        'InvestHold',
        '',
        title,
        '',
        intro,
        '',
        `${buttonText}: ${url}`,
        '',
        expiresText,
        'Если это были не вы — просто проигнорируйте письмо.',
    ].join('\n');

    return { subject, html, text };
}

export function passwordResetEmail(url: string): ActionEmail {
    return buildActionEmail({
        subject: 'Восстановление пароля InvestHold',
        title: 'Восстановление пароля',
        intro: 'Мы получили запрос на сброс пароля для вашего аккаунта InvestHold. Нажмите на кнопку, чтобы задать новый пароль.',
        buttonText: 'Задать новый пароль',
        url,
        expiresText: 'Ссылка действует 1 час и сработает только один раз.',
    });
}

export function emailVerificationEmail(url: string): ActionEmail {
    return buildActionEmail({
        subject: 'Подтвердите email в InvestHold',
        title: 'Подтверждение email',
        intro: 'Спасибо за регистрацию в InvestHold! Подтвердите, что это ваш адрес, — так вы сможете восстановить доступ к аккаунту, если забудете пароль.',
        buttonText: 'Подтвердить email',
        url,
        expiresText: 'Ссылка действует 24 часа и сработает только один раз.',
    });
}

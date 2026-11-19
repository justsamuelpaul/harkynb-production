// Enquiry emails through Resend (https://resend.com). Needs the secret RESEND_API_KEY on the
// harkynb-production Worker, and hbproduction.co verified as a sending domain in Resend.
// Optional plain variables: MAIL_FROM (sender) and NOTIFY_TO (staff inbox, comma separated).
// Sending never blocks or fails a submission: errors are logged and the enquiry is already saved.
const brandNames = {production:'HarkynB Production', onevoicefm:'Onevoicefm', shotit:'HarkynBShotIt', academy:'HarkynB Creators Academy', summit:'Future Creators Summit'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const oneLine = (s, max) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const wrap = body => `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1E2126;max-width:600px">${body}<p style="color:#545A63;font-size:13px;margin-top:28px">HarkynB Production · hbproduction.co</p></div>`;

// Staff alert: every answer, with replies going straight to the visitor.
export function staffEmail(entry, consoleUrl = 'https://admin.hbproduction.co/admin/') {
  const brand = brandNames[entry.team] || entry.team;
  const rows = [['Brand', brand], ['Name', entry.name], ['Email', entry.email], ['Phone', entry.phone], ...(entry.details || []), ['Message', entry.message], ['Preferred contact', entry.method]].filter(([, v]) => v);
  const subject = oneLine(`New ${brand} enquiry from ${entry.name}${entry.topic ? ' · ' + entry.topic : ''}`, 180);
  return {
    subject,
    html: wrap(`<h2 style="margin:0 0 12px">${esc(subject)}</h2><table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#545A63;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table><p><a href="${consoleUrl}" style="color:#0A64B4">Open the staff console</a> to assign or resolve it. Reply to this email to answer ${esc(entry.name)} directly.</p>`),
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nStaff console: ${consoleUrl}`
  };
}

// Visitor confirmation. Deliberately does not repeat what was typed, so the form cannot be used to send someone else arbitrary text.
export function visitorEmail(entry) {
  const brand = brandNames[entry.team] || 'HarkynB Production';
  const first = oneLine(entry.name, 60).split(' ')[0];
  const subject = `We have received your enquiry · ${brand}`;
  const lines = [`Hello ${first},`, `Thank you for contacting ${brand}. Your enquiry has reached our team and we will get back to you soon.`, `If you need to add anything, simply reply to this email.`, `Warm regards,`, `The ${brand} team`];
  return {subject, html: wrap(lines.map(l => `<p>${esc(l)}</p>`).join('')), text: lines.join('\n\n')};
}

async function send(env, message) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: env.MAIL_FROM || 'HarkynB Production <hello@hbproduction.co>', ...message})
  });
  if (!response.ok) console.error('Resend', response.status, (await response.text()).slice(0, 300));
}

export async function sendEnquiryEmails(env, entry) {
  if (!env.RESEND_API_KEY) return;
  const staff = (env.NOTIFY_TO || 'hello@hbproduction.co').split(',').map(s => s.trim()).filter(Boolean);
  await Promise.allSettled([
    send(env, {to: staff, reply_to: entry.email, ...staffEmail(entry)}),
    send(env, {to: [entry.email], reply_to: staff[0], ...visitorEmail(entry)})
  ]).then(results => results.forEach(r => r.status === 'rejected' && console.error('Resend', r.reason)));
}

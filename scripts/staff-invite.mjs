import {randomBytes} from 'node:crypto';
const [name,role]=process.argv.slice(2);
if (!name || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(name) || !['editor','inbox','manager'].includes(role)) {
  console.error('Usage: node scripts/staff-invite.mjs USERNAME editor|inbox|manager');process.exit(1);
}
const token=randomBytes(32).toString('base64url');
const expires=new Date(Date.now()+86400000).toISOString();
console.log('Private Cloudflare STAFF_INVITES entry (merge with existing entries):');
console.log(JSON.stringify({[name]:{role,token,expires}},null,2));
console.log('Private link for this person only:');
console.log('https://harkynb-production.justsamuelpaul.workers.dev/staff/setup/#'+new URLSearchParams({name,token}));

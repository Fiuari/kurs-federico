const {createApp} = require('./app');
const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,ALLOWED_ORIGINS:allowed} = process.env;
if (!url || !key || !allowed) throw new Error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and ALLOWED_ORIGINS.');
if (!key.startsWith('sb_publishable_')) throw new Error('Use a publishable key. This API must preserve user RLS, not bypass it with a service key.');
const origins=allowed.split(',').map(value=>value.trim()).filter(Boolean);
for (const origin of origins) if (new URL(origin).origin!==origin) throw new Error('ALLOWED_ORIGINS must contain origins without paths or trailing slashes.');
const port=Number(process.env.PORT || 3000);
const server=createApp({url,key,origins}).listen(port,'0.0.0.0',()=>console.log(`BankHotel API listening on port ${port}`));
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});

// Optional local SQL integration test: npm install --no-save @electric-sql/pglite
// Runs only an isolated in-memory database; never connects to Supabase.
const { PGlite } = require('@electric-sql/pglite');
const { btree_gist } = require('@electric-sql/pglite/contrib/btree_gist');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.argv[2] || path.join(__dirname, '..');
const admin = '11111111-1111-4111-8111-111111111111';
const guest = '22222222-2222-4222-8222-222222222222';
const created = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const db = new PGlite({extensions:{btree_gist}});
async function asUser(role, uid = '') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.exec('set role ' + role);
}
async function denied(sql, code = '42501') {
  await assert.rejects(()=>db.query(sql), error=>[code].flat().includes(error.code));
}
(async()=>{
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    insert into auth.users values ('${admin}'), ('${guest}');
  `);
  for (const name of ['001_initial.sql','002_booking_creation.sql','003_admin_rooms.sql','003_admin_rooms.sql']) {
    await db.exec(fs.readFileSync(path.join(root,'supabase',name),'utf8'));
  }
  await db.query('insert into public.hotel_admins(user_id) values ($1)',[admin]);
  await asUser('anon');
  assert.equal((await db.query('select * from rooms')).rows.length,4);
  await denied("insert into rooms(slug,name,price_per_night,image_file) values ('bad','Bad',1,'x.png')");
  await denied('select public.is_hotel_admin()');
  await asUser('authenticated',guest);
  assert.equal((await db.query('select public.is_hotel_admin() as allowed')).rows[0].allowed,false);
  await denied(`insert into hotel_admins(user_id) values ('${guest}')`);
  await denied('select * from hotel_admins');
  await denied("insert into rooms(slug,name,price_per_night,image_file) values ('bad','Bad',1,'x.png')");
  assert.equal((await db.query("update rooms set name='Hacked' returning id")).rows.length,0);
  assert.equal((await db.query('delete from rooms returning id')).rows.length,0);
  await asUser('authenticated',admin);
  assert.equal((await db.query('select public.is_hotel_admin() as allowed')).rows[0].allowed,true);
  await db.query(`insert into rooms(id,slug,name,price_per_night,image_file,is_active) values ($1,'test-room','Test room',1250,'roomonemain.png',false) returning *`,[created]);
  assert.equal((await db.query('select * from rooms')).rows.length,5,'admin sees inactive rooms');
  assert.equal((await db.query('update rooms set price_per_night=1350, is_active=true where id=$1 returning price_per_night',[created])).rows[0].price_per_night,'1350.00');
  await denied(`update rooms set slug='changed-address' where id='${created}'`);
  await denied(`update rooms set price_per_night=-5 where id='${created}'`,'23514');
  await asUser('authenticated',guest);
  const saved = (await db.query(`select (public.create_booking($1,$2,'Test Guest',
    (now() at time zone 'Europe/Kyiv')::date+1,(now() at time zone 'Europe/Kyiv')::date+2,
    time '14:00',time '12:00','desk',1350)).*`,[bookingId,created])).rows[0];
  assert.equal(saved.user_id,guest);
  assert.equal(saved.total_amount,'1350.00');
  await asUser('authenticated',admin);
  await denied(`delete from rooms where id='${created}'`,['23503','23001']);
  await db.query('update rooms set is_active=false where id=$1',[created]);
  await asUser('anon');
  assert.equal((await db.query('select * from rooms where id=$1',[created])).rows.length,0,'unavailable rooms hidden from guests');
  await asUser('authenticated',admin);
  await db.query("insert into rooms(slug,name,price_per_night,image_file) values ('disposable','Disposable',100,'roomonemain.png')");
  assert.equal((await db.query("delete from rooms where slug='disposable' returning id")).rows.length,1,'real delete for unused room');
  await db.exec('reset role');
  await db.query('delete from hotel_admins where user_id=$1',[admin]);
  await asUser('authenticated',admin);
  assert.equal((await db.query('select public.is_hotel_admin() as allowed')).rows[0].allowed,false,'revocation takes effect without a new JWT');
  assert.equal((await db.query("update rooms set name='Revoked' returning id")).rows.length,0);
  console.log('PASS: migrations rerun, anonymous/member denial, no self-promotion, admin CRUD, inactive visibility, immutable address, positive price, booking ownership/price, FK delete protection, immediate role revocation. Isolated PostgreSQL with simulated auth.uid(), not live Supabase.');
})().catch(error=>{console.error(error.message, error.code);process.exitCode=1;}).finally(()=>db.close());

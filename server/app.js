const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fields = 'id, slug, name, description, price_per_night, image_file, image_alt';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function fail(status, code) { return Object.assign(new Error(code), {status, code}); }
function exactBody(body, keys) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !keys.includes(key))) throw fail(400, 'INVALID_INPUT');
}
function roomBody(body, creating) {
  exactBody(body, ['name','description','price_per_night','image_file','image_alt','is_active', ...(creating ? ['id','slug'] : [])]);
  if (creating && (!uuid(body.id) || !slug(body.slug) || body.slug.length > 100)) throw fail(400, 'INVALID_INPUT');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100 ||
    typeof body.description !== 'string' || body.description.length > 5000 ||
    typeof body.price_per_night !== 'number' || !Number.isFinite(body.price_per_night) || body.price_per_night <= 0 || body.price_per_night > 99999999.99 ||
    typeof body.image_file !== 'string' || !/^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp|avif)$/i.test(body.image_file) ||
    typeof body.image_alt !== 'string' || body.image_alt.length > 300 || typeof body.is_active !== 'boolean') throw fail(400, 'INVALID_INPUT');
  return {...body, name: body.name.trim()};
}
async function result(query) {
  const {data, error} = await query.abortSignal(AbortSignal.timeout(15000));
  if (error) throw error;
  return data;
}
function createApp({url, key, origins, clientFactory = createClient}) {
  const app = express();
  app.disable('x-powered-by');
  const clientFor = token => clientFactory(url, key, {
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{ headers:token ? {Authorization:`Bearer ${token}`} : {},
      fetch:(input, init={})=>fetch(input,{...init,signal:init.signal || AbortSignal.timeout(15000)}) }
  });
  const publicClient = clientFor();
  app.use((req,res,next)=>{
    res.set('Cache-Control','no-store');
    res.set('X-Content-Type-Options','nosniff');
    res.vary('Origin');
    const origin = req.get('Origin');
    if (origin && !origins.includes(origin)) return next(fail(403,'ORIGIN_NOT_ALLOWED'));
    if (origin) res.set('Access-Control-Allow-Origin',origin);
    res.set('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers','Authorization,Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({limit:'32kb'}));
  async function authenticated(req,res,next) {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
    if (!match) throw fail(401,'SIGN_IN_REQUIRED');
    req.db = clientFor(match[1]);
    const {data,error} = await req.db.auth.getUser(match[1]);
    if (error || !data.user) {
      if (error && (error.status >= 500 || error.name === 'AuthRetryableFetchError')) throw fail(503,'AUTH_UNAVAILABLE');
      throw fail(401,'SIGN_IN_REQUIRED');
    }
    req.user = data.user;
    next();
  }
  async function administrator(req,res,next) {
    if (await result(req.db.rpc('is_hotel_admin')) !== true) throw fail(403,'ADMIN_REQUIRED');
    next();
  }
  const checkId = (req,res,next)=>{if (!uuid(req.params.id)) throw fail(400,'INVALID_INPUT');next();};
  app.get('/health', (req,res)=>res.json({status:'ok'}));
  app.get('/api/rooms', async(req,res)=>res.json(await result(publicClient.from('rooms').select(fields).eq('is_active',true).order('price_per_night'))));
  app.get('/api/rooms/:slug', async(req,res)=>{
    if (!slug(req.params.slug)) throw fail(400,'INVALID_INPUT');
    res.json(await result(publicClient.from('rooms').select(fields).eq('slug',req.params.slug).eq('is_active',true).maybeSingle()));
  });
  app.get('/api/availability',async(req,res)=>res.json(await result(publicClient.rpc('room_availability'))));
  app.get('/api/me/admin',authenticated,async(req,res)=>res.json(await result(req.db.rpc('is_hotel_admin'))));
  app.get('/api/bookings/:id',authenticated,checkId,async(req,res)=>{
    // Explicit owner filtering complements the existing owner RLS policy.
    res.json(await result(req.db.from('bookings').select('*, rooms(name, slug)').eq('id',req.params.id).eq('user_id',req.user.id).maybeSingle()));
  });
  app.post('/api/bookings',authenticated,async(req,res)=>{
    const b=req.body;
    exactBody(b,['p_id','p_room_id','p_guest_name','p_check_in','p_check_out','p_arrival_time','p_departure_time','p_payment_method','p_expected_rate']);
    if (!uuid(b.p_id) || !uuid(b.p_room_id) || typeof b.p_guest_name !== 'string' || !b.p_guest_name.trim() || b.p_guest_name.length > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(b.p_check_in || '') || !/^\d{4}-\d{2}-\d{2}$/.test(b.p_check_out || '') ||
      !['14:00','16:00','18:00'].includes(b.p_arrival_time) || !['08:00','10:00','12:00'].includes(b.p_departure_time) ||
      !['desk','online'].includes(b.p_payment_method) || typeof b.p_expected_rate !== 'number' || !Number.isFinite(b.p_expected_rate) || b.p_expected_rate<=0) throw fail(400,'INVALID_INPUT');
    // SQL derives user_id from the forwarded JWT, checks dates/price and handles retries.
    res.status(201).json(await result(req.db.rpc('create_booking',b).single()));
  });
  app.use('/api/admin',authenticated,administrator);
  app.get('/api/admin/rooms',async(req,res)=>res.json(await result(req.db.from('rooms').select(fields+', is_active').order('created_at'))));
  app.post('/api/admin/rooms',async(req,res)=>res.status(201).json(await result(req.db.from('rooms').insert(roomBody(req.body,true)).select().single())));
  app.patch('/api/admin/rooms/:id',checkId,async(req,res)=>res.json(await result(req.db.from('rooms').update(roomBody(req.body,false)).eq('id',req.params.id).select().single())));
  app.delete('/api/admin/rooms/:id',checkId,async(req,res)=>{
    const row=await result(req.db.from('rooms').delete().eq('id',req.params.id).select('id').maybeSingle());
    if (!row) throw fail(404,'ROOM_NOT_FOUND');
    res.json(row);
  });
  app.use((req,res,next)=>next(fail(404,'NOT_FOUND')));
  app.use((error,req,res,next)=>{
    const databaseCodes={'23505':409,'23503':409,'23001':409,'23P01':409,'42501':403,'23514':400,'22003':400,'22007':400,'22008':400,'22P02':400,'PGRST116':404,'PGRST202':503,'42703':503};
    const domainMessages=['PRICE_CHANGED','ROOM_UNAVAILABLE','INVALID_BOOKING','REQUEST_ALREADY_USED','SIGN_IN_REQUIRED'];
    let status=error.status || databaseCodes[error.code] || 503;
    let code=error.code, message=error.code;
    if (domainMessages.includes(error.message)) {status=error.message==='SIGN_IN_REQUIRED'?401:409;message=error.message;code=error.message;}
    else if (error.type === 'entity.parse.failed') {status=400;code=message='INVALID_JSON';}
    else if (error.type === 'entity.too.large') {status=413;code=message='BODY_TOO_LARGE';}
    else if (!databaseCodes[code] && !['SIGN_IN_REQUIRED','ADMIN_REQUIRED','AUTH_UNAVAILABLE','ORIGIN_NOT_ALLOWED','INVALID_INPUT','ROOM_NOT_FOUND','NOT_FOUND'].includes(code)) {code=message='API_UNAVAILABLE';}
    res.status(status).json({error:{code,message}});
  });
  return app;
}
module.exports={createApp};

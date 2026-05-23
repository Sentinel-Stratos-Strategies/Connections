export interface VoiceProfile {
  id: string;
  tenant_id: string;
  profile_name: string;
  voice_id: string;
  model: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export async function handleVoiceList(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const { results } = await env.DB.prepare(
    'SELECT * FROM voice_profiles WHERE tenant_id = ? ORDER BY profile_name ASC'
  ).bind(tenantId).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleVoiceShow(request: Request, env: any, id: string) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const profile = await env.DB.prepare(
    'SELECT * FROM voice_profiles WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).first();

  if (!profile) return new Response('Profile not found', { status: 404 });

  return new Response(JSON.stringify(profile), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleVoiceUpsert(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const body: any = await request.json();
  const { name, voiceId, model, metadata } = body;
  if (!name || !voiceId || !model) return new Response('Missing name, voiceId, or model', { status: 400 });

  const existing = await env.DB.prepare(
    'SELECT id FROM voice_profiles WHERE tenant_id = ? AND profile_name = ?'
  ).bind(tenantId, name).first();

  const now = new Date().toISOString();
  if (existing) {
    await env.DB.prepare(
      'UPDATE voice_profiles SET voice_id = ?, model = ?, metadata = ?, updated_at = ? WHERE id = ?'
    ).bind(voiceId, model, JSON.stringify(metadata || {}), now, existing.id).run();
    
    return new Response(JSON.stringify({ id: existing.id, status: 'updated' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO voice_profiles (id, tenant_id, profile_name, voice_id, model, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, name, voiceId, model, JSON.stringify(metadata || {}), now, now).run();

    return new Response(JSON.stringify({ id, status: 'created' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201,
    });
  }
}

export async function handleVoiceDelete(request: Request, env: any, id: string) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const { success } = await env.DB.prepare(
    'DELETE FROM voice_profiles WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).run();

  if (!success) return new Response('Delete failed', { status: 500 });
  return new Response(null, { status: 204 });
}

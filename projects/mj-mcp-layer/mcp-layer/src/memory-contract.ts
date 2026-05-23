export interface MemoryEntry {
  id: string;
  tenant_id: string;
  entry_key: string;
  entry_value: string;
  metadata?: string;
  created_at: string;
  updated_at: string;
}

export async function handleMemoryList(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const { results } = await env.DB.prepare(
    'SELECT * FROM memory_entries WHERE tenant_id = ? ORDER BY updated_at DESC'
  ).bind(tenantId).all();

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleMemoryShow(request: Request, env: any, id: string) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const entry = await env.DB.prepare(
    'SELECT * FROM memory_entries WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).first();

  if (!entry) return new Response('Entry not found', { status: 404 });

  return new Response(JSON.stringify(entry), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleMemoryUpsert(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const body: any = await request.json();
  const { key, value, metadata } = body;
  if (!key || !value) return new Response('Missing key or value', { status: 400 });

  const existing = await env.DB.prepare(
    'SELECT id FROM memory_entries WHERE tenant_id = ? AND entry_key = ?'
  ).bind(tenantId, key).first();

  const now = new Date().toISOString();
  if (existing) {
    await env.DB.prepare(
      'UPDATE memory_entries SET entry_value = ?, metadata = ?, updated_at = ? WHERE id = ?'
    ).bind(value, JSON.stringify(metadata || {}), now, existing.id).run();
    
    return new Response(JSON.stringify({ id: existing.id, status: 'updated' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } else {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO memory_entries (id, tenant_id, entry_key, entry_value, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, tenantId, key, value, JSON.stringify(metadata || {}), now, now).run();

    return new Response(JSON.stringify({ id, status: 'created' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201,
    });
  }
}

export async function handleMemoryDelete(request: Request, env: any, id: string) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  const { success } = await env.DB.prepare(
    'DELETE FROM memory_entries WHERE id = ? AND tenant_id = ?'
  ).bind(id, tenantId).run();

  if (!success) return new Response('Delete failed', { status: 500 });
  return new Response(null, { status: 204 });
}

export async function handleMemoryPurge(request: Request, env: any) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) return new Response('Missing x-tenant-id', { status: 400 });

  await env.DB.prepare(
    'DELETE FROM memory_entries WHERE tenant_id = ?'
  ).bind(tenantId).run();

  return new Response(null, { status: 204 });
}

export async function fetchMemoryContext(tenantId: string, env: any) {
  const { results } = await env.DB.prepare(
    'SELECT entry_key, entry_value FROM memory_entries WHERE tenant_id = ?'
  ).bind(tenantId).all();

  return results.reduce((acc: any, row: any) => {
    acc[row.entry_key] = row.entry_value;
    return acc;
  }, {});
}

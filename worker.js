/**
 * LabReach Waitlist Worker
 * ─────────────────────────────────────────────────────────────
 * Routes:
 *   POST /api/waitlist        — save a new waitlist entry
 *   GET  /api/waitlist        — list all entries (protected)
 *   GET  /api/waitlist/:id    — get a single entry (protected)
 *   DELETE /api/waitlist/:id  — delete an entry (protected)
 *   GET  /api/health          — health check
 * ─────────────────────────────────────────────────────────────
 * Bindings required in wrangler.toml:
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "labreach"
 *   database_id = "YOUR_D1_DATABASE_ID"
 *
 * Secrets (set via: wrangler secret put ADMIN_KEY):
 *   ADMIN_KEY — a secret string you choose to protect GET/DELETE routes
 * ─────────────────────────────────────────────────────────────
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    // ── Handle CORS preflight ──────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Ensure D1 binding exists ───────────────────────────────
    if (!env.DB) {
      return jsonResponse({ error: "Database binding not configured" }, 500);
    }

    // ── Initialise table if it doesn't exist yet ───────────────
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, source TEXT DEFAULT 'website', created_at TEXT DEFAULT (datetime('now')))").run();

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // ── Route: GET /api/health ─────────────────────────────────
    if (path === "/api/health" && method === "GET") {
      return jsonResponse({ status: "ok", service: "LabReach Waitlist API" });
    }

    // ── Route: POST /api/waitlist ──────────────────────────────
    if (path === "/api/waitlist" && method === "POST") {
      return handleSubmit(request, env);
    }

    // ── Routes below are admin-protected ──────────────────────
    if (path === "/api/waitlist" && method === "GET") {
      if (!isAuthorized(request, env)) return unauthorized();
      return handleList(url, env);
    }

    if (path.startsWith("/api/waitlist/") && method === "GET") {
      if (!isAuthorized(request, env)) return unauthorized();
      const id = path.split("/api/waitlist/")[1];
      return handleGetOne(id, env);
    }

    if (path.startsWith("/api/waitlist/") && method === "DELETE") {
      if (!isAuthorized(request, env)) return unauthorized();
      const id = path.split("/api/waitlist/")[1];
      return handleDelete(id, env);
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};

// ── POST /api/waitlist ─────────────────────────────────────────
async function handleSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { name, email, phone } = body;

  // Insert into D1
  try {
    const result = await env.DB.prepare(`
      INSERT INTO waitlist (name, email, phone, source)
      VALUES (?, ?, ?, ?)
    `)
    .bind(
      name.trim(),
      email.trim().toLowerCase(),
      phone.trim(),
      "website"
    )
    .run();

    return jsonResponse({
      success:  true,
      message:  "You're on the waitlist!",
      id:       result.meta.last_row_id
    }, 201);

  } catch (err) {
    // Unique constraint = duplicate email
    if (err.message && err.message.includes("UNIQUE")) {
      return jsonResponse({
        error: "This email is already on the waitlist"
      }, 409);
    }
    console.error("D1 insert error:", err);
    return jsonResponse({ error: "Failed to save entry" }, 500);
  }
}

// ── GET /api/waitlist  (admin) ─────────────────────────────────
async function handleList(url, env) {
  const page  = parseInt(url.searchParams.get("page")  || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const [rows, count] = await Promise.all([
    env.DB.prepare(`
      SELECT id, name, email, phone, source, created_at
      FROM waitlist
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all(),
    env.DB.prepare(`SELECT COUNT(*) as total FROM waitlist`).first()
  ]);

  return jsonResponse({
    total:   count.total,
    page,
    limit,
    entries: rows.results
  });
}

// ── GET /api/waitlist/:id  (admin) ────────────────────────────
async function handleGetOne(id, env) {
  if (!id || isNaN(Number(id))) {
    return jsonResponse({ error: "Invalid ID" }, 400);
  }
  const row = await env.DB.prepare(`
    SELECT id, name, email, phone, source, created_at
    FROM waitlist WHERE id = ?
  `).bind(Number(id)).first();

  if (!row) return jsonResponse({ error: "Entry not found" }, 404);
  return jsonResponse(row);
}

// ── DELETE /api/waitlist/:id  (admin) ─────────────────────────
async function handleDelete(id, env) {
  if (!id || isNaN(Number(id))) {
    return jsonResponse({ error: "Invalid ID" }, 400);
  }
  const existing = await env.DB.prepare(
    "SELECT id FROM waitlist WHERE id = ?"
  ).bind(Number(id)).first();

  if (!existing) return jsonResponse({ error: "Entry not found" }, 404);

  await env.DB.prepare(
    "DELETE FROM waitlist WHERE id = ?"
  ).bind(Number(id)).run();

  return jsonResponse({ success: true, message: `Entry ${id} deleted` });
}

// ── Helpers ────────────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const key  = auth.replace("Bearer ", "").trim();
  return key === env.ADMIN_KEY;
}

function unauthorized() {
  return jsonResponse({ error: "Unauthorized" }, 401);
}
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

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    try {

      // Health check — test DB is reachable too
      if (path === "/api/health" && method === "GET") {
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS waitlist (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT NOT NULL UNIQUE,
            phone      TEXT NOT NULL,
            source     TEXT DEFAULT 'website',
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);
        return jsonResponse({ status: "ok" });
      }

      // POST /api/waitlist — save entry
      if (path === "/api/waitlist" && method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON" }, 400);
        }

        const { name, email, phone } = body;

        if (!name  || name.trim().length  < 1) return jsonResponse({ error: "name is required" }, 400);
        if (!email || !email.includes("@"))     return jsonResponse({ error: "valid email is required" }, 400);
        if (!phone || phone.trim().length  < 1) return jsonResponse({ error: "phone is required" }, 400);

        // Create table if not exists
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS waitlist (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT NOT NULL UNIQUE,
            phone      TEXT NOT NULL,
            source     TEXT DEFAULT 'website',
            created_at TEXT DEFAULT (datetime('now'))
          )
        `);

        try {
          const result = await env.DB.prepare(`
            INSERT INTO waitlist (name, email, phone, source)
            VALUES (?, ?, ?, 'website')
          `).bind(name.trim(), email.trim().toLowerCase(), phone.trim()).run();

          return jsonResponse({ success: true, id: result.meta.last_row_id }, 201);

        } catch (err) {
          if (err.message && err.message.includes("UNIQUE")) {
            return jsonResponse({ error: "This email is already on the waitlist" }, 409);
          }
          throw err;
        }
      }

      // GET /api/waitlist — list all (admin)
      if (path === "/api/waitlist" && method === "GET") {
        if (!isAuthorized(request, env)) return jsonResponse({ error: "Unauthorized" }, 401);
        const rows = await env.DB.prepare(`
          SELECT * FROM waitlist ORDER BY created_at DESC
        `).all();
        return jsonResponse({ entries: rows.results, total: rows.results.length });
      }

      return jsonResponse({ error: "Not found" }, 404);

    } catch (err) {
      console.error("Worker error:", err.message);
      return jsonResponse({ error: "Worker error: " + err.message }, 500);
    }
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return auth.replace("Bearer ", "").trim() === env.ADMIN_KEY;
}
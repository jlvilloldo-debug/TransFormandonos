// =====================================================================
// InspectApp v5.11 · función del servidor "inspectapp-route" (Supabase Edge Function)
// Calcula el recorrido por rutas y caminos entre dos o más puntos (para trazar fibra).
// Usa OpenRouteService. La clave de ORS queda guardada acá, nunca en la app.
//
// Seguridad:
//   · solo atiende a usuarios con sesión de InspectApp (verifica el token del usuario);
//   · descuenta un pedido del cupo diario de la empresa (route_take en la base);
//   · al servicio externo se le mandan solo coordenadas, nunca nombres;
//   · responde solo a la dirección de la app (APP_ORIGIN).
//
// Secretos a cargar en Supabase → Edge Functions → Secrets:
//   ORS_KEY      = la clave gratuita de openrouteservice.org
//   APP_ORIGIN   = https://jlvilloldo-debug.github.io   (solo el dominio, sin la carpeta)
//   ROUTE_MAX    = 200   (opcional: pedidos por empresa por día)
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase solo.
// Desplegar CON verificación de JWT:  supabase functions deploy inspectapp-route
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SVC = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGIN = Deno.env.get("APP_ORIGIN") || "";
const MAX = Math.max(1, Math.min(5000, Number(Deno.env.get("ROUTE_MAX") || 200)));
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Vary": "Origin",
});
const json = (o: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405, origin);
  if (ORIGIN && origin !== ORIGIN) return json({ error: "Origen no permitido" }, 403, origin);
  const key = Deno.env.get("ORS_KEY");
  if (!key) return json({ error: "El ruteo automático no está activado (falta ORS_KEY)." }, 503, origin);

  // quién llama: el token de la sesión del usuario
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await SVC.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Sesión inválida" }, 401, origin);

  // pedido: hasta 25 puntos [lat, lng], todos números válidos
  let body: { points?: unknown; profile?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido" }, 400, origin); }
  const pts = Array.isArray(body.points) ? body.points : [];
  if (pts.length < 2 || pts.length > 25) return json({ error: "Se necesitan entre 2 y 25 puntos" }, 400, origin);
  const coords: number[][] = [];
  for (const p of pts) {
    if (!Array.isArray(p) || p.length < 2) return json({ error: "Punto inválido" }, 400, origin);
    const la = Number(p[0]), lo = Number(p[1]);
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return json({ error: "Punto inválido" }, 400, origin);
    coords.push([Math.round(lo * 1e6) / 1e6, Math.round(la * 1e6) / 1e6]);   // ORS usa [lng, lat]
  }
  const profile = body.profile === "foot-walking" ? "foot-walking" : "driving-car";

  // cupo diario de la empresa
  const { data: org } = await SVC.rpc("route_take", { p_user: u.user.id, p_max: MAX });
  if (!org) return json({ error: "Se alcanzó el cupo de rutas de hoy o la licencia no está activa." }, 429, origin);

  const r = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: { "Authorization": key, "Content-Type": "application/json", "Accept": "application/geo+json" },
    body: JSON.stringify({ coordinates: coords, instructions: false, radiuses: coords.map(() => 2000) }),
  }).catch(() => null);
  if (!r) return json({ error: "No se pudo conectar con el servicio de rutas" }, 502, origin);
  if (!r.ok) {
    const t = r.status === 404 ? "No encontré un camino entre esos puntos (puede que alguno esté lejos de una ruta)." : `El servicio de rutas respondió ${r.status}`;
    return json({ error: t }, 502, origin);
  }
  const g = await r.json().catch(() => null);
  const line = g?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(line) || line.length < 2) return json({ error: "El servicio no devolvió un recorrido" }, 502, origin);
  const path = line.slice(0, 20000).map((c: number[]) => [Math.round(c[1] * 1e6) / 1e6, Math.round(c[0] * 1e6) / 1e6]);   // [lat, lng]
  const dist = Number(g?.features?.[0]?.properties?.summary?.distance) || null;
  return json({ path, distance_m: dist }, 200, origin);
});

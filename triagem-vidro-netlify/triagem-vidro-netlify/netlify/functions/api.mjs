/**
 * API da base compartilhada — Análise Qualitativa Cores de Caco Vidro
 * Armazenamento: Netlify Blobs (store "dados" para JSON, store "imagens" para arquivos)
 *
 * Rotas (todas sob /api):
 *   GET    /api/ping                      -> {ok, needKey, authorized}
 *   GET    /api/config                    -> cadastros (ou null)
 *   PUT    /api/config                    -> grava cadastros
 *   GET    /api/list/:colecao             -> lista documentos (colecao = analises | imagens)
 *   POST   /api/doc/:colecao              -> cria documento, devolve {id}
 *   PUT    /api/doc/:colecao/:id          -> substitui documento
 *   DELETE /api/doc/:colecao/:id          -> apaga documento
 *   POST   /api/blob                      -> grava imagem (corpo binário image/jpeg|png|webp), devolve {id}
 *   GET    /api/blob/:id?k=CHAVE          -> devolve a imagem
 *   DELETE /api/blob/:id                  -> apaga imagem
 *
 * Acesso: se a variável de ambiente APP_KEY estiver definida no Netlify, toda chamada precisa
 * do cabeçalho  x-app-key: <APP_KEY>  (ou ?k=<APP_KEY> para imagens em <img>).
 */
import { getStore } from "@netlify/blobs";

const COLECOES = new Set(["analises", "imagens"]);
const TIPOS_IMG = /^image\/(jpeg|png|webp)$/;
const MAX_IMG = 5_500_000; // limite de corpo das Functions síncronas é ~6 MB

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const idValido = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);

function chaveConfigurada() {
  try { return (globalThis.Netlify?.env?.get("APP_KEY") ?? process.env.APP_KEY ?? "").trim(); }
  catch { return (process.env.APP_KEY ?? "").trim(); }
}

export default async (req) => {
  const url = new URL(req.url);
  const partes = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = partes;

  const KEY = chaveConfigurada();
  const enviada = req.headers.get("x-app-key") || url.searchParams.get("k") || "";
  const autorizado = !KEY || enviada === KEY;

  if (a === "ping") return json({ ok: true, needKey: !!KEY, authorized: autorizado });
  if (!autorizado) return json({ error: "unauthorized" }, 401);

  const dados = getStore({ name: "dados", consistency: "strong" });
  const arquivos = getStore({ name: "imagens", consistency: "strong" });

  try {
    // ---- cadastros
    if (a === "config") {
      if (req.method === "GET") return json(await dados.get("config", { type: "json" }));
      if (req.method === "PUT") {
        const corpo = await req.json();
        if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return json({ error: "invalid" }, 400);
        await dados.setJSON("config", corpo);
        return json({ ok: true });
      }
    }

    // ---- listar coleção
    if (a === "list" && COLECOES.has(b) && req.method === "GET") {
      const { blobs } = await dados.list({ prefix: `${b}/` });
      const docs = await Promise.all(
        blobs.map(async (x) => {
          const d = await dados.get(x.key, { type: "json" });
          return d ? { ...d, _id: x.key.slice(b.length + 1) } : null;
        })
      );
      return json(docs.filter(Boolean));
    }

    // ---- documentos
    if (a === "doc" && COLECOES.has(b)) {
      if (req.method === "POST" && !c) {
        const corpo = await req.json();
        if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return json({ error: "invalid" }, 400);
        delete corpo._id;
        const id = novoId();
        await dados.setJSON(`${b}/${id}`, corpo);
        return json({ id }, 201);
      }
      if (c && idValido(c) && req.method === "PUT") {
        const corpo = await req.json();
        delete corpo._id;
        await dados.setJSON(`${b}/${c}`, corpo);
        return json({ ok: true });
      }
      if (c && idValido(c) && req.method === "DELETE") {
        await dados.delete(`${b}/${c}`);
        return json({ ok: true });
      }
    }

    // ---- imagens
    if (a === "blob") {
      if (req.method === "POST" && !b) {
        const tipo = (req.headers.get("content-type") || "").split(";")[0].trim();
        if (!TIPOS_IMG.test(tipo)) return json({ error: "unsupported_type" }, 415);
        const buf = await req.arrayBuffer();
        if (!buf.byteLength) return json({ error: "empty" }, 400);
        if (buf.byteLength > MAX_IMG) return json({ error: "too_large" }, 413);
        const id = novoId();
        await arquivos.set(id, buf, { metadata: { type: tipo, bytes: buf.byteLength } });
        return json({ id, sizeBytes: buf.byteLength }, 201);
      }
      if (b && idValido(b) && req.method === "GET") {
        const r = await arquivos.getWithMetadata(b, { type: "arrayBuffer" });
        if (!r) return new Response("Not found", { status: 404 });
        return new Response(r.data, {
          headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "private, max-age=31536000, immutable" },
        });
      }
      if (b && idValido(b) && req.method === "DELETE") {
        await arquivos.delete(b);
        return json({ ok: true });
      }
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: "server", message: String(e?.message || e) }, 500);
  }
};

export const config = { path: "/api/*" };

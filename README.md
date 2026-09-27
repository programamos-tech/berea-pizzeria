# Berea Pizzerías

Producto **Berea Pizzerías** — checkout local separado de Milagros Guacarí / Berea Facturas (`~/Developer/milagros-guacari`).

No compartir puertos ni `project_id` de Supabase con Facturas.

| | Facturas | Pizzerías |
|---|---|---|
| Path | `~/Developer/milagros-guacari` | `~/Developer/berea-pizzerias` |
| Supabase `project_id` | `milagros-guacari` | `berea-pizzerias` |
| API | http://127.0.0.1:57521 | http://127.0.0.1:57621 |
| App | http://127.0.0.1:43241 | http://127.0.0.1:43341 |
| Default tenant | `aleya` | `berea-pizzerias` |

## Local bootstrap

```bash
cp .env.example .env.local
supabase start
supabase db reset
# keys → .env.local (URL :57621)
npm install
npm run dev:local   # :43341
```

Studio: http://127.0.0.1:57623

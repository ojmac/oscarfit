# Coach IA — Despliegue del proxy (Cloudflare Workers)

## 1. Requisitos
- Cuenta gratuita en https://dash.cloudflare.com (solo email)
- Una API key de Anthropic: https://console.anthropic.com/settings/keys
- Node.js instalado en tu ordenador

## 2. Instalar wrangler (la CLI de Cloudflare)
```bash
npm install -g wrangler
wrangler login
```
Esto abre el navegador para autenticarte con tu cuenta de Cloudflare.

## 3. Desplegar el Worker
Desde la carpeta `worker/`:
```bash
cd worker
wrangler deploy
```
Esto te da una URL del tipo:
`https://oscarfit78-coach.TU-SUBDOMINIO.workers.dev`

## 4. Guardar tu API key como secreto (nunca en el código)
```bash
wrangler secret put ANTHROPIC_API_KEY
```
Te pedirá que pegues la key. Se guarda cifrada en Cloudflare, no en el repo ni en el código.

## 5. Restringir el origen (recomendado, cuando ya tengas la PWA publicada)
Edita `wrangler.toml`, cambia:
```
ALLOWED_ORIGIN = "*"
```
por la URL real de tu PWA, por ejemplo:
```
ALLOWED_ORIGIN = "https://tuusuario.github.io"
```
y vuelve a desplegar con `wrangler deploy`.

## 6. Conectar la PWA con el Worker
En `js/coach.js`, cambia la constante `COACH_ENDPOINT` por la URL de tu Worker
(la del paso 3).

## Coste
El plan gratuito de Cloudflare Workers incluye 100.000 peticiones/día.
Para tu uso personal esto no tiene coste. Lo único que pagas es el consumo
real de la API de Anthropic (por tokens), directamente a Anthropic con tu
propia cuenta — normalmente céntimos al mes para uso personal moderado.

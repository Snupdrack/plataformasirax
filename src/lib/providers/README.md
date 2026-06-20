# Cómo agregar un nuevo proveedor / submódulo

Este proyecto separa **dos capas de proveedores**:

## 1. Proveedores de IA (`src/lib/ai/`)

Para el dictamen ejecutivo y cualquier otro texto generado por IA. Ya soporta
Anthropic, OpenAI, Google Gemini, y cualquier endpoint compatible con el
formato de OpenAI (Groq, Together, OpenRouter, Ollama local, etc.) vía el
proveedor `custom`.

**Para agregar uno nuevo** (ej. Mistral nativo, Cohere):

1. Copia `src/lib/ai/providers/_template.ts` a `src/lib/ai/providers/mistral.ts`
2. Implementa la llamada HTTP real al API de ese proveedor
3. Agrégalo al arreglo `PROVIDERS` en `src/lib/ai/index.ts`
4. Listo — ya es seleccionable con `AI_PROVIDER=mistral` en `.env`, y entra
   automáticamente en la cadena de fallback si no se fuerza ninguno.

Nunca importes un proveedor de IA directamente desde fuera de `src/lib/ai/` —
siempre usa `generateAiText()` del índice, así el resto del código no le
importa qué proveedor está activo.

## 2. Proveedores de datos (`src/lib/providers/`)

CURP/RENAPO, RFC/SAT, sanciones, breach de email, etc. Cada uno es un archivo
independiente que expone funciones `async` y sigue esta convención de
respuesta (la sigue todo lo que ya existe — `nubarium.ts`, `hibp.ts`, etc.):

```ts
{ ok: false, configured: false, error: '...' }  // faltan env vars
{ ok: false, configured: true,  error: '...' }  // se intentó, falló (red/4xx/5xx)
{ ok: true,  configured: true,  ...data }       // data real
```

Esto es lo que le permite a `calculateScores()` en `synkdata.ts` saber si un
dato es real, si falló, o si simplemente no está configurado — y por eso el
sistema nunca muestra data inventada como si fuera real.

**Para agregar uno nuevo:**

1. Copia `src/lib/providers/_template.ts` a `src/lib/providers/tu-servicio.ts`
2. Implementa la llamada real
3. Agrega una entrada en `src/lib/providers/registry.ts` (aparece automático
   en `GET /api/system/status`)
4. Llámalo desde la función correspondiente en `src/lib/synkdata.ts` (o crea
   una función nueva ahí si es una categoría que no existía)
5. Si debe afectar el Trust/Risk Score, agrega su peso en `calculateScores()`

## Verificar qué está activo

`GET /api/system/status` (requiere estar logueado) regresa todos los
proveedores registrados — IA y datos — con `configured: true/false` y qué
env vars le faltan a cada uno. Es la forma más rápida de confirmar que tu
`.env` quedó bien sin tener que abrir archivo por archivo.

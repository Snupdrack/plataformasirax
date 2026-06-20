// PLANTILLA — copia este archivo a un nombre nuevo (ej. mi-servicio.ts),
// ajusta la llamada HTTP real, y:
//   1. Impórtalo y úsalo desde src/lib/synkdata.ts (si extiende un módulo
//      existente: gobierno, sanciones, identidad digital) o crea una función
//      nueva ahí si es una categoría nueva.
//   2. Agrégalo a PROVIDER_REGISTRY en ./registry.ts para que aparezca en
//      GET /api/system/status.
//   3. Si necesita aparecer en el reporte/scoring, agrégalo en
//      calculateScores() dentro de synkdata.ts.
//
// Convención de retorno (todos los providers la siguen):
//   - configured: false  -> faltan env vars, nunca se intentó la llamada
//   - configured: true, ok: false -> se intentó pero falló (red, 4xx, 5xx) — vienen en `error`
//   - configured: true, ok: true  -> data real en los demás campos
//
// Esto le permite al resto del sistema (checks/route.ts, calculateScores)
// distinguir "no configurado" de "se intentó y falló" de "data real", y
// nunca mostrar datos inventados como si fueran reales.
//
// Este archivo NO se importa en ningún lado — es solo referencia.

export async function miServicioConsulta(valor: string): Promise<any> {
  const apiKey = process.env.MI_SERVICIO_API_KEY
  if (!apiKey) {
    return { ok: false, configured: false, error: 'MI_SERVICIO_API_KEY no configurado en .env' }
  }

  try {
    const res = await fetch(`https://api.mi-servicio.com/v1/consulta?q=${encodeURIComponent(valor)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
    return {
      ok: true,
      configured: true,
      // ...mapea aquí los campos reales que te interesan de `data`
    }
  } catch (err: any) {
    return { ok: false, configured: true, error: err?.message || 'Error de red consultando Mi Servicio' }
  }
}

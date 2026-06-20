// Registro central de proveedores de datos externos. No participa en la
// lógica de negocio (eso sigue viviendo en synkdata.ts) — es solo un mapa
// de "qué está disponible y con qué env vars se prende", usado por el
// endpoint /api/system/status y como documentación viva.
//
// Para agregar un proveedor nuevo:
//   1. Crea src/lib/providers/tu-servicio.ts (usa _template.ts como base)
//   2. Impleméntalo ahí: una función async que regresa { ok, configured, ...data }
//   3. Agrega una entrada aquí abajo para que aparezca en /api/system/status
//   4. Llámalo desde synkdata.ts donde corresponda (o desde un módulo nuevo
//      si es una categoría nueva, ej. src/lib/providers/criminal-records.ts)

export type ProviderCategory = 'gobierno' | 'sanciones' | 'identidad_digital' | 'ia'

export interface ProviderInfo {
  id: string
  label: string
  category: ProviderCategory
  envVars: string[]
  configured: () => boolean
  docsUrl?: string
}

export const PROVIDER_REGISTRY: ProviderInfo[] = [
  {
    id: 'nubarium',
    label: 'Nubarium — CURP/RENAPO, RFC/SAT, historial IMSS, PEPs',
    category: 'gobierno',
    envVars: ['NUBARIUM_USER', 'NUBARIUM_PASSWORD'],
    configured: () => !!process.env.NUBARIUM_USER && !!process.env.NUBARIUM_PASSWORD,
    docsUrl: 'https://nubarium.com/productos',
  },
  {
    id: 'opensanctions',
    label: 'OpenSanctions — OFAC / ONU / EU / UK',
    category: 'sanciones',
    envVars: ['OPENSANCTIONS_API_KEY'],
    configured: () => !!process.env.OPENSANCTIONS_API_KEY,
    docsUrl: 'https://www.opensanctions.org/api/',
  },
  {
    id: 'hibp',
    label: 'HaveIBeenPwned — brechas de datos de email',
    category: 'identidad_digital',
    envVars: ['HIBP_API_KEY'],
    configured: () => !!process.env.HIBP_API_KEY,
    docsUrl: 'https://haveibeenpwned.com/API/Key',
  },
  {
    id: 'hunter',
    label: 'Hunter.io — verificación/entregabilidad de email',
    category: 'identidad_digital',
    envVars: ['HUNTER_API_KEY'],
    configured: () => !!process.env.HUNTER_API_KEY,
    docsUrl: 'https://hunter.io/api-keys',
  },
  {
    id: 'numverify',
    label: 'Numverify — validación de teléfono',
    category: 'identidad_digital',
    envVars: ['NUMVERIFY_API_KEY'],
    configured: () => !!process.env.NUMVERIFY_API_KEY,
    docsUrl: 'https://numverify.com',
  },
  {
    id: 'dns-gravatar',
    label: 'DNS MX + Gravatar (sin API key)',
    category: 'identidad_digital',
    envVars: [],
    configured: () => true,
  },
  {
    id: 'username-check',
    label: 'Existencia de username (GitHub/GitLab/Reddit/Dev.to/StackOverflow, sin API key)',
    category: 'identidad_digital',
    envVars: [],
    configured: () => true,
  },
]

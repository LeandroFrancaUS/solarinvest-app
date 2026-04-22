import { lookupCep } from './cepLookup'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Coordinates = {
  lat: number
  lng: number
}

export type GeocodingResult = {
  cidade: string
  uf: string
  lat: number
  lng: number
}

type NominatimResult = {
  lat: string
  lon: string
  display_name: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Coordinates of Anápolis/GO (default base city for travel cost calculation). */
export const BASE_CITY_COORDS: Coordinates = {
  lat: -16.3281,
  lng: -48.9529,
}

/** Display name of the base city used for travel cost calculation. */
export const BASE_CITY_NAME = 'Anápolis/GO'

/**
 * Road factor applied to straight-line Haversine distance to approximate
 * actual road distance (1.3 = 30% extra for road curves).
 */
export const ROAD_FACTOR = 1.3

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Calculates straight-line distance in km between two coordinates using the
 * Haversine formula.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculates round-trip km from a base city (default: Anápolis/GO) to a
 * destination. Uses Haversine × road factor × 2 for round trip.
 */
export function calcRoundTripKm(
  destLat: number,
  destLng: number,
  base: Coordinates = BASE_CITY_COORDS,
  roadFactor: number = ROAD_FACTOR,
): number {
  const straightLine = haversineKm(base.lat, base.lng, destLat, destLng)
  return Math.round(straightLine * roadFactor * 2)
}

/**
 * Geocodes a Brazilian city/UF to coordinates using Nominatim (OpenStreetMap).
 * Returns null if the city cannot be resolved.
 */
export async function geocodeCity(
  cidade: string,
  uf: string,
  signal?: AbortSignal,
): Promise<Coordinates | null> {
  const query = encodeURIComponent(`${cidade}, ${uf}, Brasil`)
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'Accept-Language': 'pt-BR',
        'User-Agent': 'SolarInvest/1.0 (app.solarinvest.info)',
      },
    })
    if (!response.ok) return null
    const data = (await response.json() as unknown) as NominatimResult[]
    if (!data || data.length === 0) return null
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
  } catch {
    return null
  }
}

/**
 * Resolves a destination input (CEP or City/UF string) to a geocoding result.
 *
 * Accepted formats:
 *   - CEP: "75100-000", "75100000"
 *   - City/UF: "Brasília/DF", "Brasília, DF", "Caldas Novas GO"
 */
export async function resolveDestinationInput(
  input: string,
  signal?: AbortSignal,
): Promise<GeocodingResult> {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Entrada vazia.')

  const digits = trimmed.replace(/\D/g, '')
  let cidade: string
  let uf: string

  // Detect CEP (8 digits)
  if (digits.length === 8) {
    const cepResult = await lookupCep(digits, signal)
    if (!cepResult || !cepResult.cidade || !cepResult.uf) {
      throw new Error('CEP não encontrado ou inválido.')
    }
    cidade = cepResult.cidade
    uf = cepResult.uf
  } else {
    // Treat as City/UF: accepts "Brasília/DF", "Brasília, DF", "Brasília-DF", "Brasília DF"
    const match = trimmed.match(/^(.+?)[\s/,\-]+([A-Za-z]{2})\s*$/)
    if (!match) {
      throw new Error(
        'Formato inválido. Use "Cidade/UF" (ex: Brasília/DF) ou CEP (ex: 75100-000).',
      )
    }
    cidade = match[1].trim()
    uf = match[2].toUpperCase()
  }

  const coords = await geocodeCity(cidade, uf, signal)
  if (!coords) {
    throw new Error(`Não foi possível obter coordenadas para ${cidade}/${uf}.`)
  }

  return { cidade, uf, lat: coords.lat, lng: coords.lng }
}

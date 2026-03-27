// ─── Types ────────────────────────────────────────────────────────────────────

export interface CidadeDB {
  cidade: string
  uf: string
  lat: number
  lng: number
  /** Lowercase, accent-stripped version of `cidade` for fast fuzzy search. */
  normalized: string
}

/** Minimum number of characters required to start a city search. */
export const MIN_CITY_SEARCH_LENGTH = 2

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalizes a string for accent-insensitive, case-insensitive comparison.
 * e.g. "Goiânia" → "goiania", "BRASÍLIA" → "brasilia"
 */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// ─── Database ─────────────────────────────────────────────────────────────────

function c(cidade: string, uf: string, lat: number, lng: number): CidadeDB {
  return { cidade, uf, lat, lng, normalized: normalize(cidade) }
}

export const CIDADES_DB: CidadeDB[] = [
  // ── Distrito Federal ──────────────────────────────────────────────────────
  c('Brasília', 'DF', -15.7801, -47.9292),

  // ── Goiás — principais municípios ─────────────────────────────────────────
  c('Goiânia', 'GO', -16.6869, -49.2648),
  c('Anápolis', 'GO', -16.3281, -48.9529),
  c('Aparecida de Goiânia', 'GO', -16.8229, -49.2443),
  c('Rio Verde', 'GO', -17.7997, -50.9278),
  c('Luziânia', 'GO', -16.2564, -47.9558),
  c('Valparaíso de Goiás', 'GO', -16.0756, -47.9936),
  c('Trindade', 'GO', -16.6508, -49.4885),
  c('Formosa', 'GO', -15.5381, -47.3353),
  c('Novo Gama', 'GO', -16.0556, -48.0347),
  c('Planaltina', 'GO', -15.4535, -47.6142),
  c('Senador Canedo', 'GO', -16.7081, -49.0959),
  c('Caldas Novas', 'GO', -17.7430, -48.6252),
  c('Jataí', 'GO', -17.8795, -51.7135),
  c('Itumbiara', 'GO', -18.4190, -49.2138),
  c('Catalão', 'GO', -18.1668, -47.9444),
  c('Mineiros', 'GO', -17.5695, -52.5497),
  c('Inhumas', 'GO', -16.3631, -49.4927),
  c('Paraúna', 'GO', -16.9483, -50.4499),
  c('Goiás', 'GO', -15.9319, -50.1411),
  c('Santa Helena de Goiás', 'GO', -17.8122, -50.5990),
  c('Itaberaí', 'GO', -16.0193, -49.8124),
  c('Nerópolis', 'GO', -16.3952, -49.2127),

  // ── Capitais e grandes cidades — outros estados ───────────────────────────
  // Minas Gerais
  c('Belo Horizonte', 'MG', -19.9167, -43.9345),
  c('Uberlândia', 'MG', -18.9188, -48.2773),
  c('Contagem', 'MG', -19.9317, -44.0536),
  c('Juiz de Fora', 'MG', -21.7610, -43.3503),
  c('Montes Claros', 'MG', -16.7278, -43.8625),
  c('Uberaba', 'MG', -19.7481, -47.9322),

  // São Paulo
  c('São Paulo', 'SP', -23.5505, -46.6333),
  c('Campinas', 'SP', -22.9056, -47.0608),
  c('Santos', 'SP', -23.9618, -46.3322),
  c('Ribeirão Preto', 'SP', -21.1767, -47.8208),
  c('São Bernardo do Campo', 'SP', -23.6939, -46.5650),
  c('Osasco', 'SP', -23.5328, -46.7918),
  c('Guarulhos', 'SP', -23.4636, -46.5333),
  c('Sorocaba', 'SP', -23.5015, -47.4526),

  // Rio de Janeiro
  c('Rio de Janeiro', 'RJ', -22.9068, -43.1729),
  c('Niterói', 'RJ', -22.8832, -43.1036),
  c('Duque de Caxias', 'RJ', -22.7856, -43.3117),

  // Espírito Santo
  c('Vitória', 'ES', -20.3155, -40.3128),
  c('Vila Velha', 'ES', -20.3297, -40.2927),
  c('Serra', 'ES', -20.1289, -40.3078),
  c('Cachoeiro de Itapemirim', 'ES', -20.8492, -41.1133),

  // Bahia
  c('Salvador', 'BA', -12.9714, -38.5014),
  c('Feira de Santana', 'BA', -12.2669, -38.9669),
  c('Vitória da Conquista', 'BA', -14.8660, -40.8446),
  c('Camaçari', 'BA', -12.6981, -38.3247),

  // Pernambuco
  c('Recife', 'PE', -8.0476, -34.8770),
  c('Caruaru', 'PE', -8.2760, -35.9764),
  c('Petrolina', 'PE', -9.3978, -40.5016),

  // Ceará
  c('Fortaleza', 'CE', -3.7172, -38.5433),
  c('Caucaia', 'CE', -3.7374, -38.6534),
  c('Juazeiro do Norte', 'CE', -7.2133, -39.3156),

  // Rio Grande do Norte
  c('Natal', 'RN', -5.7945, -35.2110),
  c('Mossoró', 'RN', -5.1878, -37.3444),

  // Paraíba
  c('João Pessoa', 'PB', -7.1195, -34.8450),
  c('Campina Grande', 'PB', -7.2306, -35.8811),

  // Alagoas
  c('Maceió', 'AL', -9.6658, -35.7350),

  // Sergipe
  c('Aracaju', 'SE', -10.9472, -37.0731),

  // Piauí
  c('Teresina', 'PI', -5.0892, -42.8019),

  // Maranhão
  c('São Luís', 'MA', -2.5297, -44.3028),
  c('Imperatriz', 'MA', -5.5257, -47.4916),

  // Pará
  c('Belém', 'PA', -1.4558, -48.5044),
  c('Ananindeua', 'PA', -1.3656, -48.3725),
  c('Santarém', 'PA', -2.4426, -54.7082),

  // Amazonas
  c('Manaus', 'AM', -3.1190, -60.0217),

  // Tocantins
  c('Palmas', 'TO', -10.2491, -48.3243),
  c('Araguaína', 'TO', -7.1912, -48.2046),

  // Mato Grosso
  c('Cuiabá', 'MT', -15.6014, -56.0979),
  c('Várzea Grande', 'MT', -15.6467, -56.1322),
  c('Rondonópolis', 'MT', -16.4718, -54.6384),

  // Mato Grosso do Sul
  c('Campo Grande', 'MS', -20.4697, -54.6201),
  c('Dourados', 'MS', -22.2212, -54.8056),

  // Paraná
  c('Curitiba', 'PR', -25.4290, -49.2671),
  c('Londrina', 'PR', -23.3100, -51.1629),
  c('Maringá', 'PR', -23.4273, -51.9375),
  c('Foz do Iguaçu', 'PR', -25.5162, -54.5854),

  // Santa Catarina
  c('Florianópolis', 'SC', -27.5954, -48.5480),
  c('Joinville', 'SC', -26.3044, -48.8487),
  c('Blumenau', 'SC', -26.9195, -49.0661),

  // Rio Grande do Sul
  c('Porto Alegre', 'RS', -30.0346, -51.2177),
  c('Caxias do Sul', 'RS', -29.1681, -51.1794),
  c('Pelotas', 'RS', -31.7654, -52.3371),

  // Rondônia
  c('Porto Velho', 'RO', -8.7612, -63.9004),

  // Acre
  c('Rio Branco', 'AC', -9.9754, -67.8249),

  // Roraima
  c('Boa Vista', 'RR', 2.8235, -60.6758),

  // Amapá
  c('Macapá', 'AP', 0.0349, -51.0694),
]

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Searches the cities database by normalized name prefix/substring.
 * Returns up to `maxResults` matching cities.
 */
export function searchCidades(query: string, maxResults = 8): CidadeDB[] {
  const q = normalize(query.trim())
  if (!q || q.length < MIN_CITY_SEARCH_LENGTH) return []
  return CIDADES_DB.filter((entry) => entry.normalized.includes(q)).slice(0, maxResults)
}

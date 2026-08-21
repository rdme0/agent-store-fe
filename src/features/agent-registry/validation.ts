export type FieldErrors = Record<string, string>

export interface VersionFormValues {
  semver: string
  endpoint: string
  priceAtomic: string
  network: string
  asset: string
  payTo: string
  responseFormat?: import('../../entities/agent/model').AgentResponseFormat
}

const USDC_DECIMALS = 6
const USDC_AMOUNT_PATTERN = /^\d+(?:\.\d{1,6})?$/

/** Converts a human-readable USDC amount to the API's six-decimal atomic string without floats. */
export function usdcToAtomic(value: string): string | undefined {
  const trimmed = value.trim()
  if (!USDC_AMOUNT_PATTERN.test(trimmed)) return undefined

  const [whole, fraction = ''] = trimmed.split('.')
  const atomic = `${whole}${fraction.padEnd(USDC_DECIMALS, '0')}`.replace(/^0+(?=\d)/, '')
  return atomic || '0'
}

export function validateUsdcAmount(value: string): string | undefined {
  if (!value.trim()) return '호출 가격을 입력하세요.'
  if (!USDC_AMOUNT_PATTERN.test(value.trim())) return 'USDC 가격은 소수점 여섯 자리까지 입력할 수 있습니다. 예: 0.01'
  if (usdcToAtomic(value) === '0') return '호출 가격은 0보다 커야 합니다.'
  return undefined
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SEMVER_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+(?:[0-9A-Za-z-]+)(?:\.[0-9A-Za-z-]+)*)?$/
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

function required(value: string, label: string, errors: FieldErrors, key: string) {
  if (!value.trim()) {
    errors[key] = `${label}을(를) 입력하세요.`
  }
}

function bounded(
  value: string,
  label: string,
  key: string,
  min: number,
  max: number,
  errors: FieldErrors,
) {
  if (value.length < min || value.length > max) {
    errors[key] = `${label}은(는) ${min}~${max}자여야 합니다.`
  }
}

export function validateVersion(values: VersionFormValues): FieldErrors {
  const errors: FieldErrors = {}
  required(values.semver, 'SemVer', errors, 'semver')
  required(values.endpoint, 'Endpoint', errors, 'endpoint')
  required(values.priceAtomic, '가격', errors, 'priceAtomic')
  required(values.network, 'Network', errors, 'network')
  required(values.asset, 'Asset', errors, 'asset')
  required(values.payTo, 'PayTo wallet', errors, 'payTo')

  bounded(values.semver, 'SemVer', 'semver', 1, 32, errors)
  bounded(values.endpoint, 'Endpoint', 'endpoint', 1, 2048, errors)
  bounded(values.network, 'Network', 'network', 1, 128, errors)
  bounded(values.asset, 'Asset', 'asset', 1, 128, errors)
  bounded(values.payTo, 'PayTo wallet', 'payTo', 1, 128, errors)

  if (values.priceAtomic && !/^\d+$/.test(values.priceAtomic)) {
    errors.priceAtomic = '가격은 소수점 없는 atomic string이어야 합니다.'
  }
  if (values.semver && !SEMVER_PATTERN.test(values.semver)) {
    errors.semver = 'SemVer는 유효한 semantic version이어야 합니다. 예: 1.0.0'
  }
  if (values.endpoint) {
    let endpoint: URL | undefined
    try {
      endpoint = new URL(values.endpoint)
    } catch {
      // The shared message below also covers malformed URL values.
    }
    if (!endpoint || (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:')) {
      errors.endpoint = 'Endpoint는 유효한 http:// 또는 https:// URL이어야 합니다.'
    }
  }
  if (values.payTo && !EVM_ADDRESS_PATTERN.test(values.payTo)) {
    errors.payTo = 'PayTo wallet은 0x로 시작하는 EVM 주소여야 합니다.'
  }
  if (values.network.trim().length === 0 || values.asset.trim().length === 0) {
    errors.network = values.network.trim().length === 0 ? 'Network를 입력하세요.' : errors.network
    errors.asset = values.asset.trim().length === 0 ? 'Asset을 입력하세요.' : errors.asset
  }
  return errors
}

export function validateAgent(
  values: VersionFormValues & {
    developerId: string
    slug: string
    name: string
    description: string
  },
): FieldErrors {
  const errors = validateVersion(values)
  required(values.developerId, 'Developer ID', errors, 'developerId')
  required(values.slug, 'Slug', errors, 'slug')
  required(values.name, '이름', errors, 'name')
  required(values.description, '설명', errors, 'description')

  bounded(values.slug, 'Slug', 'slug', 1, 80, errors)
  bounded(values.name, '이름', 'name', 1, 120, errors)
  bounded(values.description, '설명', 'description', 1, 2000, errors)

  if (values.developerId && !UUID_PATTERN.test(values.developerId)) {
    errors.developerId = 'Developer ID는 UUID 형식이어야 합니다.'
  }
  if (values.slug && !SLUG_PATTERN.test(values.slug)) {
    errors.slug = 'Slug는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.'
  }
  return errors
}

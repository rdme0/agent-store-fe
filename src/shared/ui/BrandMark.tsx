interface BrandMarkProps {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span aria-hidden="true" className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'}>
      <svg fill="none" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 9.5C12 9.5 13.5 20 21 20H35" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M5 20C12 20 13.5 20 21 20H35" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <path d="M5 30.5C12 30.5 13.5 20 21 20H35" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        <circle cx="31.5" cy="20" fill="currentColor" r="4.5" />
      </svg>
    </span>
  )
}

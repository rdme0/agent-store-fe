import type { ReactNode } from 'react'

interface PagePlaceholderProps {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}

export function PagePlaceholder({
  children,
  description,
  eyebrow,
  title,
}: PagePlaceholderProps) {
  return (
    <section className="page-placeholder" aria-labelledby="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="page-title">{title}</h1>
      <p className="page-placeholder__description">{description}</p>
      {children}
    </section>
  )
}

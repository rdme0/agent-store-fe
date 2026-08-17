import { Link } from 'react-router-dom'
import { PagePlaceholder } from './PagePlaceholder'

export function NotFoundPage() {
  return (
    <PagePlaceholder
      eyebrow="404"
      title="Page not found"
      description="The page you are looking for does not exist in this workspace."
    >
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </PagePlaceholder>
  )
}

import { Link } from 'react-router-dom'
import { PagePlaceholder } from './PagePlaceholder'

export function NotFoundPage() {
  return (
    <PagePlaceholder
      eyebrow="404"
      title="요청한 페이지를 찾을 수 없습니다"
      description="주소가 변경되었거나 존재하지 않는 페이지입니다. Marketplace에서 다시 시작해 주세요."
    >
      <Link className="button button--primary" to="/marketplace">
        Marketplace로 돌아가기
      </Link>
    </PagePlaceholder>
  )
}

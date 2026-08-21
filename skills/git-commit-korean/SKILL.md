---
name: git-commit-korean
description: Inspect AgentStore git state and create small Korean commits matching the repository's logical change boundaries.
---

# Git Commit Korean

- 커밋 전 `git status --short`, staged/unstaged diff, 최근 log를 확인한다.
- build/config, 공통 web 기반, domain, 테스트, 문서는 가능한 작은 단위로 분리한다.
- 커밋 제목은 짧은 한국어 한 줄로 작성하고 `:hammer: build:`, `:sparkles: feat:`, `:white_check_mark: test:`, `:memo: docs:` 등 구체적인 type을 사용한다.
- 사용자 dirty path는 staging하거나 되돌리지 않는다.
- 사용자가 명시적으로 요청하지 않으면 commit, amend, rebase, push하지 않는다.

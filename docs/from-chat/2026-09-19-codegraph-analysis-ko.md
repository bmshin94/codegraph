# CodeGraph 전수조사 & 활용 전략 정리

> 작성일: 2026-09-19
> 대화 정리 문서 (한국어)

## 📎 저장소 주소

| 구분 | 주소 |
|---|---|
| **이 저장소 (포크)** | https://github.com/bmshin94/codegraph |
| **원본 (upstream)** | https://github.com/colbymchenry/codegraph |
| **npm 패키지** | https://www.npmjs.com/package/@colbymchenry/codegraph |
| **공식 문서 사이트** | https://colbymchenry.github.io/codegraph/ |
| **상용 서비스 대기자 명단** | https://getcodegraph.com |
| **X (트위터)** | https://x.com/getcodegraph |

---

## 1. CodeGraph란 무엇인가

**한 줄 요약**: AI 코딩 에이전트(Claude Code, Cursor 등)에게 달아주는 "코드베이스 내비게이션 시스템".

코드 전체를 미리 파싱해 "어떤 함수가 어떤 함수를 부르는지"를 그래프로 만들어 SQLite에 저장하고,
AI가 grep/파일읽기로 헤매는 대신 한 번의 호출로 정답 코드를 가져가게 해준다.

| 항목 | 값 |
|---|---|
| 패키지명 | `@colbymchenry/codegraph` |
| 버전 | 1.6.0 |
| 라이선스 | **MIT** (상업적 이용 가능) |
| 소스 규모 | TypeScript 약 113,700줄 |
| 테스트 | 274개 (실제 SQLite 사용, DB 모킹 없음) |
| 특징 | 100% 로컬 · API 키 불필요 · 외부 전송 없음 |

### 해결하는 문제

AI 에이전트는 코드 구조를 파악할 때 grep → glob → Read를 반복하며 호출 경로를 손으로 재구성한다.
이 과정에서 토큰이 폭발하고 시간이 낭비되며 컨텍스트 창이 가득 찬다.

CodeGraph는 미리 만들어진 지식 그래프에서 필요한 심볼의 소스, 호출 경로, 영향 범위를 한 번에 반환한다.

### 벤치마크 (7개 오픈소스 레포, 각 arm 4회 중앙값)

| 레포 | 도구 호출 | 속도 | 파일 읽기 | 비용 |
|---|---|---|---|---|
| VS Code (~11k 파일) | 2 vs 28 | 2.2× 빠름 | 0 vs 12 | 71% 절감 |
| Excalidraw (~640) | 2 vs 43 | 3.6× 빠름 | 0 vs 18 | 78% 절감 |
| Django (~3k) | 3 vs 14 | 35% 빠름 | 0 vs 8.5 | 13% 절감 |
| Tokio (~790) | 3 vs 29 | 2.6× 빠름 | 0 vs 19 | 64% 절감 |
| OkHttp (~645) | 1 vs 6 | 43% 빠름 | 0 vs 2 | 21% 절감 |
| Gin (~110) | 1 vs 7 | 39% 빠름 | 0 vs 4 | ~동일 |
| Alamofire (~110) | 4 vs 33 | 2.6× 빠름 | 0 vs 16.5 | 57% 절감 |

**평균: 도구 호출 88% 감소 · 53% 빠름 · 토큰 62% 절감 · 비용 44% 절감**

> ⚠️ 정직한 트레이드오프: 세션 종료 시점의 **컨텍스트 잔류량은 오히려 약 80% 더 많다**
> (VS Code 기준 67k vs 18k 토큰). 한 번에 큰 덩어리를 주기 때문. 작은 컨텍스트 창으로
> 긴 세션을 돌린다면 감안해야 한다.

---

## 2. 폴더 구조 전수조사

### 핵심 엔진 — `src/`

| 폴더 | 파일 수 | 역할 |
|---|---|---|
| `src/extraction/` | 84 | tree-sitter 파싱 · 언어별 추출기 28종 |
| `src/resolution/` | 60 | 심볼 연결 · import 해석 · 프레임워크 라우팅 인식 |
| `src/ui-server/` | 34 | 브라우저 뷰어용 읽기전용 JSON API |
| `src/mcp/` | 24 | MCP 서버 · 데몬 · 워커풀 · 세션 관리 |
| `src/installer/` | 20 | 에이전트 9종 자동 설치 |
| `src/graph/` | 9 | 그래프 탐색 · 영향범위 · 데드코드 탐지 |
| `src/db/` | 6 | SQLite (node:sqlite, WAL + FTS5) |
| `src/bin/` | 5 | CLI 진입점 (commander) |
| `src/sync/` | 5 | 파일 감시 (FSEvents/inotify/RDCW) |
| `src/ui/` | 5 | 터미널 UI |
| `src/upgrade/` | 3 | 자동 업데이트 |
| `src/context/` | 3 | 컨텍스트 빌더 (markdown/JSON) |
| `src/search/` | 4 | FTS5 전문 검색 |

### 서브 프로젝트

| 폴더 | 내용 |
|---|---|
| `codegraph-kernel/` | Rust 네이티브 파싱 커널 (20개 언어, tree-sitter 문법 C소스 내장) |
| `ui/` | Svelte 브라우저 뷰어 (`private: true` — Pro 앱용으로 비공개) |
| `site/` | Astro 문서 사이트 |
| `telemetry-worker/` | Cloudflare Workers 익명 통계 수집기 (수집 코드 공개) |
| `telemetry-dashboard/` | 통계 대시보드 |
| `docs/design/` | 설계 문서 30개+ |
| `docs/benchmarks/` | A/B 테스트 결과 기록 |
| `__tests__/` | 테스트 274개 (vitest, engine/ui 2개 프로젝트) |

---

## 3. 동작 원리

```
1. 추출(Extraction)  → Rust 커널 + tree-sitter 파싱
                       노드 23종: function/class/method/route/component...
                       엣지 12종: calls/imports/extends/implements/references...
         ↓
2. 저장(Storage)     → .codegraph/codegraph.db (SQLite + FTS5)
         ↓
3. 해석(Resolution)  → 호출→정의, import→파일, 프레임워크 라우팅
         ↓
4. 자동동기화        → 파일 저장 감지 → 2초 디바운스 → 증분 갱신
```

### 킬러 기능: 동적 디스패치 브릿징

grep으로는 따라갈 수 없는 연결을 합성 엣지로 잇는다.

| 끊기는 지점 | 잇는 방법 |
|---|---|
| 콜백 / 옵저버 | 등록 위치 → 실행 위치 |
| React `setState` → 리렌더 | `react-render` 합성 엣지 |
| React 컴포넌트 → 자식 | `jsx-child` 엣지 |
| React Native 네이티브 ↔ JS | `sendEvent` → `addListener` 핸들러 |
| Swift ↔ Objective-C | `@objc` 자동 브릿징 규칙 |
| EventEmitter / 메시지 큐 | 발행 → 구독자 |
| 라우터 화면 이동 | `navigates` 엣지 |

설계 철학: **"부분 커버리지는 아예 없는 것보다 나쁘다"**
한 홉만 잇고 다음 홉을 못 이으면 에이전트가 거기서 다시 파일을 읽기 시작하므로,
끝까지 잇거나 아예 잇지 않는다.

---

## 4. 언제 쓰는가

### 효과가 큰 상황
1. 대형 레포 (수천~수만 파일) — 클수록 이득 증가
2. "이게 어디서 어디로 흘러가나" 류의 흐름 질문
3. 레거시 코드 파악 / 신규 입사자 온보딩
4. 리팩터링 전 영향도 분석 (`codegraph impact`)
5. CI 최적화 (`codegraph affected`로 영향받는 테스트만 실행)
6. 다중 언어 프로젝트 (Swift + React Native 등)

### 효과가 적은 상황
- 파일 몇 개짜리 소규모 프로젝트
- 단일 파일 수정 작업
- 자연어 의미 검색 (구조 기반이지 의미 기반이 아님 — 벡터DB 영역)

---

## 5. 설치 및 사용법

### 설치 (3단계)

```bash
# 1. CLI 설치 (Node.js 불필요 — 런타임 내장)
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# Windows: irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
# Node 있으면: npm i -g @colbymchenry/codegraph

# 2. 에이전트 연결 (새 터미널에서)
codegraph install

# 3. 프로젝트 인덱싱
cd 내프로젝트 && codegraph init

# 4. 없음 — 자동 동기화
```

### 주요 CLI 명령

```bash
codegraph explore "user authentication flow"   # 관련 소스 + 호출경로 한 번에
codegraph node UserService                     # 심볼 소스 + 호출자
codegraph query "login" --kind function        # 심볼 검색
codegraph callers formatPrice                  # 호출하는 쪽
codegraph callees processPayment               # 호출당하는 쪽
codegraph impact UserModel --depth 3           # 변경 영향 범위
codegraph affected src/auth.ts                 # 영향받는 테스트 파일
codegraph files --format tree                  # 파일 구조
codegraph status                               # 통계 + 동기화 상태
codegraph upgrade / uninstall / uninit
```

대부분 `--json` 플래그 지원 → 외부 도구 연동 용이.

### 라이브러리 임베딩

```typescript
import CodeGraph from '@colbymchenry/codegraph';

const cg = await CodeGraph.init('/path/to/project');
await cg.indexAll({ onProgress: p => console.log(`${p.phase}: ${p.current}/${p.total}`) });

const results = cg.searchNodes('UserService');
const callers = cg.getCallers(results[0].node.id);
const impact  = cg.getImpactRadius(results[0].node.id, 2);
const context = await cg.buildContext('fix login bug', {
  maxNodes: 20, includeCode: true, format: 'markdown'
});

cg.watch();
cg.close();
```

> 임베딩 시 Node 22.5+ 필요 (`node:sqlite` 내장 모듈). CLI/MCP 서버는 런타임 번들이라 무관.

### 설정 (`codegraph.json`, 선택)

```json
{
  "exclude": ["static/", "**/vendor/**"],
  "include": ["Tools/"],
  "deprioritize": ["scripts/"],
  "extensions": { ".tpl": "php", ".dota_lua": "lua" }
}
```

주요 환경변수: `CODEGRAPH_MCP_TOOLS`, `CODEGRAPH_WATCH_DEBOUNCE_MS`,
`CODEGRAPH_NO_DAEMON`, `CODEGRAPH_TELEMETRY`, `DO_NOT_TRACK`

---

## 6. 플러그인 / 스킬 / MCP — 무엇인가

**정답: MCP 서버.** 정확히는 CLI + 라이브러리 + MCP 서버 3-in-1 (같은 바이너리).

| | MCP | 플러그인 | 스킬 |
|---|---|---|---|
| 정체 | AI ↔ 외부시스템 표준 프로토콜 | 특정 앱 전용 확장 | AI 지침 문서(Markdown) |
| 형태 | 별도 프로세스 | 앱 내부 모듈 | `.md` 파일 |
| 역할 | 실제 도구 실행 | 앱마다 다름 | 행동 가이드만 |
| 범용성 | Claude/Cursor/Codex/Copilot 전부 | 해당 앱만 | 해당 AI만 |
| CodeGraph | ✅ | ❌ | ❌ |

`codegraph install`이 각 에이전트 설정에 MCP 서버 항목을 써넣는다:
- Claude Code → `~/.claude.json`의 `mcpServers.codegraph`
- Cursor → `.cursor/mcp.json` (cwd 버그 때문에 `--path` 강제 주입)
- Codex → `~/.codex/config.toml`의 `[mcp_servers.codegraph]`
- opencode → `opencode.jsonc`의 `mcp.servers.codegraph`

### 노출 도구

기본은 **`codegraph_explore` 하나만** 노출.
나머지 7개(`node`, `search`, `callers`, `callees`, `impact`, `files`, `status`)는 숨김.
`CODEGRAPH_MCP_TOOLS=explore,node,search`로 재활성화 가능.

이유(설계 문서):
> "측정 결과 강력한 도구 하나가 좁은 도구 메뉴보다 에이전트를 더 잘 유도한다 —
> 오선택이 줄고 매 세션 컨텍스트를 아낀다"

---

## 7. API 토큰 — 불필요

| 항목 | 상태 |
|---|---|
| CodeGraph 자체 API 키 | 없음 |
| OpenAI/Anthropic 키 | 없음 (LLM 미사용) |
| 회원가입 | 없음 |
| 인터넷 연결 | 설치/업그레이드 때만 |
| 코드 외부 전송 | 없음 |

추출이 **결정론적(deterministic)** — AST에서 기계적으로 뽑으므로 LLM이 필요 없고 환각도 없다.

유일하게 나가는 것: 익명 텔레메트리 (명령어/도구 사용 여부, 인덱싱한 언어).
코드·경로·파일명·심볼명·쿼리·IP는 절대 전송하지 않으며, 수집 서버 코드가 `telemetry-worker/`에 공개돼 있다.
끄기: `codegraph telemetry off` 또는 `CODEGRAPH_TELEMETRY=0` / `DO_NOT_TRACK=1`

---

## 8. 왜 GitHub에서 유명한가

1. **타이밍** — AI 코딩 에이전트 대중화 시점에 모두가 겪는 공통 고통을 정확히 타격
2. **숫자로 증명** — 방법론까지 공개. 양쪽 arm 모두 CLI 차단(대조군 오염 방지),
   과거 자사 수치까지 정정
3. **단점을 먼저 공개** — 컨텍스트 잔류량 80% 증가를 README에 표까지 만들어 게재
4. **진입장벽 0** — Node 불필요, 네이티브 빌드 불필요, 설정 불필요
5. **100% 로컬** — 보안팀 승인 불필요 → 기업 도입 장벽 제거
6. **언어 30개+** — COBOL, Pascal/Delphi, VB.NET, CFML 등 롱테일까지
7. **에이전트 9종 지원** — 어떤 에이전트를 쓰든 해당됨
8. **엔지니어링 품질** — 테스트 274개, 설계문서 30개+, npm trusted publishing(OIDC) + provenance

---

## 9. 로컬 에이전트 구축에 도움이 되는가 — 3가지 층위

### 층위 1: 부품으로 사용 (가장 실용적)

```typescript
class MyLocalAgent {
  async answerQuestion(q: string) {
    const ctx = await this.cg.buildContext(q, { maxNodes: 20, includeCode: true, format: 'markdown' });
    return await this.llm.chat(`${ctx}\n\n질문: ${q}`);   // Ollama / llama.cpp
  }
}
```

로컬 LLM은 컨텍스트 창이 작고(8k~32k) 긴 컨텍스트에서 성능이 급락하므로,
"딱 필요한 20개 심볼만" 골라주는 CodeGraph의 효과가 **클라우드 모델보다 더 크다.**

### 층위 2: 아키텍처 교과서

`AGENTS.md`에 담긴 교훈들:

| 교훈 | 내용 |
|---|---|
| 에러는 포기를 가르친다 | 세션 초반 `isError` 한두 번이면 에이전트가 그 도구를 아예 안 쓴다 → 정상적 실패는 성공 모양 + 안내문으로 반환 |
| 도구는 적을수록 좋다 | 8개 → 1개로 줄여 오선택 제거 |
| 에이전트를 바꾸려 하지 말고 도구를 맞춰라 | 프롬프트로 에이전트 행동을 바꾸려는 시도는 전부 실패 (실험 기록 있음) |
| 충분성(Sufficiency) | 답이 불충분한 순간 에이전트는 즉시 Read/Grep으로 회귀 |
| 부분 커버리지 < 무 커버리지 | 흐름을 절반만 이으면 오히려 더 나쁨 |
| 출력 예산은 레포 크기에 비례 | 큰 티어가 작은 티어보다 적게 주면 안 됨 |

### 층위 3: 코드 참고/포크

| 만들 것 | 참고할 곳 |
|---|---|
| MCP 서버 (데몬, 워커풀, stdio) | `src/mcp/` |
| 멀티 에이전트 설치기 | `src/installer/` (새 에이전트 = 파일 1개 + 등록 1줄) |
| 코드 파서 | `src/extraction/languages/` (28개 예제) |
| 그래프 탐색/영향분석 | `src/graph/` |
| 파일 감시 + 증분 동기화 | `src/sync/` |
| 그래프 시각화 | `ui/` + `src/ui-server/` |

### 한계

| 못 하는 것 | 대안 |
|---|---|
| 의미 기반 검색 | 벡터DB/임베딩 병행 (하이브리드) |
| 주석/문서 이해 | LLM 담당 |
| 리액티브 런타임 흐름 (MediatR, Vue Proxy) | 설계문서에서 미해결("the frontier")로 인정 |
| 런타임 동작 | 정적 분석의 근본 한계 |

---

## 10. React / PHP로 만들 수 있는가

### A. React/PHP 코드베이스를 분석할 수 있는가 — 가능 (최상위 지원)

- **React (TS/JS)**: Rust 커널 네이티브 파싱. `setState`→리렌더, JSX 부모→자식,
  Zustand 객체 리터럴 액션 추출, React Router / Next.js / TanStack / Expo Router 화면 이동 추적
- **PHP**: Rust 커널 네이티브 파싱. Laravel(`Route::get()`, `Controller@action`),
  Drupal(`*.routing.yml`, `hook_*`). `.tpl` 등 커스텀 확장자 매핑 가능

### B. React/PHP로 CodeGraph 같은 엔진을 만들 수 있는가

- **React**: UI는 적합, 엔진은 부적합 (브라우저 라이브러리). 단 Node.js로는 가능 —
  CodeGraph 본체가 TypeScript
- **PHP**: 기술적으로 가능하나 비추천 (tree-sitter 바인딩 빈약, 대규모 파싱 성능,
  공식 MCP SDK 없음, 네이티브 FS 이벤트 약함). 웹 대시보드/API 껍데기로는 적합

### C. React/PHP 스택으로 제품을 만들 수 있는가 — 최적의 조합

```
🎨 React (+Next.js)  : 대시보드 · 그래프 시각화 (react-flow, d3, cytoscape)
        ↓ REST / GraphQL
🐘 PHP(Laravel) / Node : 인증 · 결제 · 팀관리
        ↓ 프로세스 실행 or JSON
⚙️  CodeGraph          : 엔진 (그대로 사용)
```

연동 방법 2가지:
1. CLI 프로세스 호출 — `shell_exec('codegraph impact UserModel --json')` (PHP/어디서든)
2. Node 라이브러리 임베딩 — `cg.getImpactRadius(nodeId, 2)` (더 빠름)

---

## 11. 수익화 아이디어

### 법적 체크 (MIT 라이선스)

**가능**: 상업적 이용 · 수정 · 재배포 · 비공개 소스화 · 서브라이선스

**반드시 지킬 것**:
1. 저작권 고지 + MIT 라이선스 전문 포함
2. "CodeGraph" 상표 사용 회피 — 별도 브랜드명 사용
3. `@colbymchenry/codegraph` 그대로 재배포 금지
4. 보증 없음(AS-IS) — SLA 약속 시 본인 책임

> 가장 안전한 방법: 포크·리네이밍 대신 **npm 의존성으로 설치해서 사용**하고
> 그 위에 제품을 얹기. 업스트림 업데이트도 자동으로 받는다.

### 시장 신호

README 최상단:
> "The CodeGraph platform is coming — for every PR, know exactly what to test,
> what could break, which flows are affected, and whether business logic is compromised."

원작자도 "PR 영향도 분석 SaaS"로 향하고 있다 = **시장 검증 완료**.
그리고 `ui/`가 `private: true`로 막혀있다 = Pro 앱용으로 아껴둔 빈 자리.

### 아이디어 10선

| # | 아이디어 | 난이도 | 수익 잠재력 | 비고 |
|---|---|---|---|---|
| 1 | **AI PR 영향도 리뷰 봇 SaaS** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 원작자와 정면충돌 — 틈새 차별화 필요 |
| 2 | **레거시 온보딩 컨설팅 + 툴** | ⭐⭐ | ⭐⭐⭐⭐⭐ | COBOL/Delphi, 경쟁 거의 없음 |
| 3 | **코드베이스 헬스 대시보드 (React)** | ⭐⭐⭐ | ⭐⭐⭐ | `src/ui-server/` API 이미 존재 |
| 4 | **CI 테스트 최적화 SaaS** | ⭐⭐ | ⭐⭐⭐⭐ | ROI 증명이 가장 쉬움 |
| 5 | **한국 시장 특화 로컬라이즈** | ⭐ | ⭐⭐⭐ | 자본 0, 부업으로 시작 가능 |
| 6 | **폐쇄망 오프라인 AI 어시스턴트** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 금융/국방/의료/공공 |
| 7 | **VS Code / JetBrains 유료 확장** | ⭐⭐⭐ | ⭐⭐⭐ | IDE 확장은 아직 없음 |
| 8 | **코드 문서 자동 생성 SaaS** | ⭐⭐⭐ | ⭐⭐⭐ | 그래프 + LLM 조합 |
| 9 | **기술 콘텐츠 / 교육** | ⭐ | ⭐⭐⭐ | 자본 0, 즉시 시작 가능 |
| 10 | **독자 오픈소스 → 인수/투자** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 장기 전략 |

### 상세 — 아이디어 1: AI PR 영향도 리뷰 봇

GitHub App으로 PR마다 자동 분석 댓글:
- 변경된 심볼 목록
- 영향받는 코드 N곳 (홉 거리 포함)
- 꼭 돌려야 할 테스트 목록
- 위험 신호 (테스트 커버리지 없는 영향권, 결제 흐름 근접 등)

```
GitHub Webhook → 큐 → 워커(clone + index)
  → codegraph affected + impact --json → 리포트 → PR 댓글 API
```

가격: Free $0 / Team $15·개발자·월 / Enterprise $50·개발자·월
시뮬레이션: 고객사 30곳 × 20명 × $15 = **월 $9,000 (연 $108K)**

### 상세 — 아이디어 2: 레거시 온보딩 컨설팅 (추천 1순위)

CodeGraph는 COBOL, Pascal/Delphi, VB.NET, CFML, Erlang을 지원한다.
이 시장의 특징: 예산 많음(금융·공공·제조) · 고통 심함(원 개발자 퇴사, 문서 없음) ·
경쟁 없음 · 한국에 특히 많음(코어뱅킹, 보험, 공공기관).

| 상품 | 가격 |
|---|---|
| 1회 진단 (코드 지도 + 데드코드 + 의존성 리포트) | 300~1,000만원 |
| 온보딩 패키지 (진단 + 교육 + 문서화) | 2,000~5,000만원 |
| 툴 라이선스 (온프레미스, 연간) | 1,000만원/년 |
| 마이그레이션 컨설팅 | 5,000만원+ |

시뮬레이션: 대형 3건 × 3,000만원 + 라이선스 5곳 × 1,000만원 = **연 1.4억**

추천 이유: 툴은 무료(마진 높음) · 경쟁 거의 없음 · 코드를 짜지 않아도 시작 가능 ·
여기서 번 돈으로 SaaS 개발 가능.

### 상세 — 아이디어 3: 코드베이스 헬스 대시보드 (React 스택 적합)

`src/ui-server/`가 이미 읽기전용 JSON API를 제공한다:
`/api/node`, `/api/flow`, `/api/map`, `/api/screens`, `/api/steps`,
`/api/deadcode`, `/api/trails`, `/api/program`, `/api/effects`

기본 뷰어가 Svelte이므로 **React 버전은 빈 자리**.

화면 구성: 헬스 스코어 · 인터랙티브 의존성 그래프 · 데드코드 목록 ·
순환 의존성 · 갓 파일 경고 · API 엔드포인트 목록 · 화면 흐름도 · 주간 추이

가격: Solo $9/월 · Team $49/월 · Enterprise $299/월(온프레미스)

### 상세 — 아이디어 4: CI 테스트 최적화

```bash
git diff --name-only HEAD~1 | codegraph affected --stdin --quiet
```
테스트 시간 80~95% 단축. 가치 제안이 명확하다:

```
현재: GitHub Actions 월 $800 (전체 40분 × 200 PR)
도입: 월 $150 (영향 테스트 3분 × 200 PR)
절감: 월 $650 → 서비스 $200 받아도 고객은 $450 이득
```

형태: GitHub Action 마켓플레이스 · Jenkins/GitLab CI 플러그인 · 절감액 리포트 대시보드

---

## 12. 단계별 로드맵

### Phase 1 (0~3개월) — 자본 0, 리스크 0
- 한국어 콘텐츠(블로그/유튜브)로 개인 브랜딩 + 리드 확보
- CodeGraph 직접 사용하며 노하우 축적
- 아이디어 5(한국 로컬라이즈)를 부업으로 시작

### Phase 2 (3~9개월) — 첫 제품
- 아이디어 3(React 헬스 대시보드) MVP 출시
  → 보유 스택(React) 그대로 사용, `src/ui-server/` API 이미 존재
- 병행: 아이디어 2(레거시 컨설팅) 영업 — 1건만 성사돼도 3,000만원

### Phase 3 (9~24개월) — 스케일
- 아이디어 1(PR 봇) 또는 4(CI 최적화)로 본격 SaaS
- 아이디어 6(폐쇄망 AI)으로 엔터프라이즈 진입

### 하나만 고른다면: 아이디어 2 (레거시 온보딩 컨설팅)

첫 스텝:
1. 오픈소스 COBOL/Delphi 레포 하나를 인덱싱해 리포트 샘플 제작
2. 그 리포트로 랜딩 페이지 1장 제작 (React)
3. 링크드인/채용공고에서 "레거시 현대화" 검색 → 담당자 컨택

---

## 부록: 지원 범위 요약

### 지원 언어 (30개+)
TypeScript, JavaScript, ArkTS, Python, Go, Rust, Java, C#, VB.NET, PHP, Ruby,
C, C++, CUDA, Objective-C, Metal, Swift, Kotlin, Scala, Dart, Lua, Luau, R,
Nix, Erlang, CFML, COBOL, Solidity, Terraform/OpenTofu, Svelte, Vue, Astro,
Liquid, Pascal/Delphi

### 지원 에이전트 (9종)
Claude Code · Cursor · Codex CLI · opencode · Hermes Agent · Gemini CLI ·
Antigravity IDE · Kiro · GitHub Copilot (VS Code / CLI / JetBrains)

### 프레임워크 라우트 인식 (17개+)
Django · Flask · FastAPI · Express · NestJS · Laravel · Drupal · Rails ·
Spring · Play · Gin/chi/gorilla/mux · Axum/actix/Rocket · ASP.NET · Vapor · Astro

### 라우터 네비게이션 추적 (`navigates` 엣지)
Expo Router · Next.js · React Router · TanStack Router · Vue Router/Nuxt · SvelteKit

### 노드 종류 (23)
file, module, class, struct, interface, trait, protocol, function, method,
property, field, variable, constant, enum, enum_member, type_alias, namespace,
parameter, import, export, route, component, union

### 엣지 종류 (12)
contains, calls, imports, exports, extends, implements, references,
type_of, returns, instantiates, overrides, decorates

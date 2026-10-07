# Atelier Stories ✳

전시를 준비하는 작가가 작품을 올리고, 그림 속 사물을 선택해 이야기를 붙이고, 자신만의 웹사이트를 공개하는 플랫폼의 첫 실행 버전입니다.

서버 설치 전에 [관람객 미리보기](docs/preview.html)를 브라우저로 열어 메뉴, 언어 전환, 작품 속 이야기를 살펴볼 수 있습니다. 이 파일은 관람객 화면만 보여주며 편집과 저장에는 서버가 필요합니다.

가입하면 가상 작가 ‘하린’의 샘플 전시가 만들어집니다. 작품과 전시 정보는 모두 예시입니다. `http://localhost:3000`에서 관람객 샘플을, `/app`에서 작가용 편집기를 열 수 있습니다.

## 포함한 기능

- 회원가입·로그인, 여러 전시, SQLite 저장, 초안 자동 저장
- 홈 / 전시 안내 / 약력 / 작가 노트 / 작품 / 상징 6개 메뉴
- 작품 업로드, 원본 보존, 작품 정보와 공통 상징·작품별 이야기
- 그림을 클릭하는 색상 선택, 포함·제외 보정, 직접 테두리 그리기
- SAM 2 연결 어댑터와 여러 영역 후보 선택, 투명 누끼를 홈 오브제로 사용
- KO/EN, DeepL 자동 번역 어댑터, 수동 번역, 원문 수정 시 검토 해제
- 템플릿 3종, 배경·점무늬·선무늬, 글꼴, 자연스러운 오브제 애니메이션
- 초안 미리보기, 공개본 분리, 공개 이력과 초안 복원, 고정 URL·QR, JSON 내보내기

색상 선택은 AI 모델이 아닙니다. SAM 2 정밀 선택과 자동 번역은 아래 설정을 마치면 사용할 수 있습니다. 작가가 모든 영역과 번역을 검토하고 확정합니다.

## 가장 빠른 실행: Docker

Docker와 Docker Compose가 설치된 환경에서:

```bash
docker compose up --build
```

브라우저에서 **http://localhost:3000**을 엽니다. 기본 이미지 처리와 QR을 포함하고, 데이터는 `atelier-data` 볼륨에 저장합니다. `docker compose down`은 데이터를 유지하지만 `down -v`는 삭제합니다. Docker 구성은 작성 환경에서 빌드 검증하지 않았습니다.

## 직접 실행: Node와 Python

필요 환경: **Node.js 24 이상**, Python 3.11 이상. 서버의 npm 패키지 설치는 필요하지 않습니다.

macOS / Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r workers/requirements.txt
cp .env.example .env
```

`.env`의 `PYTHON_BIN`을 `.venv/bin/python`으로 바꾼 뒤:

```bash
npm start
```

Windows PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r workers/requirements.txt
Copy-Item .env.example .env
```

`.env`에서 `PYTHON_BIN=.venv/Scripts/python.exe`로 설정하고 `npm start`를 실행합니다. 실행 위치는 프로젝트 최상위 폴더입니다. 개발 중 서버 자동 재시작은 `npm run dev`를 사용합니다.

Python 패키지가 없어도 기본 서버가 실행될 수 있지만 이미지 업로드·영역 선택·누끼·QR은 사용할 수 없습니다.

## 작가 사용 흐름

1. `/app`에서 이메일과 10자 이상 비밀번호로 계정을 만듭니다.
2. 전시 안내와 작가 소개에서 샘플 정보를 바꿉니다.
3. 작품을 올리고 제목, 제작일, 소재, 크기를 입력합니다.
4. ‘이야기 붙이기’에서 포함할 곳을 클릭하고 색상 선택을 실행합니다. 배경이 섞이면 제외 점을 추가하거나 직접 테두리를 그립니다.
5. 상징 이름과 이 작품의 이야기를 적고 확정합니다. 선택 영역을 홈 오브제로 만들 수도 있습니다.
6. 디자인을 조정하고 KO/EN 번역을 입력·검토합니다. 한국어만 쓰려면 이중 언어를 해제합니다.
7. 초안을 미리 보고 공개합니다. 관람객은 사물을 클릭해 작품 아래에서 이야기를 읽습니다.

편집 내용은 자동 저장됩니다. 저장 충돌이 나오면 다른 탭의 편집 내용을 확인하고 최신 화면을 불러오세요. 공개한 뒤 수정하는 내용은 다시 공개하기 전까지 초안으로 남습니다.

## SAM 2 정밀 선택 연결

기본 선택은 색상 기반이고, 딥러닝 모델을 내려받지 않습니다. 정밀 선택을 쓰려면 PyTorch 환경과 SAM 2를 별도 설치합니다.

```bash
.venv/bin/python -m pip install -r workers/requirements-sam2.txt
```

Windows에서는 위의 실행 파일 경로를 `.venv/Scripts/python.exe`로 바꿉니다. 환경에 맞는 CPU/CUDA PyTorch 설치는 [PyTorch 공식 안내](https://pytorch.org/get-started/locally/)를 사용하세요. SAM 2 설치는 [공식 설치 문서](https://github.com/facebookresearch/sam2/blob/main/INSTALL.md)를 따릅니다.

`.env`:

```dotenv
SAM2_MODEL_ID=facebook/sam2.1-hiera-small
SAM2_DEVICE=cpu
```

GPU 환경에서는 `SAM2_DEVICE=cuda`를 사용할 수 있습니다. 서버를 다시 시작하면 정밀 선택 메뉴가 활성화됩니다. 실제 설치·첫 추론에는 모델 다운로드와 메모리가 필요합니다. 환경변수를 설정했다고 모델 설치 상태를 자동 검증하지는 않으며 첫 실행 실패는 편집기에 표시합니다. 추론은 512px 작업 이미지에서 실행하고, 정규화한 테두리를 저장합니다. 현재 어댑터는 이 작성 환경에서 모델 추론으로 검증하지 못했습니다.

## DeepL 자동 번역 연결

`.env`에 본인의 DeepL API 키를 넣고 서버를 다시 시작합니다.

```dotenv
DEEPL_API_KEY=YOUR_DEEPL_API_KEY
```

`:fx`로 끝나는 키는 API Free 엔드포인트를 사용합니다. 다른 키는 API Pro를 사용합니다. [DeepL 번역 API 문서](https://developers.deepl.com/api-reference/translate/request-translation)를 참고하세요.

기본 버튼은 비어 있는 번역만 채워 작가가 고친 번역을 보존합니다. 기존 내용을 다시 생성하려면 체크박스를 선택합니다. 번역은 초안이며 검토를 완료해야 이중 언어 전시를 공개할 수 있습니다. 원문이 바뀌면 검토 상태를 해제합니다. 선택한 언어에 비어 있는 필수 정보나 원문의 번역이 있으면 공개를 막습니다. 실제 외부 API 호출은 개인 키가 없어 실행하지 않았습니다.

## 데이터와 배포

`data/atelier.sqlite`에 계정·세션·초안·공개본·공개 기록을 저장하고, `data/uploads`에 이미지 원본과 웹용 PNG를 보관합니다. 저장소에 올리지 않도록 제외했습니다. DB와 이미지 디렉터리를 함께 백업하세요. 실행 중에는 SQLite 백업 API 또는 안전한 스냅샷을 사용하고, 간단한 파일 복사는 서버를 중지한 상태에서 수행합니다.

실제 서비스는 HTTPS 도메인, 영구 데이터 디스크, `APP_ORIGIN=https://실제도메인`, `NODE_ENV=production`을 설정합니다. 리버스 프록시 뒤에서 실행할 때 `HOST=0.0.0.0`을 사용할 수 있습니다. 운영 모드는 Secure 쿠키를 사용하므로 HTTPS가 필요합니다. 플랫폼은 현재 단일 Node 프로세스와 하나의 이미지 처리기용으로 설계했습니다. 다중 프로세스 배포와 대규모 이미지 작업 큐는 다음 단계입니다.

첫 버전에는 이메일 인증·비밀번호 재설정·과금·작품 판매·예약 공개·커스텀 도메인 자동 설정·상징 브러시 편집이 없습니다. 실제 서비스 운영 전에 필요한 운영 기능을 추가해야 합니다. 자세한 대응표는 [구현 범위](docs/IMPLEMENTATION.md)에 있습니다.

## 검증

```bash
npm run check
npm test
```

이미지 통합 테스트도 실행하므로 Python 패키지를 먼저 설치하고 `PYTHON_BIN`을 지정하세요. 테스트는 임시 데이터 폴더를 사용합니다. 작성 환경에서 통합 테스트 **13개 통과**와 JS 구문 검사를 확인했습니다.

브라우저 검증:

```bash
npm install --no-save playwright@1.62.1
npx playwright install chromium
npm run test:browser
```

Linux에서 시스템 라이브러리가 필요한 경우 `npx playwright install --with-deps chromium`을 사용합니다. 테스트는 가입→업로드→직접 영역 선택→공개→모바일에서 이야기 읽기를 수행하고 `test-results`에 화면을 저장합니다. 작성 환경에서는 Chromium 다운로드가 차단되어 브라우저 테스트를 실행하지 못했습니다. GitHub Actions에도 같은 테스트를 연결했습니다.

## 기획서와 GitHub

- [최종 기획안 v1.0](docs/artist_exhibition_platform_plan_ko.docx)
- [작가 스케치](docs/artist-sketch.png)
- [기획과 구현 대응표·검증 기록](docs/IMPLEMENTATION.md)
- [개인 GitHub 업로드 방법](docs/GITHUB.md)

샘플 일러스트는 이 프로젝트를 위해 만든 SVG/PNG입니다. 실제 작가의 작품이나 Claude 레퍼런스 화면을 복제한 파일은 포함하지 않았습니다. 공개 저장소로 전환할 때는 코드 라이선스와 실제 작품의 공개 범위를 결정해주세요.

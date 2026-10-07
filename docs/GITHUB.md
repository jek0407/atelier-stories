# 개인 GitHub에 코드와 기획서 올리기

ZIP을 풀면 `atelier-stories` 폴더에 코드와 `docs/artist_exhibition_platform_plan_ko.docx`가 함께 있습니다. 실제 작품이나 계정 데이터는 ZIP에 포함하지 않았습니다.

## GitHub Desktop으로 올리기

1. GitHub Desktop에서 개인 GitHub 계정에 로그인합니다.
2. File → Add local repository에서 `atelier-stories` 폴더를 선택합니다. 저장소가 아니라는 안내가 나오면 그 폴더에서 저장소를 생성합니다.
3. 초기 커밋을 만듭니다. `.env`, `data`, `.venv`가 변경 파일에 없는지 확인합니다.
4. Publish repository를 눌러 저장소 이름을 `atelier-stories`로 설정합니다. 첫 버전은 private 저장소로 시작할 수 있습니다.
5. GitHub 저장소의 Actions에서 통합 테스트와 브라우저 테스트 결과를 확인합니다.

## GitHub CLI로 올리기

아래 명령은 본인의 컴퓨터에서 실행합니다. Git 작성자 이름과 이메일은 개인 Git 설정을 사용합니다.

```bash
cd atelier-stories
git init -b main
git add .
git commit -m "Build artist exhibition platform with artwork stories"
gh auth login
gh repo create atelier-stories --private --source=. --remote=origin --push
```

GitHub CLI가 없는 경우 GitHub 웹에서 빈 저장소를 만든 뒤, 저장소 화면에 표시된 주소로 연결합니다.

```bash
git remote add origin https://github.com/YOUR_USERNAME/atelier-stories.git
git push -u origin main
```

`YOUR_USERNAME`은 실제 개인 GitHub 이름으로 바꿉니다. GitHub에 이미 README를 포함한 저장소를 만들었다면 빈 저장소와 절차가 다르므로 기존 내용을 보존하면서 병합합니다. 비밀번호나 토큰을 코드 또는 기획서에 적지 않습니다.

## 저장소와 사이트 주소

GitHub는 코드와 기획서를 보관하는 곳입니다. 이 플랫폼은 로그인·SQLite·이미지 처리 서버를 사용하므로 GitHub Pages만으로 전체 서비스를 실행할 수 없습니다. 웹 서비스는 Node/Python 또는 Docker를 실행할 수 있고 데이터 디스크를 보존하는 호스팅에 배포해야 합니다. QR에 넣을 주소는 실제 배포 도메인으로 사이트를 연 뒤 생성하세요.

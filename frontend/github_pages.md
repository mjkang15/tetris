# GitHub Pages 배포 방법

## 개요

GitHub Pages는 GitHub 저장소의 HTML/CSS/JS 파일을 무료로 웹에 호스팅해 주는 서비스입니다.
별도 서버 없이 정적 파일을 그대로 배포할 수 있습니다.

---

## 1단계: GitHub 저장소 생성

1. [github.com](https://github.com) 로그인
2. 우상단 `+` → **New repository** 클릭
3. Repository name 입력 (예: `tetris`)
4. **Public** 선택 (Pages는 무료 플랜에서 Public만 지원)
5. **Create repository** 클릭

---

## 2단계: 로컬 코드를 저장소에 푸시

```bash
# 이미 git init이 된 경우
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git branch -M main
git add .
git commit -m "first commit"
git push -u origin main
```

처음부터 시작하는 경우:

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/<사용자명>/<저장소명>.git
git branch -M main
git push -u origin main
```

---

## 3단계: GitHub Pages 활성화

1. 저장소 페이지에서 **Settings** 탭 클릭
2. 왼쪽 사이드바에서 **Pages** 클릭
3. **Source** 섹션 → **Deploy from a branch** 선택
4. **Branch**: `main` / 폴더: `/ (root)` 선택 후 **Save**

> 배포 폴더를 `docs/`로 설정하면 소스와 배포 파일을 분리할 수 있습니다.

---

## 4단계: 배포 확인

- 설정 저장 후 약 1~3분 대기
- Pages 설정 화면 상단에 배포 URL이 표시됩니다:
  ```
  https://<사용자명>.github.io/<저장소명>/
  ```
- 해당 URL로 접속해서 사이트 확인

---

## 업데이트 배포

로컬에서 파일을 수정한 뒤 push하면 자동으로 재배포됩니다.

```bash
git add .
git commit -m "update: 변경 내용 설명"
git push
```

push 후 약 1~2분 내에 사이트에 반영됩니다.

---

## 이 프로젝트(테트리스) 배포 시 주의사항

- 진입점은 `landing.html` 또는 `index.html` 중 하나를 루트에 두어야 합니다.
- GitHub Pages는 루트의 `index.html`을 기본 페이지로 인식합니다.
- `landing.html` → `index.html` 링크가 상대 경로(`./index.html`)로 되어 있으면 별도 수정 없이 동작합니다.
- 저장소 루트가 아닌 하위 폴더(예: `tetris/`)를 배포하려면 **Branch + 폴더** 대신 **GitHub Actions**를 사용하거나, `tetris/` 내용을 루트로 옮기는 것이 간단합니다.

---

## 참고: 하위 폴더만 배포하기 (GitHub Actions 사용)

저장소 루트가 아닌 `tetris/` 폴더만 Pages로 서비스하고 싶을 때:

1. `.github/workflows/pages.yml` 파일 생성:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: tetris/        # 배포할 폴더 경로
      - uses: actions/deploy-pages@v4
        id: deployment
```

2. Settings → Pages → Source를 **GitHub Actions**로 변경
3. push하면 자동으로 `tetris/` 폴더만 배포됩니다.

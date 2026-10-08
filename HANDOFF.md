# 風自然早餐生產規劃 — 交接報告（給接手的 AI Agent）

最後更新：2026-10-08，對應 commit `916e362`（前一個 `d143bb4`）

## 0. 一句話現況

程式已完成、本機測試全綠、**尚未部署**。線上 https://fzbf-sk.web.app 目前是 404（該 Hosting 站台沒有任何部署紀錄）。
唯一剩下的工作是部署（§4），且部署前**必須**先補一個 Auth 授權網域（§4 Step 1），否則 Google 登入一定失敗。

## 1. 專案與環境

- 專案目錄：`C:\Users\TW-10\Documents\firebase雲端資料夾\風自然餐廳專用`（路徑含中文與空格，指令記得加引號）
- Firebase 專案 `opencode-sk`（見 `.firebaserc`）；Hosting site `fzbf-sk`（見 `firebase.json` 的 `site`）→ 目標網址 https://fzbf-sk.web.app
- `firebase` CLI 14.27.0 已安裝，已登入 `jeff79213@gmail.com`
- 服務帳號金鑰：上一層目錄 `opencode-sk-firebase-adminsdk-fbsvc-b6b29a6c03.json`。**不要**複製進專案、不要進版控、不要貼到對話裡
- 測試：`npm test` → 48 passed（vitest，`tests/core.test.js`、`tests/cal.test.js`、`tests/menu.test.js`）
- `npm run test:rules` 需要 Java + Firestore emulator，**本機沒有 Java，跑不起來**（這是目前最大的驗證缺口）
- 專案慣例：**零程式註解**、檔案 CRLF 換行、2 空白縮排、UI 文案繁體中文、Commit 用中文 conventional commit

## 2. 現在的登入與權限設計（與舊計畫不同，以此為準）

舊設計（計畫 Task 1–6）是自建帳密：Firebase Auth email/password + Cloud Functions `/api/fz/*` + `fz_accounts` + 登入鎖定 + 強制改密碼。**整套已淘汰**，原因是客戶端不該為了開通主帳號去跑本機金鑰腳本，而且部署 Functions 需要 Blaze 付費方案。

現在的設計：

- 登入：Google 登入（`signInWithPopup`，遇到 `auth/popup-blocked` 或環境不支援時自動退回 `signInWithRedirect`，並在載入時處理 `getRedirectResult`）
- 主帳號：Firestore `fz_users/{小寫 email}` 有一筆 `{ role: 'admin' }`，即為老闆
- 員工：`fz_users/{email}` 為 `{ role: 'editor' }`。主帳號在網頁「設定 → 人員管理」新增/改角色/刪除；離職刪掉該列即立刻失效
- 權限：`firestore.rules` 以 `fz_users` 白名單判定；資料路徑沿用 `fz_days/{date}`、`fz_config/app`、`fz_pantry/pantry`
- 名單文件欄位固定 `{ role, addedAt, addedBy }`；規則用 `keys().hasOnly([...])` 擋其他欄位
- 主帳號不能刪除或降級自己（規則與 UI 都擋）
- 未在名單者顯示 `denied` 畫面，可「重新檢查」（重新載入）或「登出並換帳號」
- 沒有 Cloud Functions、沒有密碼、沒有忘記密碼、沒有登入鎖定

角色分工：`admin` 可改全部設定與人員管理；`editor` 只能改菜色庫，不能改備料係數／用餐時段／人員名單。

## 3. 檔案地圖（相對專案根目錄）

新增

- `ui/auth.js`：Google 登入、白名單 session 判定、denied 畫面控制
- `tools/set-admin.js`：開發者端工具，寫入第一位主帳號（用服務帳號金鑰，繞過規則）
- `tests/rules.test.js`：改寫成白名單模型的規則測試（**尚未實跑**）

修改

- `dslib.js`：Google 登入 + session 讀取 + 人員 CRUD（`listMembers`／`addMember`／`setMemberRole`／`removeMember`）；`MEMBERS` 常數 = `fz_users`
- `app.js`：`VIEWS` 改為 `auth`／`denied`／`calendar`／`day`／`check`／`settings`，起始畫面 `go('auth')`
- `index.html`：`view-login` → `view-auth`（Google 按鈕）＋新增 `view-denied`；移除 `toggle-pw.js`
- `ui/settings.js`：帳號管理 → 人員管理（僅主帳號可見）＋「我的帳號」卡；`updatedBy` 改記 email
- `core.js`：新增 `normalizeEmail`／`isValidEmail`／`isValidRole`／`roleLabel`／`memberOf`，移除 `emailOf`
- `style.css`：新增 `.btn-google`，移除密碼欄位相關樣式
- `sw.js`：precache 清單更新、版本升為 `fz-shell-v2`
- `firebase.json`：移除 `/api/**` rewrite 與 `functions` 區塊（改為純靜態 hosting）
- `package.json`：`deploy` 改為 `firebase deploy --only hosting,firestore`
- `tests/core.test.js`：新增 5 個純邏輯測試

刪除

- `ui/login.js`、`toggle-pw.js`、`tools/create-owner.js`、`functions/`（整包）
- 舊版 Functions 程式仍在 git 歷史：`3319fe3`（帳號 CRUD）、`2975b52`（登入/session/改密碼）

## 4. 待辦：部署（照順序做）

**Step 1（必做）**：把 `fzbf-sk.web.app` 加進 Auth 授權網域。
目前只有 `localhost`、`opencode-sk.firebaseapp.com`、`opencode-sk.web.app`、`reno-mgr-deploy.vercel.app`。沒補的話正式站登入會回 `auth/unauthorized-domain`。
做法二選一：

- Firebase Console → Authentication → Settings → Authorized domains → 新增 `fzbf-sk.web.app`
- Identity Toolkit Admin API：`PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/opencode-sk/config?updateMask=authorizedDomains`，body 帶**完整** `authorizedDomains` 陣列（新增不是取代，漏掉原有的會把其他 App 的網域砍掉）。用服務帳號金鑰簽 JWT 換 access token 即可，已實測可行。

**Step 2**：`npm run deploy`（= `firebase deploy --only hosting,firestore`）。
注意 hosting `public` 是 `.`，會上傳整個專案扣掉 ignore 清單；`*.md`、`tools/**`、`tests/**`、`docs/**`、`**/.*` 已排除，所以本報告不會被上傳。

**Step 3**：寫入第一位主帳號（把 `<Gmail>` 換成老闆的 Google 帳號）：

```
node tools/set-admin.js <Gmail> admin
```

- 不帶參數 = 列出目前名單
- `node tools/set-admin.js <Gmail> --remove` = 移除

**Step 4**：跑 §6 的線上 smoke test。

## 5. 環境事實（已查證，接手者不必重猜）

- Firestore **全空**：`fz_days`、`fz_config`、`fz_pantry`、`fz_users`、`fz_accounts`、`fz_login_attempts` 都是 0 筆 → 沒有資料要搬、沒有舊帳號要清
- **`opencode-sk` 是與其他 App 共用的專案**：Auth 內有 39 個使用者，含 `@reno.app`、`@uvaco.app` 等 → 不要刪 Auth 使用者、不要停用 Email/Password 供應商（別的 App 可能在用）
- **不要部署到預設站台 `opencode-sk.web.app`**：那裡有其他 App 的最新部署（2026-10-08T04:17Z），覆蓋會弄壞別的專案
- `fzbf-sk` 站台存在但沒有 release（目前 404）
- Google 登入供應商已啟用（`defaultSupportedIdpConfigs/google.com` enabled=true），不需要再去 Console 開
- Cloud Functions 清單查不到（服務帳號權限不足，403），無法確認 `fzapi` 是否曾部署；就算存在也已無程式使用
- 未提交草稿備份：上一層 `fz-draft-googleauth-20261008-1233/`（`dirty.patch` + 3 個檔）。確認不需要可刪，但**不要套用**（原因見 §9）

## 6. 線上 smoke test 清單（部署後必做，逐項記錄結果）

1. 未在名單的 Google 帳號登入 → 應停在「還不能使用」，看得到自己的 email，且讀不到任何資料
2. 主帳號登入 → 進月曆；設定頁出現「人員管理」
3. 人員管理新增一個 Gmail → 該帳號登入能進系統；把該列刪除 → 該帳號再登入回到 denied
4. 員工帳號登入 → 看不到備料係數、用餐時段、人員管理；改菜色庫會成功
5. 無痕視窗直連網址 → 只有登入頁，無資料可讀
6. 兩個帳號各改不同日期的資料 → 資料在同店共用，且互不覆蓋
7. PWA：加到手機主畫面、開飛航模式重開 → 介面仍可顯示（Service Worker 快取）
8. 檢查瀏覽器 console 無錯誤、`sw.js` 回應 200 且 `Cache-Control: no-cache`

## 7. 已知缺口／未驗證

- `tests/rules.test.js` **從未真正執行過**（沒有 Java/emulator）→ 新規則還沒被 rules 引擎驗證；部署後請用手動步驟補（§6 的第 1、4、5 項就是在驗規則）
- 真實 Google popup 登入未測（本機沒有可用的 Google 帳號授權流程），只在授權網域上測得準
- Service Worker 離線與「加到主畫面」未測
- 離線 UI harness 是臨時檔案，驗證後已刪除；要重驗請照 §8 重建
- `docs/superpowers/plans/2026-10-04-風自然早餐生產規劃.md` 還是**舊帳密設計**（Task 1–6、Task 12/17/20/24 的內容都過時）→ 以本報告為準，該計畫尚未改寫

## 8. 離線 UI 驗證做法（不碰真 Firebase）

1. 建 `_mock-dslib.js`，匯出 `dslib.js` 的同名 API：`initFirebase`、`onSession`、`signInWithGoogle`、`logout`、`listMembers`、`addMember`、`setMemberRole`、`removeMember`、`loadDay`、`saveDay`、`loadConfig`、`saveConfig`、`loadPantry`、`savePantry`、`emptyDay`、`emptyConfig`、`Debouncer`；用 `?as=admin|editor|ghost|none` 決定假 session，`?after=` 決定按下登入後的身分
2. 複製 `index.html` 成 `_mock.html`，在 module script **之前**插入
   `<script type="importmap">{"imports":{"./dslib.js":"./_mock-dslib.js"}}</script>`，並移除 serviceWorker 註冊區塊
3. 起一個靜態伺服器指向專案根目錄（`node:http` 內建即可），開 `/_mock.html`
4. 驗證完刪掉這兩個檔案，不要提交

可直接驗的項目：登出→Google 登入→月曆／當日頁、人員管理新增（順便驗大小寫正規化）／改角色／刪除／自己那列按鈕鎖住、非名單帳號的 denied 畫面、員工看不到管理卡。
**mock 無法驗證**：真實登入、`firestore.rules`、Service Worker。

## 9. 禁區（踩到會壞事）

- **不要套用** `../fz-draft-googleauth-*/dirty.patch`：那份草稿把一整套 auth 內嵌進 `index.html`，`await` 寫在非 async 的事件處理器裡 → 語法是錯的，整頁白畫面；它的 `firestore.rules` 也只開放 `content/`、`users/`，會讓所有 `fz_*` 資料被拒
- 不要重新引入 Cloud Functions 或自建帳密（除非使用者明確要求）
- 改白名單時三處必須同步：`dslib.js` 的 `MEMBERS` 常數、`firestore.rules` 的 `fz_users` 路徑、`tests/rules.test.js` 的集合名
- 不要改動 `fz_days`／`fz_config`／`fz_pantry` 的路徑或欄位結構（前端與 CSV 匯出都依賴它）
- 不要 commit `.freebuff/`、`.superpowers/` 或服務帳號金鑰
- 不要為了讓檢查通過而放寬規則、刪測試或加抑制

## 10. 其他

- 執行帳本（本機、未進版控）：`.superpowers/sdd/progress.md`，內含前 24 個 Task 的進度與本次架構變更紀錄
- 本次提交（依時間序）：`d143bb4`（Google 登入 + 名單制）、`916e362`（白名單集合改名 `fz_users`），最後一筆是這份報告本身的 `docs:` commit（看 `git log --oneline -1`）
- 要用 `firebase` CLI 之外的 API（授權網域、Hosting、Functions 狀態）時：用金鑰簽 JWT 換 `https://www.googleapis.com/auth/cloud-platform` 的 access token，已驗證可行；**記得腳本要放在專案目錄內**，放 `/tmp` 會 `ERR_MODULE_NOT_FOUND`（找不到 `node_modules`）

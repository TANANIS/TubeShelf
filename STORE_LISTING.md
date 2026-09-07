# TubeShelf — Chrome Web Store submission sheet

Prepared for TubeShelf v1.18.7.

This file is the copy/reference sheet for the Chrome Web Store Developer Dashboard. Keep it aligned with the extension behavior, `manifest.json`, and `PRIVACY.md` before every submission.

## Recommended dashboard choices

- Primary language: English
- Additional locale: Traditional Chinese (`zh_TW`)
- Category: **Workflow & Planning**
- Visibility: Public
- Homepage / support URL: `https://github.com/TANANIS/TubeShelf`
- Privacy policy URL: `https://github.com/TANANIS/TubeShelf/blob/main/PRIVACY.md`

## Single purpose

> TubeShelf gives users local control over how they organize and view their YouTube subscriptions, including optional controls that reduce recommendation-driven distractions while using YouTube.

The grouping, filtering, local classification suggestions, subscription synchronization, in-YouTube group controls, and distraction controls all support this same subscription-focused browsing experience.

## Store summary

The manifest supplies the localized summaries shown by Chrome.

### English

> Organize your YouTube subscriptions into groups. Your data stays on this device.

### 繁體中文

> 把 YouTube 訂閱頻道整理成自己的群組；資料只留在本機。

## English detailed description

TubeShelf turns your YouTube subscriptions into a library you control.

Organize subscribed channels into custom groups, filter your Subscriptions feed directly inside YouTube, and reduce recommendation-driven distractions without creating another account or sending your subscription library to a TubeShelf server.

ORGANIZE YOUTUBE YOUR WAY

Create your own groups and browse subscriptions the way that makes sense to you.

• Create custom groups with your own names, colors, and icons
• Add the same channel to multiple groups
• Switch groups directly from YouTube's sidebar and Subscriptions page
• See group labels directly on videos in your Subscriptions feed
• Assign channels to groups beside the Subscribe button on channel and watch pages
• Search channels and edit group membership individually or in batches
• Keep newly subscribed channels in Unclassified until you decide where they belong
• Automatically remove channels from TubeShelf when you unsubscribe

TubeShelf integrates into YouTube instead of replacing it, and its controls follow YouTube's light and dark themes.

FAST, FOCUSED SUBSCRIPTION BROWSING

TubeShelf is designed to keep large subscription libraries manageable.

Group filtering runs directly inside the YouTube Subscriptions page, with optimized local indexing to avoid unnecessary page work.

You can also pause or resume TubeShelf's YouTube integration at any time from the extension popup. Your groups, preferences, and library stay saved while TubeShelf is paused.

LOCAL AUTO-ORGANIZATION

Not sure where every channel belongs?

TubeShelf can analyze unclassified channels and suggest groups using publicly available channel information.

Suggestions can consider:

• channel names and descriptions
• channel keywords
• recurring topics in recent video titles
• a built-in multilingual topic dictionary
• vocabulary learned from your previous manual classifications
• optional public metadata from the YouTube Data API

Classification runs locally on your device. TubeShelf does not send your subscription library to a cloud AI service.

Low-confidence or conflicting results remain unclassified. Suggestions are shown before changes are applied, and TubeShelf never automatically overwrites your existing manual organization.

REDUCE YOUTUBE DISTRACTIONS

Choose which parts of YouTube you want to keep.

TubeShelf can independently:

• redirect the YouTube Home page to Subscriptions
• hide Shorts and its navigation entry
• hide recommendations beside videos
• disable autoplay
• hide already-watched videos from your Subscriptions feed

These controls are optional and independent.

You can keep YouTube recommendations while simply organizing your subscriptions, or build a more focused subscription-first experience.

PRIVATE BY DEFAULT

Your TubeShelf library and preferences are stored locally in your browser using chrome.storage.local.

TubeShelf has:

• no TubeShelf account
• no TubeShelf server
• no telemetry or analytics
• no advertising
• no cloud AI classification

You can export and import your groups and channel library as a JSON backup.

OPTIONAL YOUTUBE DATA API

TubeShelf works without an API key.

If you choose to provide your own YouTube Data API key, TubeShelf can use additional public YouTube topic and video category metadata to improve classification suggestions.

Your API key stays on your device, is used only for direct requests to Google's YouTube Data API, and is excluded from TubeShelf JSON backups.

BUILT FOR YOUTUBE, NOT A REPLACEMENT FOR IT

YouTube recommendations and subscriptions serve different purposes.

TubeShelf keeps them separate: YouTube can continue recommending content on Home, while your Subscriptions page becomes a space organized around channels you deliberately chose to follow.

You stay in control of how much of YouTube you want TubeShelf to change.

Interface languages:
• English
• Traditional Chinese

TubeShelf is an independent open-source project and is not affiliated with, endorsed by, or sponsored by YouTube, Google, or PocketTube.

## 繁體中文詳細說明

TubeShelf 把你的 YouTube 訂閱變成一座由你掌控的書架。

你可以把訂閱頻道整理成自訂群組、直接在 YouTube 的「訂閱內容」頁篩選頻道，並依自己的需求減少推薦內容帶來的干擾。不需要建立 TubeShelf 帳號，也不需要把整份訂閱資料送到 TubeShelf 伺服器。

依自己的方式整理 YouTube

建立屬於自己的群組，用真正符合你使用習慣的方式瀏覽訂閱內容。

• 自訂群組名稱、顏色與圖示
• 同一個頻道可以加入多個群組
• 直接從 YouTube 側邊欄與「訂閱內容」頁切換群組
• 在訂閱影片資訊旁直接看到所屬群組
• 在頻道頁與影片觀看頁的訂閱按鈕旁調整頻道群組
• 搜尋頻道，並逐一或批次修改群組成員
• 新訂閱的頻道可先放入「未分類」，等你之後整理
• 取消 YouTube 訂閱後，自動從 TubeShelf 的本機書架移除

TubeShelf 是直接整合進 YouTube，而不是另外做一套替代介面；整合在 YouTube 裡的控制元件也會配合亮色與深色主題。

快速、專注的訂閱瀏覽

TubeShelf 針對大量訂閱頻道的使用情境進行最佳化。

群組篩選直接在 YouTube 的訂閱頁運作，並使用本機索引減少不必要的頁面掃描與重複處理。

你也可以隨時從擴充功能彈出視窗暫停或重新啟用 TubeShelf 在 YouTube 上的整合。暫停期間，群組、偏好設定與本機書架都會完整保留。

本機自動整理

不知道每個頻道該放在哪一組？

TubeShelf 可以分析尚未分類的頻道，利用公開可取得的頻道資訊提出群組建議。

建議可以參考：

• 頻道名稱與公開簡介
• 頻道關鍵詞
• 近期影片標題中的重複主題
• 內建的多語系主題字典
• 從你過去手動分類中學到的個人詞彙
• 選用的 YouTube Data API 公開主題與影片類別資料

分類在你的裝置上本機執行。TubeShelf 不會把你的訂閱書架傳到雲端 AI 服務。

低信心或互相衝突的結果會保留在未分類。所有建議都會先顯示給你確認，TubeShelf 也不會自動覆寫既有的手動分類。

減少 YouTube 干擾

你可以自己決定哪些 YouTube 功能要保留。

TubeShelf 可以分別設定：

• 將 YouTube 首頁重新導向「訂閱內容」
• 隱藏 Shorts 與其導覽入口
• 隱藏影片旁的推薦內容
• 關閉自動播放
• 在訂閱內容中隱藏已觀看影片

這些控制彼此獨立，而且全部都是選用功能。

你可以完整保留 YouTube 推薦，只使用 TubeShelf 整理訂閱；也可以把 YouTube 調整成更專注於訂閱內容的使用方式。

隱私優先

TubeShelf 的書架與偏好設定使用 chrome.storage.local 儲存在你的瀏覽器本機。

TubeShelf 沒有：

• TubeShelf 帳號
• TubeShelf 伺服器
• 遙測或分析追蹤
• 廣告
• 雲端 AI 分類

你可以把群組與頻道書架匯出成 JSON 備份，也可以之後重新匯入。

選用的 YouTube Data API

TubeShelf 不需要 API Key 也能使用。

如果你選擇提供自己的 YouTube Data API Key，TubeShelf 可以利用額外的公開 YouTube 主題與影片類別資料，改善分類建議。

API Key 會留在你的裝置上，只會用於直接向 Google 的 YouTube Data API 發送請求，也不會包含在 TubeShelf JSON 備份中。

為 YouTube 而做，而不是取代 YouTube

YouTube 推薦與 YouTube 訂閱本來就服務不同目的。

TubeShelf 把兩者分開：首頁仍然可以由 YouTube 推薦內容，而「訂閱內容」頁則成為一個由你自行整理、圍繞著你主動選擇追蹤頻道的空間。

你可以自行決定 TubeShelf 要改變多少 YouTube 的使用體驗。

介面語言：
• English
• 繁體中文

TubeShelf 是獨立的開源專案，與 YouTube、Google 或 PocketTube 沒有從屬、授權或贊助關係。

## Permission justifications

### `storage`

Stores the user's TubeShelf state locally: collected public YouTube channel metadata, custom groups, manual classification corrections, preferences, interface language, onboarding/scan state, TubeShelf power state, and the optional user-provided YouTube Data API key.

### Host permission: `https://www.youtube.com/*`

Required for TubeShelf's user-facing YouTube integration: reading visible subscription/channel metadata, displaying group controls and labels, filtering subscription cards, detecting subscribe/unsubscribe state, loading the user's subscribed-channels page during an explicit update, following YouTube theme state for integrated controls, and retrieving public YouTube channel/RSS metadata needed for organization suggestions.

### Host permission: `https://www.googleapis.com/youtube/v3/*`

Used only when the user explicitly provides their own YouTube Data API key. TubeShelf sends that key plus public channel/video IDs directly to Google's YouTube Data API over HTTPS to retrieve public topics, tags, and video categories used by the advertised organization feature.

### Remote code

None. TubeShelf does not download or execute remote JavaScript or WebAssembly.

## Privacy practices

TubeShelf handles data because its advertised purpose requires reading and locally organizing information from YouTube pages.

Recommended dashboard data-type disclosures:

- **Website content: Yes.** TubeShelf reads visible/public YouTube subscription and channel metadata needed to build, classify, label, and filter the user's local subscription library.
- **Authentication information: Yes.** A user may optionally provide a YouTube Data API key. TubeShelf stores that key locally and uses it only for direct HTTPS requests to Google's YouTube Data API. The key is not sent to the TubeShelf developer and is excluded from TubeShelf JSON backups.
- **User activity: No.** TubeShelf does not record clicks, mouse positions, keystrokes, general browsing activity, or persistent interaction logs. It reads the current subscribe/unsubscribe state only to keep the local subscription library synchronized.
- **Web history / browsing history: No.** TubeShelf does not build or retain a history of websites visited or videos watched across browsing sessions. The watched-video filter inspects YouTube's visible progress markers only to decide what to hide on the current subscriptions page; it does not maintain its own watch-history database.
- **Personally identifiable information: No.** TubeShelf does not intentionally collect names, addresses, email addresses, age, government identifiers, or similar PII.
- **Personal communications: No.**
- **Health information: No.**
- **Financial and payment information: No.**
- **Location information: No.**

In the current Chrome Web Store privacy form, the expected selected data types are therefore **Website content** and **Authentication information** only.

Data use certifications:

- Data is used only to provide TubeShelf's disclosed single purpose and related user-facing functionality.
- Data is not sold.
- Data is not used or transferred for advertising, credit decisions, or unrelated purposes.
- TubeShelf has no telemetry or developer-operated backend that receives the user's subscription library.
- Humans do not receive or read the user's locally stored TubeShelf data.
- When the optional YouTube Data API feature is enabled, the only third-party transfer is directly to Google and is limited to the user-provided API key and public channel/video identifiers needed for that feature.

Privacy policy: `PRIVACY.md` contains collection, use, sharing, deletion, optional Google API transfer, and Limited Use disclosures.

## Reviewer test instructions

1. Install TubeShelf and open `https://www.youtube.com/` while signed in to an account that has subscriptions.
2. Open the TubeShelf toolbar popup and select **Update subscriptions**.
3. TubeShelf opens YouTube's subscribed-channels page, scrolls it to load the user's subscriptions, saves the resulting public channel metadata locally, and closes the scan tab after completion.
4. Open **Manage groups**. Verify All channels, Unclassified, custom groups, manual membership changes, search/batch management, and local auto-organization.
5. Open YouTube's Subscriptions page. Verify group filters and the group labels shown with stored subscribed-channel videos.
6. Open a subscribed channel page or a video watch page. Verify the **Groups** control beside YouTube's Subscribe/Subscribed control and change the channel's local group membership.
7. Use the popup power button to pause TubeShelf. Verify the YouTube-integrated TubeShelf UI is disabled while groups and preferences remain stored, then re-enable TubeShelf.
8. In Preferences, independently test Home blocking, Shorts blocking, recommendation-sidebar hiding, autoplay disabling, and watched-video filtering.
9. The YouTube Data API key field is optional. Core functionality and local classification work without a key.
10. No external TubeShelf account or test credentials are required.

## Store assets

Required assets already present in the repository:

- Store icon: `extension/icons/icon-128.png`
- Screenshot: `outputs/store-assets/screenshot-library-1280x800.png`
- Screenshot: `outputs/store-assets/screenshot-settings-en-1280x800.png`
- Small promo tile: `outputs/store-assets/small-promo-440x280.png`

Recommended screenshot order:

1. Subscription library / group management
2. Groups and labels integrated into YouTube's Subscriptions page
3. The in-YouTube Groups control beside Subscribe
4. Local auto-organization suggestions/results
5. Preferences / distraction controls

The existing screenshots are enough for submission, but screenshots 2–4 would make the current in-YouTube experience clearer to store visitors.

## Pre-submit checklist

- [ ] Developer account registered and one-time registration fee paid
- [ ] Google account has 2-Step Verification enabled
- [ ] Upload ZIP contains the contents of `extension/` with `manifest.json` at ZIP root
- [ ] Upload ZIP contains only one `manifest.json`
- [ ] Version in `manifest.json` is higher than any previously uploaded package
- [ ] English store listing filled in
- [ ] Traditional Chinese localized listing filled in
- [ ] Category set to Workflow & Planning
- [ ] 128×128 icon uploaded / recognized
- [ ] At least one 1280×800 screenshot uploaded
- [ ] 440×280 small promo tile uploaded
- [ ] Privacy policy URL entered in the designated Privacy practices field
- [ ] Single-purpose text matches this file
- [ ] Permission justifications match the current manifest (`storage` only, plus declared host permissions)
- [ ] Data-use disclosures match `PRIVACY.md` and actual behavior
- [ ] Limited Use certifications completed
- [ ] Reviewer instructions supplied
- [ ] Distribution regions / visibility checked
- [ ] Final manual smoke test performed using the exact ZIP being submitted

# TubeShelf — Chrome Web Store submission sheet

Prepared for TubeShelf v1.15.0.

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

The grouping, filtering, local classification suggestions, subscription synchronization, and distraction controls all support this same subscription-focused browsing experience.

## Store summary

The manifest supplies the localized summaries shown by Chrome.

### English

> Organize your YouTube subscriptions into groups. Your data stays on this device.

### 繁體中文

> 把 YouTube 訂閱頻道整理成自己的群組；資料只留在本機。

## English detailed description

TubeShelf is a local-first organizer that gives you more control over how you browse your YouTube subscriptions.

Create your own subscription groups, filter the subscriptions feed directly inside YouTube, and change a channel's groups beside the Subscribe button on channel and watch pages. Newly subscribed channels can enter Unclassified automatically, while unsubscribed channels are removed from the local TubeShelf library.

TubeShelf also includes optional controls for a more intentional YouTube experience. You can block the Home recommendation feed, hide Shorts, hide the recommendation sidebar on watch pages, disable autoplay, and hide already-watched videos from subscriptions. Each control can be enabled independently.

LOCAL, EXPLAINABLE AUTO-ORGANIZATION

TubeShelf can suggest groups for unclassified channels using public channel information and recent video topics. Classification runs locally and can combine:

• channel names, descriptions, and keywords
• recurring topics in recent video titles
• a built-in multilingual topic dictionary
• vocabulary learned from your own manual corrections
• optional public topic/category metadata from the YouTube Data API

Low-confidence or conflicting results stay unclassified. Suggestions are shown before any group changes are applied, and existing manual classifications are not overwritten automatically.

PRIVATE BY DEFAULT

Your groups, collected channel metadata, preferences, and learned classifications are stored locally in Chrome storage. TubeShelf has no account system, developer-operated server, telemetry, advertising, or cloud AI classification.

If you choose to provide your own YouTube Data API key, TubeShelf uses it only to request public YouTube channel/video metadata directly from Google's YouTube Data API. The key stays on your device and is excluded from JSON backups.

OTHER FEATURES

• Custom groups with colors and icons
• A channel can belong to multiple groups
• Unclassified view for channels that still need attention
• Manual and local automatic organization
• JSON backup and restore
• Traditional Chinese and English interface
• No cloud account required

TubeShelf is an independent project and is not affiliated with, endorsed by, or sponsored by YouTube or Google.

## 繁體中文詳細說明

TubeShelf 是一套本機優先的 YouTube 訂閱整理工具，讓你自行決定要怎麼瀏覽與整理自己的訂閱內容。

你可以建立自訂群組、直接在 YouTube 訂閱頁篩選頻道，並在頻道首頁或影片觀看頁的訂閱按鈕旁調整目前頻道的分類。新訂閱的頻道可以自動進入「未分類」，取消訂閱後也會同步從 TubeShelf 的本機書架移除。

TubeShelf 也提供可獨立開關的減少干擾功能，包括封鎖首頁推薦、隱藏 Shorts、隱藏觀看頁右側推薦欄、關閉自動播放，以及在訂閱內容中隱藏已觀看影片。

本機、可解釋的自動整理

TubeShelf 可以為尚未分類的頻道提出群組建議。分類在本機完成，並可綜合：

• 頻道名稱、公開簡介與關鍵詞
• 近期影片標題中的重複主題
• 內建的多語系主題字典
• 你手動分類後形成的個人詞彙
• 選用的 YouTube Data API 公開主題與影片類別

低信心或互相衝突的結果會保留在未分類。所有建議都會先讓你確認，既有的手動分類不會被自動覆寫。

隱私優先

群組、已收集的公開頻道資料、偏好設定與本機學習結果都儲存在 Chrome 本機儲存空間。TubeShelf 沒有帳號系統、開發者伺服器、遙測、廣告或雲端 AI 分類。

若你自行提供 YouTube Data API Key，TubeShelf 只會用它直接向 Google YouTube Data API 查詢公開的頻道／影片資料。Key 保留在你的裝置上，也不會包含在 JSON 備份中。

其他功能

• 自訂群組名稱、顏色與圖示
• 同一頻道可加入多個群組
• 固定的「未分類」入口
• 手動整理與本機自動整理
• JSON 備份與還原
• 繁體中文／English 介面
• 不需 TubeShelf 雲端帳號

TubeShelf 是獨立專案，與 YouTube 或 Google 沒有從屬、授權或贊助關係。

## Permission justifications

### `storage`

Stores the user's TubeShelf state locally: collected public YouTube channel metadata, custom groups, manual classification corrections, preferences, interface language, onboarding/scan state, and the optional user-provided YouTube Data API key.

### `activeTab`

Used after the user opens the TubeShelf popup so the extension can identify and communicate with the currently active YouTube tab. TubeShelf does not use this permission to monitor unrelated browsing.

### Host permission: `https://www.youtube.com/*`

Required for TubeShelf's user-facing YouTube integration: reading visible subscription/channel metadata, displaying group controls, filtering subscription cards, detecting subscribe/unsubscribe state, loading the user's subscribed-channels page during an explicit update, and retrieving public YouTube channel/RSS metadata needed for organization suggestions.

### Host permission: `https://www.googleapis.com/youtube/v3/*`

Used only when the user explicitly provides their own YouTube Data API key. TubeShelf sends that key plus public channel/video IDs directly to Google's YouTube Data API over HTTPS to retrieve public topics, tags, and video categories used by the advertised organization feature.

### Remote code

None. TubeShelf does not download or execute remote JavaScript or WebAssembly.

## Privacy practices

TubeShelf handles data because its advertised purpose requires reading and locally organizing information from YouTube pages.

Conservative disclosure guidance for the dashboard:

- **Website content:** Yes. TubeShelf reads visible/public YouTube subscription and channel metadata needed to build and filter the user's local subscription library.
- **User activity:** Yes, if the dashboard's current wording covers subscription/unsubscription actions or interaction state. TubeShelf detects subscribe/unsubscribe state only to keep its local library synchronized.
- **Web history / browsing history:** No. TubeShelf does not build or retain a history of websites visited or videos watched across browsing sessions. The watched-video filter inspects YouTube's visible progress markers to decide what to hide on the current subscriptions page; it does not maintain its own watch-history database.
- **Personally identifiable information:** No intentionally collected PII.
- **Authentication information:** No TubeShelf credentials or authentication cookies are collected. A user-provided YouTube Data API key is stored locally and used only for the optional Google API feature.
- **Personal communications, health, financial/payment information, precise location:** No.

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
4. Open **Manage groups**. Verify All channels, Unclassified, custom groups, manual membership changes, and local auto-organization.
5. Open a subscribed channel page or a video watch page. Verify the **Groups** control beside YouTube's Subscribe/Subscribed control and change the channel's local group membership.
6. In Preferences, independently test Home blocking, Shorts blocking, recommendation-sidebar hiding, autoplay disabling, and watched-video filtering.
7. The YouTube Data API key field is optional. Core functionality and local classification work without a key.
8. No external TubeShelf account or test credentials are required.

## Store assets

Required assets already present in the repository:

- Store icon: `extension/icons/icon-128.png`
- Screenshot: `outputs/store-assets/screenshot-library-1280x800.png`
- Screenshot: `outputs/store-assets/screenshot-settings-en-1280x800.png`
- Small promo tile: `outputs/store-assets/small-promo-440x280.png`

Recommended screenshot order:

1. Subscription library / group management
2. Preferences / distraction controls
3. Add a future screenshot showing the in-YouTube Groups control beside Subscribe
4. Add a future screenshot showing local auto-organization results
5. Add a future screenshot showing groups embedded in YouTube navigation/subscriptions

The first two are enough for submission; adding 3–5 will improve how clearly the store page communicates the actual experience.

## Pre-submit checklist

- [ ] Developer account registered and one-time registration fee paid
- [ ] Google account has 2-Step Verification enabled
- [ ] Upload ZIP contains the contents of `extension/` with `manifest.json` at ZIP root
- [ ] Version in `manifest.json` is higher than any previously uploaded package
- [ ] English store listing filled in
- [ ] Traditional Chinese localized listing filled in
- [ ] Category set to Workflow & Planning
- [ ] 128×128 icon uploaded / recognized
- [ ] At least one 1280×800 screenshot uploaded
- [ ] 440×280 small promo tile uploaded
- [ ] Privacy policy URL entered in the designated Privacy practices field
- [ ] Single-purpose text matches this file
- [ ] Permission justifications match the manifest
- [ ] Data-use disclosures match `PRIVACY.md` and actual behavior
- [ ] Limited Use certifications completed
- [ ] Reviewer instructions supplied
- [ ] Distribution regions / visibility checked
- [ ] Final manual smoke test performed using the exact ZIP being submitted

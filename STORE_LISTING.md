# TubeShelf Chrome Web Store listing draft

## Single purpose

TubeShelf organizes a user's YouTube subscriptions into local groups and lets the user filter and reduce distractions on YouTube subscription and watch pages.

## 繁體中文商店說明

TubeShelf 是一套本機優先的 YouTube 訂閱整理工具。它能掃描完整訂閱清單、建立或合併自訂群組、在訂閱頁快速篩選頻道，並在頻道首頁或影片觀看頁直接調整目前頻道的分類。

本機自動整理會根據公開頻道簡介與近期影片主題提出可確認的分類建議；低信心結果保留在未分類。也可選填自己的 YouTube Data API Key，加入 YouTube 官方公開分類訊號。

你還可以選擇封鎖首頁推薦、關閉 Shorts、隱藏影片右側推薦欄、關閉自動播放，以及在訂閱內容中隱藏已觀看影片。訂閱、取消訂閱與 TubeShelf 書架會自動同步。

群組、頻道與偏好設定預設只存在本機，沒有帳號、廣告、遙測或雲端 AI。介面預設為英文，偵測到中文瀏覽器語系時使用繁體中文，並支援 JSON 備份／還原。

## English store description

TubeShelf is a local-first organizer for YouTube subscriptions. Scan your full subscription list, create or merge custom groups, filter channels on the subscriptions page, and change the current channel's groups directly from a channel or watch page.

Local auto-organization suggests groups from public channel descriptions and recent video topics while leaving low-confidence results unclassified. You can optionally add your own YouTube Data API key to include official public classification signals.

Optional distraction controls can block Home recommendations and Shorts, hide the watch-page recommendation sidebar, disable autoplay, and hide watched videos in subscriptions. Subscribe and unsubscribe actions automatically stay in sync with your TubeShelf library.

Groups, channels, and preferences stay on the device by default. There is no account, advertising, telemetry, or cloud AI. English is the default interface; Chinese browser locales automatically use Traditional Chinese. JSON backup/restore is included.

## Permission justifications

- `storage`: stores subscription channel metadata, groups, manual corrections, preferences, language, onboarding state, scan status, and the optional API key locally.
- `activeTab`: lets the popup identify and communicate with the user's current YouTube tab after the user opens TubeShelf.
- `https://www.youtube.com/*`: required to show TubeShelf on YouTube, read the user's visible subscription/channel metadata, detect subscribe/unsubscribe changes, filter subscription cards, and retrieve public channel/RSS metadata.
- `https://www.googleapis.com/youtube/v3/*`: used only when the user provides an API key, to retrieve public channel topics, tags, and recent video categories directly from Google's YouTube Data API.
- Remote code: none.

## Privacy-practices answers

- Website content is processed because TubeShelf reads visible YouTube channel and subscription metadata for its user-facing organizer.
- User-created group and preference data is stored locally.
- No data is sold, used for advertising, credit decisions, or unrelated purposes.
- No telemetry or developer-operated server is used.
- Optional Google API transfers are limited to the user-provided API key and public channel/video IDs required for the advertised classification feature.
- Privacy policy URL: publish `PRIVACY.md` on a stable public HTTPS page and enter that URL in the dashboard.

## Reviewer test instructions

1. Install the extension and open YouTube while signed in to an account with subscriptions.
2. Open TubeShelf and select Update subscriptions; the extension opens `/feed/channels`, loads the list, stores it locally, and closes that scan tab.
3. Open the manager and verify groups, Unclassified, manual membership changes, and local auto-organization.
4. Open a subscribed channel or watch page and use the Groups button beside YouTube's subscription control.
5. Preferences contains the optional YouTube Data API key field; no key is required for core functionality.

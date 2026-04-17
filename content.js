// content.js
// 画面最前面に猫動画をクロマキー（緑背景）で透過合成して全画面中央に表示する。

(function () {
  "use strict";

  if (window.__catExtensionContentLoaded) {
    console.log("[cat-extension] 既にロード済み");
    return;
  }
  window.__catExtensionContentLoaded = true;
  console.log("[cat-extension] content script loaded");

  const VIDEO_FILES = [
    "cat-1.mp4", "cat-2.mp4", "cat-3.mp4", "cat-4.mp4", "cat-5.mp4",
    "cat-6.mp4", "cat-7.mp4", "cat-8.mp4", "cat-9.mp4", "cat-10.mp4",
    "cat-11.mp4", "cat-12.mp4", "cat-13.mp4", "cat-14.mp4", "cat-15.mp4",
    "cat-16.mp4", "cat-17.mp4", "cat-18.mp4", "cat-19.mp4", "cat-20.mp4",
    "cat-21.mp4", "cat-22.mp4", "cat-23.mp4", "cat-24.mp4", "cat-25.mp4",
    "cat-26.mp4", "cat-27.mp4", "cat-28.mp4", "cat-29.mp4", "cat-30.mp4",
    "cat-31.mp4", "cat-32.mp4", "cat-33.mp4", "cat-34.mp4", "cat-35.mp4",
    "cat-36.mp4", "cat-38.mp4", "cat-39.mp4", "cat-40.mp4",
    "cat-41.mp4", "cat-42.mp4", "cat-43.mp4", "cat-44.mp4", "cat-45.mp4",
    "cat-46.mp4", "cat-47.mp4", "cat-48.mp4", "cat-49.mp4", "cat-50.mp4"
  ];

  const OVERLAY_ID = "__cat_extension_overlay__";

  function pickRandomVideo() {
    return VIDEO_FILES[Math.floor(Math.random() * VIDEO_FILES.length)];
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { soundEnabled: true, volume: 1.0 },
        (items) => resolve(items)
      );
    });
  }

  function addUnmuteOverlay(video) {
    const btn = document.createElement("div");
    btn.textContent = "\uD83D\uDD07 クリックで音声ON";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.8)",
      color: "#fff",
      padding: "10px 20px",
      borderRadius: "8px",
      cursor: "pointer",
      zIndex: "2147483647",
      fontFamily: "sans-serif",
      fontSize: "14px",
      pointerEvents: "auto"
    });
    btn.addEventListener("click", () => {
      video.muted = false;
      video.play();
      btn.remove();
    });
    document.body.appendChild(btn);
    video.addEventListener("ended", () => btn.remove(), { once: true });
  }

  function tryUnmute(video) {
    video.muted = false;
    const p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        video.muted = true;
        video.play();
        addUnmuteOverlay(video);
      });
    }
  }

  async function summonCat() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();

    const { soundEnabled, volume } = await getSettings();
    const file = pickRandomVideo();
    const videoUrl = chrome.runtime.getURL(file);
    console.log("[cat-extension] summon:", file);

    // 全画面・中央配置・クリックスルーのオーバーレイ
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      zIndex: "2147483647",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      background: "transparent"
    });

    // 元動画（非表示、音声＆フレームソース用）
    const video = document.createElement("video");
    video.src = videoUrl;
    video.playsInline = true;
    video.style.display = "none";
    overlay.appendChild(video);

    // 描画用 canvas（全画面・アスペクト比維持で中央表示）
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      width: "100vw",
      height: "100vh",
      objectFit: "contain",
      display: "block",
      background: "transparent",
      pointerEvents: "none",
      imageRendering: "auto"
    });
    overlay.appendChild(canvas);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    video.addEventListener("loadedmetadata", () => {
      // 高画質：デバイスピクセル比を反映した解像度（最低 1280px 幅を保証）
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const baseW = video.videoWidth || 1280;
      const baseH = video.videoHeight || 720;
      const scale = Math.max(1, 1280 / baseW) * dpr;
      canvas.width = Math.round(baseW * scale);
      canvas.height = Math.round(baseH * scale);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    });

    let rafId = 0;

    // クロマキー閾値（調整可）
    // FULL_DIFF 以上 : 完全透明, EDGE_DIFF 以上 : 段階的に半透明＆スピル除去
    const FULL_DIFF = 60;
    const EDGE_DIFF = 20;

    function processFrame() {
      if (video.paused || video.ended) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const maxRB = r > b ? r : b;
          const diff = g - maxRB; // 緑の優勢度
          if (diff >= FULL_DIFF) {
            // 完全な緑 → 透明
            data[i + 3] = 0;
          } else if (diff > EDGE_DIFF) {
            // エッジ：線形に半透明化＋緑スピル除去
            const t = (FULL_DIFF - diff) / (FULL_DIFF - EDGE_DIFF); // 0..1
            data[i + 3] = Math.round(data[i + 3] * t);
            data[i + 1] = maxRB; // green を抑えて縁取りの緑を除去
          } else if (g > maxRB) {
            // わずかな緑被りも軽く除去（despill）
            data[i + 1] = maxRB;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      } catch (_) {
        // フレーム未準備時の例外は無視
      }
      rafId = requestAnimationFrame(processFrame);
    }

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    video.addEventListener("play", processFrame);
    video.addEventListener("ended", cleanup, { once: true });
    video.addEventListener(
      "error",
      (e) => {
        console.log("[cat-extension] video error:", e);
        cleanup();
      },
      { once: true }
    );

    document.body.appendChild(overlay);

    video.volume = Math.min(1, Math.max(0, Number(volume) || 1));
    // 自動再生のため一旦 muted で開始 → soundEnabled なら音声復帰を試みる
    video.muted = true;
    try {
      await video.play();
      if (soundEnabled) tryUnmute(video);
    } catch (e) {
      console.log("[cat-extension] play error:", e);
      cleanup();
    }

    // 保険：長すぎる場合の強制クリーンアップ
    setTimeout(cleanup, 60_000);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("[cat-extension] message:", message);
    if (message && message.type === "SUMMON_CAT") {
      summonCat();
      sendResponse({ ok: true });
    }
    return true;
  });
})();

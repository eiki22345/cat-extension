// options.js
// 設定を chrome.storage.sync に保存・復元する。

const DEFAULTS = {
  soundEnabled: true,
  volume: 1.0,
  timerEnabled: true,
  intervalMinutes: 30
};

const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    $("soundEnabled").checked = !!items.soundEnabled;
    $("volume").value = items.volume;
    $("volumeLabel").textContent = Math.round(items.volume * 100) + "%";
    $("timerEnabled").checked = !!items.timerEnabled;
    $("intervalMinutes").value = items.intervalMinutes;
  });
}

function save() {
  const soundEnabled = $("soundEnabled").checked;
  const volume = Math.min(1, Math.max(0, parseFloat($("volume").value) || 1));
  const timerEnabled = $("timerEnabled").checked;
  const intervalMinutes = Math.min(
    1440,
    Math.max(1, parseInt($("intervalMinutes").value, 10) || 30)
  );

  chrome.storage.sync.set(
    { soundEnabled, volume, timerEnabled, intervalMinutes },
    () => {
      const status = $("status");
      status.textContent = "保存しました";
      setTimeout(() => (status.textContent = ""), 1500);
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("save").addEventListener("click", save);
  $("volume").addEventListener("input", (e) => {
    $("volumeLabel").textContent =
      Math.round(parseFloat(e.target.value) * 100) + "%";
  });
});

// background.js (Manifest V3 Service Worker)
// タイマー（chrome.alarms）、ショートカット、アクションクリックで猫を召喚する。

const ALARM_NAME = "cat-summon-alarm";

const DEFAULTS = {
  soundEnabled: true,
  intervalMinutes: 30,
  timerEnabled: true,
  volume: 1.0
};

async function initSettings() {
  const saved = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...saved });
  await rebuildAlarm(
    saved.intervalMinutes ?? DEFAULTS.intervalMinutes,
    saved.timerEnabled ?? DEFAULTS.timerEnabled
  );
}

async function rebuildAlarm(intervalMinutes, timerEnabled) {
  await chrome.alarms.clear(ALARM_NAME);
  if (!timerEnabled) return;
  const minutes = Math.max(1, Number(intervalMinutes) || 30);
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: minutes,
    periodInMinutes: minutes
  });
  console.log("[cat-extension] alarm set every", minutes, "min");
}

chrome.runtime.onInstalled.addListener(initSettings);
chrome.runtime.onStartup.addListener(initSettings);

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  if (changes.intervalMinutes || changes.timerEnabled) {
    const { intervalMinutes, timerEnabled } =
      await chrome.storage.sync.get(DEFAULTS);
    await rebuildAlarm(intervalMinutes, timerEnabled);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  summonInActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  console.log("[cat-extension] command:", command);
  if (command === "summon-cat") {
    summonInActiveTab();
  }
});

chrome.action.onClicked.addListener(() => {
  summonInActiveTab();
});

function isAccessibleUrl(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

function summonInActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      console.log("[cat-extension] no active tab");
      return;
    }
    if (!isAccessibleUrl(tab.url)) {
      console.log("[cat-extension] skip URL:", tab.url);
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.log(
            "[cat-extension] inject (既にあれば正常):",
            chrome.runtime.lastError.message
          );
        }
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { type: "SUMMON_CAT" }, () => {
            if (chrome.runtime.lastError) {
              console.log(
                "[cat-extension] send error:",
                chrome.runtime.lastError.message
              );
            }
          });
        }, 100);
      }
    );
  });
}

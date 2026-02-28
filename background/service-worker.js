import {DetectionEngine} from "./detection-engine.js";
const detectionEngine = new DetectionEngine();
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "DOM_snapshot" || message.type === "UI_signals") {
        if (sender.frameId != 0) return;
        chrome.tabs.sendMessage(sender.tab.id, {
            type: "UI_changes",
            payload: detectionEngine.analyze({
                eventType: message.type,
                payload: message.payload
            })
        });
    }
});
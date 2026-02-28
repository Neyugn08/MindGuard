const RISK_THRESHOLD = 0.30;
// Interfere according to risk confidence
function interference(risks) {
    let enabled = false;
    if (risks.confidence > RISK_THRESHOLD) enabled = true;
    if (enabled) {
        // Create warning banner
        const warning = document.createElement("div");
        warning.classList.add("warning");
        warning.innerHTML = `
            <span>This web might have ${risks.risk_type.replace("_", " ")}</span>
            <button>Close</button>`;
        // Close button
        warning.querySelector("button").addEventListener("click", () => {
            warning.remove();
        })
        document.querySelector("body").appendChild(warning);
    }
    return;
}

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "UI_changes") {
        console.log(message.payload);
        interference(message.payload);
    }
});

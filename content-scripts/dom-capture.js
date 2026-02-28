(function DOMCapture() {
    // Capture keywords
    const TOP_WORDS = 30;
    const commonWords = [
      "the","a","an","and","or","but","in","on","at","to","for",
      "of","with","by","from","is","was","are","were","be","been",
      "have","has","had","do","does","did","will","would","could",
      "should","may","might","this","that","these","those","it","its",
      "we","you","he","she","they","their","our","your","my","i",
      "not","no","so","as","if","then","than","also","just","more"
    ];
    const body = document.querySelector("body");
    const bodyText = body?.innerText ?? "";
    const identifyInt = /^[+-]?\d+$/;
    const tokens = bodyText.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((w) => {return !(commonWords.includes(w) || identifyInt.test(w) || w.length >= 25);});
    const freq = {};
    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
    const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, TOP_WORDS).map(([word, frequency]) => ({word, frequency}));
    /*for (let i = 0; i < tmp.length; i++) {
      console.log(`Word: ${tmp[i]["token"]}. Freq: ${tmp[i]["frequency"]}. Order: ${i}`);
    }*/

    // Capture links
    const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
      source: a.href,
      text: a.textContent || ""
    }));
    // Capture buttons
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']")).map((btn) => (
      btn.textContent || btn.value || ""
    )).filter(Boolean);
    // Capture forms
    function getLabelTexts(inputs) {
      let labelTexts = [];
      for (const input of inputs) {
        const label = input.closest("label") || document.querySelector(`label[for="${input.id}"]`);
        if (label) labelTexts.push(label.textContent);
      }
      return labelTexts;
    }
    const forms = Array.from(document.querySelectorAll("form")).map((form) => ({
      action: form.action,
      method: form.method,
      inputTypes: Array.from(form.querySelectorAll("input")).map(i => i.type),
      labelTexts: getLabelTexts(Array.from(form.querySelectorAll("input")))
    }));
    // Capture iframes
    const iframes = Array.from(document.querySelectorAll("iframe")).map((i) => ({
      source: i.src, 
      crossOrigin: !i.src.startsWith(location.origin)
    }));
    const snapshot = {
      url: location.href,
      domain: location.hostname,
      title: document.title,
      bodyText,
      keywords,
      links,
      forms,
      buttons,
      iframes,
      timestamp:  Date.now()
    };
    function sendSnapshot(snapshot) {
      chrome.runtime.sendMessage({
        type: "DOM_snapshot",
        payload: snapshot
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => sendSnapshot(snapshot));
    } else {
      sendSnapshot(snapshot);
    }
})();
// ARCHITECTURE CONTRACT: content.js (Data Plane)

let activeTaskId = null;
let harvesterInterval = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "EXECUTE_TASK") {
        console.log("[CONTENT] Received Task payload:", message.task.id);
        activeTaskId = message.task.id;
        injectAndExecute(message.task.prompt);
        sendResponse({ status: "ACK" });
    }
});

function injectAndExecute(prompt) {
    try {
        const textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
        const inputEl = textareas.find(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
        
        if (!inputEl) {
            throw new Error("No interactive input element found.");
        }

        inputEl.focus();

        // 1. React/Vue Virtual DOM Bypass
        const isTextarea = inputEl.tagName.toLowerCase() === 'textarea';
        if (isTextarea) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            nativeInputValueSetter.call(inputEl, prompt);
        } else {
            inputEl.innerHTML = '';
            document.execCommand('insertText', false, prompt);
        }

        // 2. Synthetic Event Lifecycle
        const events = ['input', 'change', 'compositionend', 'keyup'];
        events.forEach(eventType => {
            inputEl.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });

        // 3. Click Dispatcher
        setTimeout(() => {
            let sendBtn = null;
            const standardSelectors = [
                'button[data-testid*="send"]', 
                'button[aria-label*="send" i]',
                'button[aria-label*="Send" i]'
            ];
            
            for (let sel of standardSelectors) {
                sendBtn = document.querySelector(sel);
                if (sendBtn && !sendBtn.disabled) break;
            }

            if (!sendBtn || sendBtn.disabled) {
                let parent = inputEl.parentElement;
                let attempts = 0;
                while (parent && attempts < 5) {
                    const btns = Array.from(parent.querySelectorAll('button'));
                    const activeBtns = btns.filter(b => !b.disabled && b.offsetWidth > 0);
                    if (activeBtns.length > 0) {
                        sendBtn = activeBtns[activeBtns.length - 1];
                        break;
                    }
                    parent = parent.parentElement;
                    attempts++;
                }
            }

            if (sendBtn && !sendBtn.disabled) {
                sendBtn.focus();
                sendBtn.click();
                console.log("[CONTENT] Payload injected and 'Send' clicked.");
                startHarvester();
            } else {
                inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                console.warn("[CONTENT] Send button not found. Fallback: Enter key dispatched.");
                startHarvester();
            }
        }, 800); // Wait for SPA to activate the button

    } catch (error) {
        console.error("[CONTENT] Execution Error:", error.message);
        chrome.runtime.sendMessage({ type: "TASK_FAILED", taskId: activeTaskId, error: error.message });
    }
}

function startHarvester() {
    if (harvesterInterval) clearInterval(harvesterInterval);
    
    const contentSelectors = '.markdown-body, .prose, .message-content, div[data-message-author="assistant"], div[class*="content"]';
    const initialBlocks = document.querySelectorAll(contentSelectors);
    const initialContent = initialBlocks.length > 0 ? initialBlocks[initialBlocks.length - 1].innerText.trim() : '';
    
    let lastContent = '';
    let stabilityCounter = 0;
    
    harvesterInterval = setInterval(() => {
        try {
            const allSpansAndBtns = Array.from(document.querySelectorAll('button, span, div'));
            const isThinking = allSpansAndBtns.some(el => el.innerText && el.innerText.toLowerCase().trim() === 'thinking');
            const isTyping = document.querySelector('button[aria-label*="Stop"], .typing-indicator, [class*="typing"]') !== null || isThinking;
            
            const responseBlocks = document.querySelectorAll(contentSelectors);
            if (responseBlocks.length === 0) return;
            
            const latestResponseEl = responseBlocks[responseBlocks.length - 1];
            let latestResponse = latestResponseEl.innerText.trim();
            
            if (!latestResponse || latestResponse === '...' || latestResponse === initialContent) {
                stabilityCounter = 0; 
                return; 
            }
            
            if (!isTyping) {
                if (latestResponse === lastContent) {
                    stabilityCounter++;
                } else {
                    stabilityCounter = 0;
                    lastContent = latestResponse;
                }
                
                // 3 seconds of stability indicates AI has finished generating
                if (stabilityCounter >= 3) {
                    clearInterval(harvesterInterval);
                    harvesterInterval = null;
                    
                    let finalOutput = latestResponse;
                    const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/i;
                    const match = latestResponse.match(jsonRegex);
                    
                    if (match && match[1]) {
                        finalOutput = match[1].trim(); 
                    } else {
                        const rawJsonMatch = latestResponse.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                        if (rawJsonMatch && rawJsonMatch[0]) {
                            finalOutput = rawJsonMatch[0].trim();
                        }
                    }
                    
                    console.log("[CONTENT] Harvester complete. Dispatching to DB.");
                    chrome.runtime.sendMessage({ type: "TASK_COMPLETED", taskId: activeTaskId, response: finalOutput });
                    activeTaskId = null;
                }
            } else {
                stabilityCounter = 0; 
                lastContent = latestResponse;
            }
        } catch (error) {
            clearInterval(harvesterInterval);
            chrome.runtime.sendMessage({ type: "TASK_FAILED", taskId: activeTaskId, error: "HARVEST_ERROR: " + error.message });
            activeTaskId = null;
        }
    }, 1000);
}

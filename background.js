// ARCHITECTURE CONTRACT: background.js (Control Plane)

const SUPABASE_URL = "https://aeopowovqksexgvseiyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_HX5GTYwHATs3gTksy-ZV9w_AQNIfM7t";
const TABLE_QUEUE = "ai_tasks";
const POLL_INTERVAL_MS = 1000;

let isPolling = false;

// Initialize Polling Loop
async function startPolling() {
    if (isPolling) return;
    isPolling = true;
    console.log("[BACKGROUND] System Boot: Initializing 1-Second Fast Polling...");
    pollSupabase();
}

async function pollSupabase() {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_QUEUE}?select=id,prompt&status=eq.pending&limit=1`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
                const task = data[0];
                if (task.id && task.prompt) {
                    console.log(`[BACKGROUND] Task Found: ${task.id}`);
                    const locked = await lockTask(task.id);
                    if (locked) {
                        dispatchToContentScript(task);
                    }
                }
            }
        } else {
            console.error(`[BACKGROUND] DB Error: HTTP ${response.status}`);
        }
    } catch (error) {
        console.error(`[BACKGROUND] Network Exception: ${error.message}`);
    }

    // Recursive trigger for 1-second polling (Prevents MV3 Service Worker Suspension)
    setTimeout(pollSupabase, POLL_INTERVAL_MS);
}

async function lockTask(taskId) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_QUEUE}?id=eq.${taskId}&status=eq.pending`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: 'processing' })
        });
        
        const data = await response.json();
        return data.length > 0;
    } catch (error) {
        console.error(`[BACKGROUND] Lock Exception: ${error.message}`);
        return false;
    }
}

async function updateTask(taskId, status, responseText) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${TABLE_QUEUE}?id=eq.${taskId}`;
        const body = { status: status };
        if (responseText) body.response = responseText;

        await fetch(url, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        console.log(`[BACKGROUND] Task ${taskId} successfully updated to ${status}.`);
    } catch (error) {
        console.error(`[BACKGROUND] Update Exception: ${error.message}`);
    }
}

function dispatchToContentScript(task) {
    chrome.tabs.query({ url: "https://chat.qwen.ai/*" }, (tabs) => {
        if (tabs.length > 0) {
            // Send to the first active Qwen tab
            chrome.tabs.sendMessage(tabs[0].id, { type: "EXECUTE_TASK", task: task }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("[BACKGROUND] Target Tab is asleep or content script not injected.");
                    updateTask(task.id, 'failed', 'DOM_ERROR: Tab asleep or script missing');
                } else {
                    console.log("[BACKGROUND] Payload dispatched to Qwen UI.");
                }
            });
        } else {
            console.error("[BACKGROUND] No Qwen tab found. Cannot execute task.");
            updateTask(task.id, 'failed', 'DOM_ERROR: No Qwen tab open');
        }
    });
}

// Listen for Harvester responses from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TASK_COMPLETED") {
        updateTask(message.taskId, 'completed', message.response);
    } else if (message.type === "TASK_FAILED") {
        updateTask(message.taskId, 'failed', message.error);
    }
});

// Boot sequence
startPolling();

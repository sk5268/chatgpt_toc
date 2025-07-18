function extractAllQueries() {
  // ChatGPT user messages typically have role="user" or a specific class
  // As of 2024, user messages are in div[data-message-author-role="user"]
  const queryElements = document.querySelectorAll('div[data-message-author-role="user"]');
  let queries = Array.from(queryElements)
    .map(el => el.textContent.trim())
    .filter(Boolean);

  return queries;
}

function createTOC() {
    const existingTOC = document.getElementById('chatgpt-toc-extension');
    if (existingTOC) {
        existingTOC.remove();
    }

    let questions = extractAllQueries();

    const tocContainer = document.createElement('div');
    tocContainer.id = 'chatgpt-toc-extension';
    
    const tocHeader = document.createElement('div');
    tocHeader.className = 'toc-header';
    tocHeader.innerHTML = `
        <h2>Table of Contents</h2>
        <button id="toc-toggle-btn" title="Toggle Table of Contents"></button>
    `;

    const tocList = document.createElement('ul');
    
    tocContainer.appendChild(tocHeader);
    tocContainer.appendChild(tocList);

    // --- Add Toggle Button Functionality ---
    const toggleBtn = tocContainer.querySelector('#toc-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            tocContainer.classList.toggle('collapsed');
        });
    }

    // --- Default to collapsed on smaller screens ---
    if (window.innerWidth <= 1024) {
        tocContainer.classList.add('collapsed');
    }

    questions.forEach((questionText, index) => {
        const shortText = questionText.length > 70 ? questionText.substring(0, 67) + '...' : questionText;
        const questionId = `toc-question-${index}`;

        // Assign id to the user message element for scrolling
        let el = document.querySelectorAll('div[data-message-author-role="user"]')[index];
        if (el) {
            el.id = questionId;
        }

        const listItem = document.createElement('li');
        listItem.setAttribute('data-toc-num', index + 1);
        const link = document.createElement('a');
        link.href = `#${questionId}`;
        link.textContent = `${index + 1}. ${shortText}`;
        link.title = questionText;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetElement = document.getElementById(questionId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        listItem.appendChild(link);
        tocList.appendChild(listItem);
    });

    if (tocList.children.length > 0) {
        // Always append to body, let CSS handle positioning and scrolling
        document.body.appendChild(tocContainer);
    } else {
        console.log("TOC list is empty, not appending.");
    }
}

// Optional: Chrome extension message listener for extracting queries
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getQueries") {
      const queries = extractAllQueries();
      sendResponse({ queries });
    }
  });
}

// Track current chat ID
let currentChatId = null;

function getCurrentChatId() {
    const url = window.location.href;
    const match = url.match(/chatgpt\.com\/c\/([^/?#]+)/);
    return match ? match[1] : null;
}

function checkForChatChange() {
    const newChatId = getCurrentChatId();
    if (newChatId !== currentChatId) {
        console.log(`Chat changed from ${currentChatId} to ${newChatId}`);
        currentChatId = newChatId;
        // Delay to allow new chat content to load
        setTimeout(() => {
            createTOC();
        }, 1000);
    }
}

// Run createTOC 3 seconds after every page load (refresh, redirect, SPA navigation)
function delayedCreateTOC() {
    setTimeout(() => {
        console.log('Calling createTOC 3 seconds after page load or navigation');
        currentChatId = getCurrentChatId(); // Initialize current chat ID
        createTOC();
        console.log("Called createTOC");
    }, 3000);
}

window.addEventListener('load', delayedCreateTOC);
window.addEventListener('pageshow', delayedCreateTOC);

// Monitor URL changes for SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        checkForChatChange();
    }
}).observe(document, { subtree: true, childList: true });

// Also check for URL changes on popstate (back/forward button)
window.addEventListener('popstate', checkForChatChange);

// Listen for mouse clicks on the prompt submission button
document.addEventListener('click', function(event) {
    // Use .closest() to check if the click was on or inside the submit button.
    // The data-testid for the send button is "send-button".
    if (event.target.closest('[data-testid="send-button"]')) {
        // Delay to allow the new prompt to appear in the DOM
        setTimeout(() => createTOC(), 100);
    }
}, true);

// Listen for Enter key presses in the prompt textarea
document.addEventListener('keydown', function(event) {
    // Check if the key is Enter and if the active element is the prompt textarea.
    if (event.key === 'Enter' && document.activeElement.id === 'prompt-textarea') {
        setTimeout(() => {
            createTOC();
        }, 80); // Delay to allow DOM update
    }
}, true);

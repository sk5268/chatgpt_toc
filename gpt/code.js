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
    const tocList = document.createElement('ul');
    tocContainer.innerHTML = '<h2>Table of Contents</h2>';
    tocContainer.appendChild(tocList);

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
        // Try to append to the right sidebar if it exists, else body
        const rightSidebar = document.querySelector('nav, aside, .flex.h-full.flex-col'); // fallback selectors
        if (rightSidebar) {
            rightSidebar.style.position = 'relative';
            tocContainer.style.position = 'absolute';
            tocContainer.style.top = '30px';
            tocContainer.style.right = '20px';
            tocContainer.style.margin = '0';
            tocContainer.style.zIndex = '10000';
            rightSidebar.appendChild(tocContainer);
        } else {
            document.body.appendChild(tocContainer);
        }
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

// Run createTOC 3 seconds after every page load (refresh, redirect, SPA navigation)
function delayedCreateTOC() {
    setTimeout(() => {
        console.log('Calling createTOC 3 seconds after page load or navigation');
        createTOC();
        console.log("Called createTOC");
    }, 3000);
}

window.addEventListener('load', delayedCreateTOC);
window.addEventListener('pageshow', delayedCreateTOC);

// Listen for mouse clicks on any button
document.addEventListener('click', function(event) {
    if (event.target.tagName === 'BUTTON') {
        createTOC();
    }
}, true);

// Listen for Enter key presses anywhere
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        setTimeout(() => {
            createTOC();
        }, 80); // Delay to allow DOM update
    }
}, true);

// Position storage functions
function savePosition(x, y) {
  localStorage.setItem("chatgpt-toc-position", JSON.stringify({ x, y }));
}

function getSavedPosition() {
  const saved = localStorage.getItem("chatgpt-toc-position");
  return saved ? JSON.parse(saved) : null;
}

// Drag functionality
function makeDraggable(element) {
  let isDragging = false;
  let startMouseX, startMouseY;
  let startElementX, startElementY;

  const header = element.querySelector(".toc-header");
  if (!header) return;

  header.style.cursor = "move";
  header.style.userSelect = "none";

  header.addEventListener("mousedown", startDrag);

  function startDrag(e) {
    if (e.target.closest("#toc-toggle-btn")) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;

    // Record starting mouse position
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    // Record starting element position
    const rect = element.getBoundingClientRect();
    startElementX = rect.left;
    startElementY = rect.top;

    // Ensure fixed positioning with !important
    element.style.setProperty("position", "fixed", "important");
    element.style.setProperty("left", startElementX + "px", "important");
    element.style.setProperty("top", startElementY + "px", "important");
    element.style.setProperty("right", "auto", "important");
    element.style.setProperty("bottom", "auto", "important");
    element.style.setProperty("margin", "0", "important");

    // Visual feedback
    element.style.opacity = "0.8";
    element.style.transition = "none";
    element.style.zIndex = "10001";

    // Add global event listeners
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
    document.body.style.userSelect = "none";
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    // Calculate how far the mouse has moved
    const deltaX = e.clientX - startMouseX;
    const deltaY = e.clientY - startMouseY;

    // Calculate new position
    let newX = startElementX + deltaX;
    let newY = startElementY + deltaY;

    // Constrain to viewport
    const padding = 10;
    const minX = padding;
    const minY = padding;
    const maxX = window.innerWidth - element.offsetWidth - padding;
    const maxY = window.innerHeight - element.offsetHeight - padding;

    newX = Math.max(minX, Math.min(newX, maxX));
    newY = Math.max(minY, Math.min(newY, maxY));

    // Apply position with !important
    element.style.setProperty("left", newX + "px", "important");
    element.style.setProperty("top", newY + "px", "important");
  }

  function stopDrag() {
    if (!isDragging) return;

    isDragging = false;

    // Save position
    const rect = element.getBoundingClientRect();
    savePosition(rect.left, rect.top);

    // Reset visual feedback
    element.style.opacity = "";
    element.style.transition = "";
    element.style.zIndex = "10000";

    // Remove event listeners
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", stopDrag);
    document.body.style.userSelect = "";
  }
}

function extractAllQueries() {
  // ChatGPT user messages typically have role="user" or a specific class
  // As of 2024, user messages are in div[data-message-author-role="user"]
  const queryElements = document.querySelectorAll(
    'div[data-message-author-role="user"]',
  );
  let queries = Array.from(queryElements)
    .map((el) => el.textContent.trim())
    .filter(Boolean);

  return queries;
}

function createTOC() {
  const existingTOC = document.getElementById("chatgpt-toc-extension");
  if (existingTOC) {
    existingTOC.remove();
  }

  let questions = extractAllQueries();

  const tocContainer = document.createElement("div");
  tocContainer.id = "chatgpt-toc-extension";

  const tocHeader = document.createElement("div");
  tocHeader.className = "toc-header";
  tocHeader.innerHTML = `
        <div class="toc-header-content">
            <div class="toc-drag-handle" title="Drag to move"></div>
            <h2>Table of Contents</h2>
        </div>
        <button id="toc-toggle-btn" title="Toggle Table of Contents"></button>
    `;

  const searchContainer = document.createElement("div");
  searchContainer.className = "toc-search-container";
  searchContainer.innerHTML = `
        <input type="text" id="toc-search-input" placeholder="Search queries..." />
        <div id="toc-search-clear" title="Clear search">×</div>
    `;

  const tocList = document.createElement("ul");

  tocContainer.appendChild(tocHeader);
  tocContainer.appendChild(searchContainer);
  tocContainer.appendChild(tocList);

  // --- Add Toggle Button Functionality ---
  const toggleBtn = tocContainer.querySelector("#toc-toggle-btn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      tocContainer.classList.toggle("collapsed");
    });
  }

  // --- Add Search Functionality ---
  const searchInput = tocContainer.querySelector("#toc-search-input");
  const searchClear = tocContainer.querySelector("#toc-search-clear");
  const allListItems = [];

  // Store reference to all list items for filtering
  const updateSearchResults = () => {
    const searchTerm = searchInput.value.toLowerCase().trim();

    allListItems.forEach((item) => {
      const text = item.querySelector("a").textContent.toLowerCase();
      const shouldShow = searchTerm === "" || text.includes(searchTerm);
      item.style.display = shouldShow ? "block" : "none";
    });
  };

  searchInput.addEventListener("input", updateSearchResults);

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    updateSearchResults();
    searchInput.focus();
  });

  // Show/hide clear button based on input content
  searchInput.addEventListener("input", () => {
    searchClear.style.display = searchInput.value ? "flex" : "none";
  });

  // --- Apply saved position or default position ---
  const savedPosition = getSavedPosition();
  if (savedPosition) {
    // Use saved position and ensure proper fixed positioning with !important
    tocContainer.style.setProperty("position", "fixed", "important");
    tocContainer.style.setProperty("left", savedPosition.x + "px", "important");
    tocContainer.style.setProperty("top", savedPosition.y + "px", "important");
    tocContainer.style.setProperty("right", "auto", "important");
    tocContainer.style.setProperty("bottom", "auto", "important");
    tocContainer.style.setProperty("margin", "0", "important");
    tocContainer.style.setProperty("transform", "none", "important");
  }

  // --- Default to collapsed on smaller screens ---
  if (window.innerWidth <= 1024) {
    tocContainer.classList.add("collapsed");
  }

  questions.forEach((questionText, index) => {
    const shortText =
      questionText.length > 70
        ? questionText.substring(0, 67) + "..."
        : questionText;
    const questionId = `toc-question-${index}`;

    // Assign id to the user message element for scrolling
    let el = document.querySelectorAll('div[data-message-author-role="user"]')[
      index
    ];
    if (el) {
      el.id = questionId;
    }

    const listItem = document.createElement("li");
    listItem.setAttribute("data-toc-num", index + 1);
    const link = document.createElement("a");
    link.href = `#${questionId}`;
    link.textContent = `${index + 1}. ${shortText}`;
    link.title = questionText;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetElement = document.getElementById(questionId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    listItem.appendChild(link);
    tocList.appendChild(listItem);

    // Store reference for search functionality
    allListItems.push(listItem);
  });

  if (tocList.children.length > 0) {
    // Always append to body, let CSS handle positioning and scrolling
    document.body.appendChild(tocContainer);

    // Make the TOC draggable
    makeDraggable(tocContainer);
  } else {
    console.log("TOC list is empty, not appending.");
  }
}

// Optional: Chrome extension message listener for extracting queries
if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
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
    console.log("Calling createTOC 3 seconds after page load or navigation");
    currentChatId = getCurrentChatId(); // Initialize current chat ID
    createTOC();
    console.log("Called createTOC");
  }, 3000);
}

window.addEventListener("load", delayedCreateTOC);
window.addEventListener("pageshow", delayedCreateTOC);

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
window.addEventListener("popstate", checkForChatChange);

// Handle window resize to keep TOC within bounds
window.addEventListener("resize", () => {
  const tocContainer = document.getElementById("chatgpt-toc-extension");
  if (tocContainer) {
    const rect = tocContainer.getBoundingClientRect();
    const padding = 10;
    const maxX = window.innerWidth - tocContainer.offsetWidth - padding;
    const maxY = window.innerHeight - tocContainer.offsetHeight - padding;

    let needsUpdate = false;
    let newX = rect.left;
    let newY = rect.top;

    if (rect.left > maxX) {
      newX = maxX;
      needsUpdate = true;
    }
    if (rect.top > maxY) {
      newY = maxY;
      needsUpdate = true;
    }
    if (rect.left < padding) {
      newX = padding;
      needsUpdate = true;
    }
    if (rect.top < padding) {
      newY = padding;
      needsUpdate = true;
    }

    if (needsUpdate) {
      tocContainer.style.setProperty("position", "fixed", "important");
      tocContainer.style.setProperty("left", newX + "px", "important");
      tocContainer.style.setProperty("top", newY + "px", "important");
      tocContainer.style.setProperty("right", "auto", "important");
      tocContainer.style.setProperty("bottom", "auto", "important");
      savePosition(newX, newY);
    }
  }
});

// Listen for mouse clicks on the prompt submission button
document.addEventListener(
  "click",
  function (event) {
    // Use .closest() to check if the click was on or inside the submit button.
    // The data-testid for the send button is "send-button".
    if (event.target.closest('[data-testid="send-button"]')) {
      // Delay to allow the new prompt to appear in the DOM
      setTimeout(() => createTOC(), 100);
    }
  },
  true,
);

// Listen for Enter key presses in the prompt textarea
document.addEventListener(
  "keydown",
  function (event) {
    // Check if the key is Enter and if the active element is the prompt textarea.
    if (
      event.key === "Enter" &&
      document.activeElement.id === "prompt-textarea"
    ) {
      setTimeout(() => {
        createTOC();
      }, 80); // Delay to allow DOM update
    }
  },
  true,
);

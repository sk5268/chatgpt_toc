const CONSTANTS = {
  SELECTORS: {
    USER_MESSAGE: 'div[data-message-author-role="user"]',
    SEND_BUTTON: '[data-testid="send-button"]',
    PROMPT_TEXTAREA: "#prompt-textarea",
  },
  IDS: {
    TOC_CONTAINER: "chatgpt-toc-extension",
    TOC_TOGGLE_BTN: "toc-toggle-btn",
    SEARCH_INPUT: "toc-search-input",
    SEARCH_CLEAR: "toc-search-clear",
  },
  CLASSES: {
    TOC_HEADER: "toc-header",
    TOC_HEADER_CONTENT: "toc-header-content",
    TOC_DRAG_HANDLE: "toc-drag-handle",
    TOC_SEARCH_CONTAINER: "toc-search-container",
    COLLAPSED: "collapsed",
  },
  DELAYS: {
    PAGE_LOAD: 3000,
    CHAT_CHANGE: 1000,
    PROMPT_SUBMISSION: 100,
    ENTER_KEY: 80,
  },
  CONSTRAINTS: {
    PADDING: 10,
    MAX_QUERY_LENGTH: 70,
    TRUNCATE_SUFFIX: "...",
    COLLAPSE_BREAKPOINT: 1024,
  },
  STORAGE_KEY: "chatgpt-toc-position",
};

/**
 * Manages TOC positioning and persistence
 */
class PositionManager {
  static savePosition(x, y) {
    localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify({ x, y }));
  }

  static getSavedPosition() {
    const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  static applyPosition(element, x, y) {
    const styles = {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      right: "auto",
      bottom: "auto",
      margin: "0",
      transform: "none",
    };

    Object.entries(styles).forEach(([prop, value]) => {
      element.style.setProperty(prop, value, "important");
    });
  }

  static constrainToViewport(x, y, elementWidth, elementHeight) {
    const padding = CONSTANTS.CONSTRAINTS.PADDING;
    const minX = padding;
    const minY = padding;
    const maxX = window.innerWidth - elementWidth - padding;
    const maxY = window.innerHeight - elementHeight - padding;

    return {
      x: Math.max(minX, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
    };
  }
}

/**
 * Handles drag functionality for the TOC
 */
class DragManager {
  constructor(element, positionManager) {
    this.element = element;
    this.positionManager = positionManager;
    this.isDragging = false;
    this.startMouseX = 0;
    this.startMouseY = 0;
    this.startElementX = 0;
    this.startElementY = 0;

    this.init();
  }

  init() {
    const header = this.element.querySelector(
      `.${CONSTANTS.CLASSES.TOC_HEADER}`,
    );
    if (!header) return;

    header.style.cursor = "move";
    header.style.userSelect = "none";
    header.addEventListener("mousedown", this.startDrag.bind(this));
  }

  startDrag(e) {
    if (e.target.closest(`#${CONSTANTS.IDS.TOC_TOGGLE_BTN}`)) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.startMouseX = e.clientX;
    this.startMouseY = e.clientY;

    const rect = this.element.getBoundingClientRect();
    this.startElementX = rect.left;
    this.startElementY = rect.top;

    this.positionManager.applyPosition(
      this.element,
      this.startElementX,
      this.startElementY,
    );
    this.applyDragStyles();

    document.addEventListener("mousemove", this.drag.bind(this));
    document.addEventListener("mouseup", this.stopDrag.bind(this));
    document.body.style.userSelect = "none";
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - this.startMouseX;
    const deltaY = e.clientY - this.startMouseY;

    let newX = this.startElementX + deltaX;
    let newY = this.startElementY + deltaY;

    const constrained = this.positionManager.constrainToViewport(
      newX,
      newY,
      this.element.offsetWidth,
      this.element.offsetHeight,
    );

    this.positionManager.applyPosition(
      this.element,
      constrained.x,
      constrained.y,
    );
  }

  stopDrag() {
    if (!this.isDragging) return;

    this.isDragging = false;

    const rect = this.element.getBoundingClientRect();
    this.positionManager.savePosition(rect.left, rect.top);

    this.removeDragStyles();
    document.removeEventListener("mousemove", this.drag);
    document.removeEventListener("mouseup", this.stopDrag);
    document.body.style.userSelect = "";
  }

  applyDragStyles() {
    this.element.style.opacity = "0.8";
    this.element.style.transition = "none";
    this.element.style.zIndex = "10001";
  }

  removeDragStyles() {
    this.element.style.opacity = "";
    this.element.style.transition = "";
    this.element.style.zIndex = "10000";
  }
}

/**
 * Manages search functionality
 */
class SearchManager {
  constructor(searchInput, searchClear) {
    this.searchInput = searchInput;
    this.searchClear = searchClear;
    this.allListItems = [];

    this.init();
  }

  init() {
    this.searchInput.addEventListener(
      "input",
      this.handleSearchInput.bind(this),
    );
    this.searchClear.addEventListener("click", this.clearSearch.bind(this));
  }

  addListItems(items) {
    this.allListItems.push(...items);
  }

  handleSearchInput() {
    this.updateSearchResults();
    this.updateClearButtonVisibility();
  }

  updateSearchResults() {
    const searchTerm = this.searchInput.value.toLowerCase().trim();

    this.allListItems.forEach((item) => {
      const text = item.querySelector("a").textContent.toLowerCase();
      const shouldShow = searchTerm === "" || text.includes(searchTerm);
      item.style.display = shouldShow ? "block" : "none";
    });
  }

  updateClearButtonVisibility() {
    this.searchClear.style.display = this.searchInput.value ? "flex" : "none";
  }

  clearSearch() {
    this.searchInput.value = "";
    this.updateSearchResults();
    this.updateClearButtonVisibility();
    this.searchInput.focus();
  }

  reset() {
    this.allListItems = [];
  }
}

/**
 * Handles DOM manipulation for the TOC
 */
class DOMManager {
  static createTOCContainer() {
    const container = document.createElement("div");
    container.id = CONSTANTS.IDS.TOC_CONTAINER;
    return container;
  }

  static createHeader() {
    const header = document.createElement("div");
    header.className = CONSTANTS.CLASSES.TOC_HEADER;
    header.innerHTML = `
      <div class="${CONSTANTS.CLASSES.TOC_HEADER_CONTENT}">
        <div class="${CONSTANTS.CLASSES.TOC_DRAG_HANDLE}" title="Drag to move"></div>
        <h2>Table of Contents</h2>
      </div>
      <button id="${CONSTANTS.IDS.TOC_TOGGLE_BTN}" title="Toggle Table of Contents"></button>
    `;
    return header;
  }

  static createSearchContainer() {
    const container = document.createElement("div");
    container.className = CONSTANTS.CLASSES.TOC_SEARCH_CONTAINER;
    container.innerHTML = `
      <input type="text" id="${CONSTANTS.IDS.SEARCH_INPUT}" placeholder="Search queries..." />
      <div id="${CONSTANTS.IDS.SEARCH_CLEAR}" title="Clear search">×</div>
    `;
    return container;
  }

  static createTOCList() {
    return document.createElement("ul");
  }

  static createListItem(questionText, index) {
    const shortText =
      questionText.length > CONSTANTS.CONSTRAINTS.MAX_QUERY_LENGTH
        ? questionText.substring(
            0,
            CONSTANTS.CONSTRAINTS.MAX_QUERY_LENGTH - 3,
          ) + CONSTANTS.CONSTRAINTS.TRUNCATE_SUFFIX
        : questionText;

    const questionId = `toc-question-${index}`;
    const listItem = document.createElement("li");
    listItem.setAttribute("data-toc-num", index + 1);

    const link = document.createElement("a");
    link.href = `#${questionId}`;
    link.textContent = `${index + 1}. ${shortText}`;
    link.title = questionText;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      DOMManager.scrollToElement(questionId);
    });

    listItem.appendChild(link);
    return { listItem, questionId };
  }

  static scrollToElement(elementId) {
    const targetElement = document.getElementById(elementId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  static assignIdToUserMessage(index, questionId) {
    const userMessages = document.querySelectorAll(
      CONSTANTS.SELECTORS.USER_MESSAGE,
    );
    const element = userMessages[index];
    if (element) {
      element.id = questionId;
    }
  }
}

/**
 * Extracts user queries from the ChatGPT interface
 */
class QueryExtractor {
  static extractAllQueries() {
    const queryElements = document.querySelectorAll(
      CONSTANTS.SELECTORS.USER_MESSAGE,
    );
    return Array.from(queryElements)
      .map((el) => el.textContent.trim())
      .filter(Boolean);
  }
}

/**
 * Handles URL monitoring and chat change detection
 */
class NavigationMonitor {
  constructor(callback) {
    this.callback = callback;
    this.currentChatId = null;
    this.lastUrl = location.href;

    this.init();
  }

  init() {
    this.currentChatId = this.getCurrentChatId();
    this.setupMutationObserver();
    window.addEventListener("popstate", this.checkForChatChange.bind(this));
  }

  getCurrentChatId() {
    const url = window.location.href;
    const match = url.match(/chatgpt\.com\/c\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  checkForChatChange() {
    const newChatId = this.getCurrentChatId();
    if (newChatId !== this.currentChatId) {
      console.log(`Chat changed from ${this.currentChatId} to ${newChatId}`);
      this.currentChatId = newChatId;
      setTimeout(() => this.callback(), CONSTANTS.DELAYS.CHAT_CHANGE);
    }
  }

  setupMutationObserver() {
    new MutationObserver(() => {
      const url = location.href;
      if (url !== this.lastUrl) {
        this.lastUrl = url;
        this.checkForChatChange();
      }
    }).observe(document, { subtree: true, childList: true });
  }
}

/**
 * Main TOC Extension class
 */
class TOCExtension {
  constructor() {
    this.searchManager = null;
    this.dragManager = null;
    this.navigationMonitor = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.navigationMonitor = new NavigationMonitor(this.createTOC.bind(this));
    this.delayedCreateTOC();
  }

  setupEventListeners() {
    window.addEventListener("load", this.delayedCreateTOC.bind(this));
    window.addEventListener("pageshow", this.delayedCreateTOC.bind(this));
    window.addEventListener("resize", this.handleWindowResize.bind(this));

    document.addEventListener(
      "click",
      this.handleDocumentClick.bind(this),
      true,
    );
    document.addEventListener("keydown", this.handleKeyDown.bind(this), true);

    // Chrome extension message listener
    this.setupChromeMessageListener();
  }

  setupChromeMessageListener() {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.onMessage
    ) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getQueries") {
          const queries = QueryExtractor.extractAllQueries();
          sendResponse({ queries });
        }
      });
    }
  }

  delayedCreateTOC() {
    setTimeout(() => {
      console.log("Calling createTOC after page load or navigation");
      this.createTOC();
    }, CONSTANTS.DELAYS.PAGE_LOAD);
  }

  createTOC() {
    this.removePlasExistingTOC();

    const questions = QueryExtractor.extractAllQueries();
    if (questions.length === 0) {
      console.log("No questions found, not creating TOC");
      return;
    }

    const tocContainer = this.buildTOCStructure(questions);
    this.setupTOCFunctionality(tocContainer);
    this.applyInitialPosition(tocContainer);

    document.body.appendChild(tocContainer);
    console.log("TOC created successfully");
  }

  removePlasExistingTOC() {
    const existingTOC = document.getElementById(CONSTANTS.IDS.TOC_CONTAINER);
    if (existingTOC) {
      existingTOC.remove();
    }
  }

  buildTOCStructure(questions) {
    const tocContainer = DOMManager.createTOCContainer();
    const tocHeader = DOMManager.createHeader();
    const searchContainer = DOMManager.createSearchContainer();
    const tocList = DOMManager.createTOCList();

    this.populateTOCList(tocList, questions);

    tocContainer.appendChild(tocHeader);
    tocContainer.appendChild(searchContainer);
    tocContainer.appendChild(tocList);

    return tocContainer;
  }

  populateTOCList(tocList, questions) {
    const listItems = [];

    questions.forEach((questionText, index) => {
      const { listItem, questionId } = DOMManager.createListItem(
        questionText,
        index,
      );
      DOMManager.assignIdToUserMessage(index, questionId);

      tocList.appendChild(listItem);
      listItems.push(listItem);
    });

    return listItems;
  }

  setupTOCFunctionality(tocContainer) {
    this.setupToggleButton(tocContainer);
    this.setupSearchFunctionality(tocContainer);
    this.setupDragFunctionality(tocContainer);
    this.setupResponsiveCollapse(tocContainer);
  }

  setupToggleButton(tocContainer) {
    const toggleBtn = tocContainer.querySelector(
      `#${CONSTANTS.IDS.TOC_TOGGLE_BTN}`,
    );
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        tocContainer.classList.toggle(CONSTANTS.CLASSES.COLLAPSED);
      });
    }
  }

  setupSearchFunctionality(tocContainer) {
    const searchInput = tocContainer.querySelector(
      `#${CONSTANTS.IDS.SEARCH_INPUT}`,
    );
    const searchClear = tocContainer.querySelector(
      `#${CONSTANTS.IDS.SEARCH_CLEAR}`,
    );
    const listItems = Array.from(tocContainer.querySelectorAll("li"));

    if (this.searchManager) {
      this.searchManager.reset();
    }

    this.searchManager = new SearchManager(searchInput, searchClear);
    this.searchManager.addListItems(listItems);
  }

  setupDragFunctionality(tocContainer) {
    this.dragManager = new DragManager(tocContainer, PositionManager);
  }

  setupResponsiveCollapse(tocContainer) {
    if (window.innerWidth <= CONSTANTS.CONSTRAINTS.COLLAPSE_BREAKPOINT) {
      tocContainer.classList.add(CONSTANTS.CLASSES.COLLAPSED);
    }
  }

  applyInitialPosition(tocContainer) {
    const savedPosition = PositionManager.getSavedPosition();
    if (savedPosition) {
      PositionManager.applyPosition(
        tocContainer,
        savedPosition.x,
        savedPosition.y,
      );
    }
  }

  handleWindowResize() {
    const tocContainer = document.getElementById(CONSTANTS.IDS.TOC_CONTAINER);
    if (!tocContainer) return;

    const rect = tocContainer.getBoundingClientRect();
    const constrained = PositionManager.constrainToViewport(
      rect.left,
      rect.top,
      tocContainer.offsetWidth,
      tocContainer.offsetHeight,
    );

    if (constrained.x !== rect.left || constrained.y !== rect.top) {
      PositionManager.applyPosition(tocContainer, constrained.x, constrained.y);
      PositionManager.savePosition(constrained.x, constrained.y);
    }
  }

  handleDocumentClick(event) {
    if (event.target.closest(CONSTANTS.SELECTORS.SEND_BUTTON)) {
      setTimeout(() => this.createTOC(), CONSTANTS.DELAYS.PROMPT_SUBMISSION);
    }
  }

  handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      document.activeElement.id ===
        CONSTANTS.IDS.PROMPT_TEXTAREA.replace("#", "")
    ) {
      setTimeout(() => this.createTOC(), CONSTANTS.DELAYS.ENTER_KEY);
    }
  }
}

// Initialize the extension when the script loads
const tocExtension = new TOCExtension();

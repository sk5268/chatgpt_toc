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
  STORAGE_KEY_CUSTOM_NAMES: "chatgpt-toc-custom-names",
};

/**
 * Manages custom names for TOC entries
 */
class CustomNameManager {
  static saveName(chatId, originalText, newName) {
    if (!chatId) return;
    const allNames = this.getAllNames();
    if (!allNames[chatId]) allNames[chatId] = {};

    const key = this._generateKey(originalText);
    if (!newName || newName.trim() === "") {
      delete allNames[chatId][key];
    } else {
      allNames[chatId][key] = newName.trim();
    }

    localStorage.setItem(
      CONSTANTS.STORAGE_KEY_CUSTOM_NAMES,
      JSON.stringify(allNames),
    );
  }

  static getName(chatId, originalText) {
    if (!chatId) return null;
    const allNames = this.getAllNames();
    const key = this._generateKey(originalText);
    return allNames[chatId]?.[key] || null;
  }

  static getAllNames() {
    const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY_CUSTOM_NAMES);
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Error parsing custom names", e);
      return {};
    }
  }

  static _generateKey(text) {
    // A simple unique-ish key based on content
    return text.trim().substring(0, 200);
  }
}

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
    this.hasMoved = false;
    this.isClickOnToggle = false;
    this.startMouseX = 0;
    this.startMouseY = 0;
    this.startElementX = 0;
    this.startElementY = 0;

    // Bind methods to preserve 'this' context and allow removal
    this.boundDrag = this.drag.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);

    this.init();
  }

  init() {
    // Listen on the entire container element for mousedown
    this.element.addEventListener("mousedown", this.startDrag.bind(this));
    // Apply cursor style to the header to indicate it's draggable
    const header = this.element.querySelector(
      `.${CONSTANTS.CLASSES.TOC_HEADER}`,
    );
    if (header) {
      header.style.cursor = "grab";
    }
  }

  startDrag(e) {
    const isToggleBtn = e.target.closest(`#${CONSTANTS.IDS.TOC_TOGGLE_BTN}`);
    const isInteractive = e.target.closest("input, a, button, .toc-list-item-wrapper, ul");
    const isCollapsed = this.element.classList.contains(
      CONSTANTS.CLASSES.COLLAPSED,
    );

    // If it's an interactive element but NOT the toggle button, don't drag
    if (isInteractive && !isToggleBtn) return;

    if (isToggleBtn) {
      if (!isCollapsed) {
        // Expanded: Toggle immediately on mousedown
        e.preventDefault();
        e.stopPropagation();
        this.toggleCollapse(false); // false = collapsing
        return;
      }
      // Collapsed: Proceed to allow drag
    }

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.hasMoved = false;
    this.isClickOnToggle = !!isToggleBtn;
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

    document.addEventListener("mousemove", this.boundDrag);
    document.addEventListener("mouseup", this.boundStopDrag);
    document.body.style.userSelect = "none";
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - this.startMouseX;
    const deltaY = e.clientY - this.startMouseY;

    // Add threshold to distinguish click vs drag
    if (!this.hasMoved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;
    this.hasMoved = true;

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

  stopDrag(e) {
    if (!this.isDragging) return;

    this.isDragging = false;

    const rect = this.element.getBoundingClientRect();
    this.positionManager.savePosition(rect.left, rect.top);

    // If it was a click on the toggle button (no movement), trigger the toggle
    if (!this.hasMoved && this.isClickOnToggle) {
      this.toggleCollapse(true); // true = expanding
    }

    this.removeDragStyles();
    document.removeEventListener("mousemove", this.boundDrag);
    document.removeEventListener("mouseup", this.boundStopDrag);
    document.body.style.userSelect = "";
  }

  toggleCollapse(isExpanding) {
    const rect = this.element.getBoundingClientRect();
    const currentX = rect.left;
    const currentY = rect.top;
    const toggleBtn = this.element.querySelector(`#${CONSTANTS.IDS.TOC_TOGGLE_BTN}`);

    if (!isExpanding) {
      // Collapsing: Find button's exact screen position
      const btnRect = toggleBtn.getBoundingClientRect();
      const newX = btnRect.left;
      const newY = btnRect.top;

      // Save width and offsets for precise restoration
      this.element.dataset.expandedWidth = rect.width;
      this.element.dataset.offsetX = (btnRect.left - rect.left).toString();
      this.element.dataset.offsetY = (btnRect.top - rect.top).toString();

      this.element.classList.add(CONSTANTS.CLASSES.COLLAPSED);
      this.positionManager.applyPosition(this.element, newX, newY);
      this.positionManager.savePosition(newX, newY);
    } else {
      // Expanding: Restore using saved exact offsets
      const expandedWidth = parseFloat(this.element.dataset.expandedWidth) || 300;

      // Fallbacks roughly match CSS spacing (top padding 16px + 1px border) and right-side button alignment
      const offsetX = parseFloat(this.element.dataset.offsetX) || (expandedWidth - 32 - 25);
      const offsetY = parseFloat(this.element.dataset.offsetY) || 17;

      const newX = currentX - offsetX;
      const newY = currentY - offsetY;

      this.element.classList.remove(CONSTANTS.CLASSES.COLLAPSED);

      // Constrain in case it goes off-screen
      const constrained = this.positionManager.constrainToViewport(
        newX,
        newY,
        expandedWidth,
        this.element.offsetHeight
      );

      this.positionManager.applyPosition(this.element, constrained.x, constrained.y);
      this.positionManager.savePosition(constrained.x, constrained.y);
    }
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

    const headerContent = document.createElement("div");
    headerContent.className = CONSTANTS.CLASSES.TOC_HEADER_CONTENT;

    const title = document.createElement("h2");
    title.textContent = "Table of Contents";

    const toggleBtn = document.createElement("button");
    toggleBtn.id = CONSTANTS.IDS.TOC_TOGGLE_BTN;
    toggleBtn.title = "Toggle Table of Contents";
    toggleBtn.innerHTML = `
      <svg class="toc-icon-minimize" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg class="toc-icon-maximize" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    headerContent.appendChild(title);
    header.appendChild(headerContent);
    header.appendChild(toggleBtn);

    return header;
  }

  static createSearchContainer() {
    const container = document.createElement("div");
    container.className = CONSTANTS.CLASSES.TOC_SEARCH_CONTAINER;

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.id = CONSTANTS.IDS.SEARCH_INPUT;
    searchInput.placeholder = "Search queries...";

    const searchClear = document.createElement("div");
    searchClear.id = CONSTANTS.IDS.SEARCH_CLEAR;
    searchClear.title = "Clear search";
    searchClear.textContent = "×";

    container.appendChild(searchInput);
    container.appendChild(searchClear);

    return container;
  }

  static createTOCList() {
    return document.createElement("ul");
  }

  static createListItem(questionText, index, chatId) {
    const customName = CustomNameManager.getName(chatId, questionText);
    const displayName = customName || questionText;

    const shortText =
      displayName.length > CONSTANTS.CONSTRAINTS.MAX_QUERY_LENGTH
        ? displayName.substring(
          0,
          CONSTANTS.CONSTRAINTS.MAX_QUERY_LENGTH - 3,
        ) + CONSTANTS.CONSTRAINTS.TRUNCATE_SUFFIX
        : displayName;

    const questionId = `toc-question-${index}`;
    const listItem = document.createElement("li");
    listItem.setAttribute("data-toc-num", index + 1);

    const wrapper = document.createElement("div");
    wrapper.className = "toc-list-item-wrapper";

    const link = document.createElement("a");
    link.href = `#${questionId}`;
    link.innerHTML = `<span style="color: var(--toc-accent-primary)">${index + 1}.</span> ${shortText}`;
    link.title = displayName;

    const editBtn = document.createElement("button");
    editBtn.className = "toc-edit-btn";
    editBtn.title = "Rename entry";
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    `;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      DOMManager.scrollToElement(questionId);
    });

    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOMManager.enterEditMode(listItem, questionText, chatId, index, questionId);
    });

    wrapper.appendChild(link);
    wrapper.appendChild(editBtn);
    listItem.appendChild(wrapper);

    return { listItem, questionId };
  }

  static enterEditMode(listItem, originalText, chatId, index, questionId) {
    const wrapper = listItem.querySelector(".toc-list-item-wrapper");
    const currentName = CustomNameManager.getName(chatId, originalText) || originalText;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "toc-edit-input";
    input.value = currentName;

    const originalContent = wrapper.innerHTML;
    wrapper.style.display = "none";
    listItem.appendChild(input);
    input.focus();
    input.select();

    let isExiting = false;
    const saveAndExit = () => {
      if (isExiting) return;
      isExiting = true;

      const newName = input.value.trim();
      CustomNameManager.saveName(chatId, originalText, newName);

      // Re-create the list item content instead of just restoring to refresh the link text
      const { listItem: newListItem } = DOMManager.createListItem(originalText, index, chatId);
      listItem.innerHTML = newListItem.innerHTML;
      input.remove();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        saveAndExit();
      }
      if (e.key === "Escape") {
        isExiting = true;
        input.remove();
        wrapper.style.display = "flex";
      }
    });

    input.addEventListener("blur", saveAndExit);
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
class TOCExtension {
  constructor() {
    this.searchManager = null;
    this.dragManager = null;
    this.lastQueriesJson = "";

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.startHeartbeat();
    this.delayedCreateTOC();
  }

  startHeartbeat() {
    setInterval(() => {
      this.createTOC(true); // true = heartbeat mode
    }, 5000);
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

  getCurrentChatId() {
    const url = window.location.href;
    const match = url.match(/chatgpt\.com\/c\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  createTOC(isHeartbeat = false) {
    const questions = QueryExtractor.extractAllQueries();
    const chatId = this.getCurrentChatId();

    // Skip if no questions
    if (questions.length === 0) {
      if (document.getElementById(CONSTANTS.IDS.TOC_CONTAINER)) {
        this.removePlasExistingTOC();
      }
      return;
    }

    // Smart Refresh Check:
    // Don't rebuild if:
    // 1. Content hasn't changed (number and text)
    // 2. User is currently editing a name
    const queriesJson = JSON.stringify({ chatId, questions });
    const isEditing = !!document.querySelector(".toc-edit-input");

    if (isHeartbeat && queriesJson === this.lastQueriesJson) return;
    if (isEditing) return;

    this.lastQueriesJson = queriesJson;
    this.removePlasExistingTOC();

    const tocContainer = this.buildTOCStructure(questions, chatId);
    this.setupTOCFunctionality(tocContainer);
    this.applyInitialPosition(tocContainer);

    document.body.appendChild(tocContainer);

    // Lock position if not saved
    if (!PositionManager.getSavedPosition()) {
      const rect = tocContainer.getBoundingClientRect();
      PositionManager.applyPosition(tocContainer, rect.left, rect.top);
    }

    console.log("TOC updated");
  }

  removePlasExistingTOC() {
    const existingTOC = document.getElementById(CONSTANTS.IDS.TOC_CONTAINER);
    if (existingTOC) {
      existingTOC.remove();
    }
  }

  buildTOCStructure(questions, chatId) {
    const tocContainer = DOMManager.createTOCContainer();
    const tocHeader = DOMManager.createHeader();
    const searchContainer = DOMManager.createSearchContainer();
    const tocList = DOMManager.createTOCList();

    this.populateTOCList(tocList, questions, chatId);

    tocContainer.appendChild(tocHeader);
    tocContainer.appendChild(searchContainer);
    tocContainer.appendChild(tocList);

    return tocContainer;
  }

  populateTOCList(tocList, questions, chatId) {
    const listItems = [];

    questions.forEach((questionText, index) => {
      const { listItem, questionId } = DOMManager.createListItem(
        questionText,
        index,
        chatId
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
    // Click handling is now managed by DragManager to support drag-on-collapsed
    // and prevent conflicts.
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

    // Only physically manipulate the DOM if it's genuinely pushed out of the viewport bounds
    // This stops it from arbitrarily dragging or reacting to normal window stretches
    if (Math.abs(constrained.x - rect.left) > 1 || Math.abs(constrained.y - rect.top) > 1) {
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

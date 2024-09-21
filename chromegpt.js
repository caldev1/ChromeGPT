// Constants
const IS_CHATGPT = location.host === "chatgpt.com";
const IS_WIKIPEDIA = location.host.includes("wikipedia.org");
const IS_ANDROID = /(android)/i.test(navigator.userAgent);
const IS_WINDOWS = /(windows)/i.test(navigator.userAgent);

// Utility functions
const parser = new DOMParser();

/**
 * Inserts the main CSS file into the document head.
 */
function insertCSS() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('css/menu.css');
  document.head.appendChild(link);
}

// Insert the merged CSS
insertCSS();

/**
 * Displays a Chrome notification to the user.
 * @param {string} title - The title of the notification.
 * @param {string} message - The body message of the notification.
 */
function showNotification(title, message) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon/128.png",
      title: title,
      message: message,
    });
  }
}

// Encapsulated global variables
const state = {
  contextMenu: null,
  chat: null,
  contextMenuX: null,
  contextMenuY: null,
};

/**
 * Detects if dark mode is active.
 * @returns {boolean} True if dark mode is detected, false otherwise.
 */
function isDarkMode() {
  const darkreaderActive = document.documentElement.getAttribute('data-darkreader-scheme') === 'dark';
  const chatGPTDarkMode = document.documentElement.classList.contains('dark');
  const wikipediaDarkMode = document.body.classList.contains('night-mode');
  const systemDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  return darkreaderActive || chatGPTDarkMode || wikipediaDarkMode || systemDarkMode;
}

/**
 * Returns the chat element for Android. If not found, returns null and logs a warning.
 * @returns {Element|null} The chat element or null if not found.
 */
function androidChat() {
  const chatElement = document.querySelector("[class^='react-scroll-to-bottom']:not(.h-full)");
  if (!chatElement) {
    console.warn("Chat element not found on Android");
    showNotification("Error", "Failed to locate chat element.");
    return null;
  }
  return chatElement;
}

/**
 * Updates the scroll position of the context menu on Android.
 */
function updateScroll() {
  const chatElement = androidChat();
  if (chatElement) {
    const contextMenuElement = document.getElementById("contextMenu");
    if (contextMenuElement) {
      contextMenuElement.style.top = `${state.contextMenuY + window.initialScroll - chatElement.scrollTop}px`;
    }
  }
}

/**
 * Observes chat mutations and adds copy buttons to new messages.
 */
function observeChatMutation() {
  const chatContainer = document.querySelector(".pb-9")?.parentElement;
  if (chatContainer) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const messageElement = IS_ANDROID ? node.querySelector(".agent-turn") : node.querySelector(".pt-0.5");
              if (messageElement && !messageElement.querySelector(".copy_eq_btn")) {
                addCopyButtons(IS_ANDROID ? messageElement.querySelector(".font-semibold") : messageElement);
              }
            }
          });
        }
      });
    });
    observer.observe(chatContainer, { childList: true, subtree: true });
    state.chat = chatContainer;
    chatContainer.addEventListener("scroll", removeContextMenu);
  } else {
    showNotification("Error", "Failed to locate chat container for mutation observer.");
  }
}

/**
 * Adds copy buttons to a message element.
 * @param {Element} element - The message element to add buttons to.
 */
function addCopyButtons(element) {
  // Check if the buttons already exist to prevent duplicates
  if (!element.querySelector(".copy_eq_btn")) {
    const copyMathMLBtn = createCopyButton("Copy to Word (MathML)", "mathml");
    const copyLatexBtn = createCopyButton("Copy to LaTeX", "latex");
    const copyExcelBtn = createCopyButton("Copy to Excel (Formula)", "excel");

    element.appendChild(copyMathMLBtn);
    element.appendChild(copyLatexBtn);
    element.appendChild(copyExcelBtn);

    attachCopyEvent(copyMathMLBtn, element, "copyMathML");
    attachCopyEvent(copyLatexBtn, element, "copyLaTeX");
    attachCopyEvent(copyExcelBtn, element, "copyExcel");
  }
}

/**
 * Creates a copy button element with the appropriate attributes.
 * @param {string} label - The label for the button.
 * @param {string} type - The type of button (mathml, latex, or excel).
 * @returns {HTMLElement} The created button element.
 */
function createCopyButton(label, type) {
  const button = document.createElement("div");
  button.className = "copy_eq_btn";
  button.textContent = label;
  button.setAttribute('data-type', type.toLowerCase());
  return button;
}

/**
 * Attaches a click event listener to a copy button.
 * @param {HTMLElement} button - The button element to attach the event to.
 * @param {Element} element - The parent element containing the content to copy.
 * @param {string} type - The type of content to copy (copyMathML, copyLaTeX, or copyExcel).
 */
function attachCopyEvent(button, element, type) {
  button.addEventListener("click", () => {
    const sibling = IS_ANDROID ? element.nextSibling : element.parentElement.parentElement.nextSibling;
    copyAll(sibling, type);
  });
}

// Event listeners
document.addEventListener("click", removeContextMenu);
document.addEventListener("keydown", removeContextMenu);
if (!IS_ANDROID) window.addEventListener("resize", removeContextMenu);
if (!IS_CHATGPT && !IS_ANDROID) document.addEventListener("scroll", removeContextMenu);
document.addEventListener("contextmenu", openContextMenu);

/**
 * Opens the context menu at the specified coordinates.
 * @param {MouseEvent} event - The context menu event.
 */
function openContextMenu(event) {
  removeContextMenu();
  let targetElement;
  
  if (IS_CHATGPT) {
    targetElement = findKatexElement(event.clientX, event.clientY);
  } else if (IS_WIKIPEDIA) {
    targetElement = findMweElement(event.clientX, event.clientY);
  } else {
    targetElement = findFormulaElement(event.clientX, event.clientY);
  }
  
  if (targetElement) {
    event.preventDefault();

    if (IS_ANDROID) {
      const chatElement = androidChat();
      if (chatElement) {
        window.initialScroll = chatElement.scrollTop;
        chatElement.addEventListener("scroll", updateScroll);
      }
    }

    createContextMenu(event.clientX, event.clientY, targetElement);
  } else {
    showNotification("Error", "Failed to locate a math element for the context menu.");
  }
}

/**
 * Creates and appends the context menu to the document.
 * @param {number} x - The x-coordinate for the context menu.
 * @param {number} y - The y-coordinate for the context menu.
 * @param {Element} targetElement - The element that triggered the context menu.
 */
function createContextMenu(x, y, targetElement) {
  state.contextMenuX = IS_ANDROID ? targetElement.getBoundingClientRect().right + 7 : x;
  state.contextMenuY = IS_ANDROID ? targetElement.getBoundingClientRect().top - 23 - document.body.clientHeight : y;

  const darkModeClass = isDarkMode() ? 'dark-mode' : 'light-mode';
  const contextMenuHTML = `
    <div id="contextMenu" class="${darkModeClass}" ${IS_ANDROID ? '' : 'desktop'} style="left: ${state.contextMenuX}px; top: ${state.contextMenuY + window.scrollY}px;">
      <div class="title">ChromeGPT</div>
      <div id="copyMathML" class="copy_eq_btn" data-type="mathml">Copy to Word (MathML)</div>
      <div id="copyLaTeX" class="copy_eq_btn" data-type="latex">Copy to LaTeX</div>
      <div id="copyExcel" class="copy_eq_btn" data-type="excel">Copy to Excel (Formula)</div>
    </div>`;
  
  state.contextMenu = document.createElement('div');
  state.contextMenu.innerHTML = contextMenuHTML;
  document.body.appendChild(state.contextMenu);

  document.getElementById("copyMathML").addEventListener("click", () => checkAndCopy(targetElement, "copyMathML"));
  document.getElementById("copyLaTeX").addEventListener("click", () => checkAndCopy(targetElement, "copyLaTeX"));
  document.getElementById("copyExcel").addEventListener("click", () => checkAndCopy(targetElement, "copyExcel"));
}

/**
 * Removes the context menu from the document.
 */
function removeContextMenu() {
  if (state.contextMenu) {
    state.contextMenu.remove();
    const chatElement = androidChat();
    if (chatElement) chatElement.removeEventListener("scroll", updateScroll);
  }
}

/**
 * Checks if coordinates are within an element with specified class names.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {string[]} classNames - Array of class names to check.
 * @param {function} callback - Function to call if coordinates are within an element.
 * @returns {Element|null} The found element or null.
 */
function isWithin(x, y, classNames, callback) {
  let elements = [];
  classNames.forEach(className => {
    elements = elements.concat([...document.getElementsByClassName(className)]);
  });
  
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return callback(element);
    }
  }
  return null;
}

// Element finders
const findMweElement = (x, y) => isWithin(x, y, ["mwe-math-fallback-image-inline", "mwe-math-fallback-image-display"], el => el.parentElement);
const findKatexElement = (x, y) => isWithin(x, y, ["katex"], el => el);

/**
 * Finds a formula element at the specified coordinates for general websites.
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @returns {Element|null} The found element or null.
 */
function findFormulaElement(x, y) {
  const element = document.elementFromPoint(x, y);
  if (element) {
    // Check if the element or its ancestors contain a formula
    let currentElement = element;
    while (currentElement) {
      if (isFormulaElement(currentElement)) {
        return currentElement;
      }
      currentElement = currentElement.parentElement;
    }
  }
  return null;
}

/**
 * Checks if an element contains a formula.
 * @param {Element} element - The element to check.
 * @returns {boolean} True if the element contains a formula, false otherwise.
 */
function isFormulaElement(element) {
  // Check for common formula indicators
  const formulaIndicators = [
    'math',
    'katex',
    'MathJax',
    'latex',
    'equation',
    'formula',
    'mwe-math-fallback-image-inline',
    'mwe-math-fallback-image-display',
    'mjx-math',
    'mjx-container',
    'mathjax-container',
    'tex-math',
    'asciimath',
    'mathml',
    'math-tex',
    'math-ascii',
    'math-inline',
    'math-display',
    'math-block',
    'math-container',
    'math-element',
    'math-renderer',
    'math-processed',
    'math-output',
    'math-source'
  ];
  
  // Check element's class, id, and data attributes
  for (const indicator of formulaIndicators) {
    if (element.className.includes(indicator) ||
        element.id.includes(indicator) ||
        element.getAttribute('data-formula') === 'true' ||
        element.tagName.toLowerCase() === indicator) {
      return true;
    }
  }
  
  // Check for MathML elements
  if (element.namespaceURI === 'http://www.w3.org/1998/Math/MathML') {
    return true;
  }
  
  // Check for LaTeX-like content
  const text = element.textContent;
  if (text.includes('\\') && (text.includes('{') || text.includes('$'))) {
    return true;
  }
  
  // Check for AsciiMath-like content
  if (text.match(/`[^`]+`/)) {
    return true;
  }
  
  // Check for common LaTeX commands
  const latexCommands = ['\\frac', '\\sqrt', '\\sum', '\\int', '\\lim', '\\prod', '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\theta', '\\pi', '\\sigma', '\\omega'];
  for (const command of latexCommands) {
    if (text.includes(command)) {
      return true;
    }
  }
  
  // Check for SVG-based formulas
  if (element.tagName.toLowerCase() === 'svg' && element.getAttribute('aria-label')?.includes('equation')) {
    return true;
  }
  
  // Check for image-based formulas
  if (element.tagName.toLowerCase() === 'img' && (element.alt?.includes('equation') || element.src?.includes('math'))) {
    return true;
  }
  
  return false;
}

/**
 * Extracts formula content from an element.
 * @param {Element} element - The element containing the formula.
 * @returns {string} The extracted formula content.
 */
function extractFormulaContent(element) {
  // Check for MathML
  const mathML = element.querySelector('math') || element.closest('math');
  if (mathML) {
    return mathML.outerHTML;
  }
  
  // Check for LaTeX
  const latex = element.querySelector('.katex-mathml annotation[encoding="application/x-tex"]') ||
                element.querySelector('script[type="math/tex"]');
  if (latex) {
    return latex.textContent;
  }
  
  // Check for MathJax
  const mathJax = element.querySelector('.MathJax_Preview + script[type="math/tex"]');
  if (mathJax) {
    return mathJax.textContent;
  }
  
  // Check for AsciiMath
  const asciiMath = element.textContent.match(/`([^`]+)`/);
  if (asciiMath) {
    return asciiMath[1];
  }
  
  // Check for image-based formulas
  const img = element.querySelector('img[alt]') || (element.tagName.toLowerCase() === 'img' ? element : null);
  if (img && img.alt) {
    return img.alt;
  }
  
  // Check for SVG-based formulas
  if (element.tagName.toLowerCase() === 'svg' && element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label');
  }
  
  // Fallback to element's text content
  return element.textContent.trim();
}

/**
 * Converts LaTeX or MathML to Excel formula.
 * @param {string} input - The LaTeX, MathML, or AsciiMath string to convert.
 * @returns {string} The converted Excel formula.
 */
function convertToExcel(input) {
  if (input.startsWith('<math')) {
    return convertMathMLToExcel(input);
  } else if (input.includes('\\') || input.includes('$')) {
    return convertLaTeXToExcel(input);
  } else if (input.match(/`[^`]+`/)) {
    return convertAsciiMathToExcel(input);
  } else {
    // Assume it's plain text or an unrecognized format
    return '=' + input.replace(/\s+/g, '');
  }
}

/**
 * Converts MathML to Excel formula.
 * @param {string} mathml - The MathML string to convert.
 * @returns {string} The converted Excel formula.
 */
function convertMathMLToExcel(mathml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mathml, 'text/xml');
  const mathNode = doc.querySelector('math');
  
  function processNode(node) {
    switch (node.tagName) {
      case 'mn':
      case 'mi':
        return node.textContent;
      case 'mo':
        return node.textContent === '×' ? '*' : node.textContent;
      case 'mfrac':
        const num = processNode(node.children[0]);
        const den = processNode(node.children[1]);
        return `(${num})/(${den})`;
      case 'msqrt':
        return `SQRT(${processNode(node.children[0])})`;
      case 'mroot':
        const base = processNode(node.children[0]);
        const exp = processNode(node.children[1]);
        return `POWER(${base},1/${exp})`;
      case 'msup':
        const baseSuper = processNode(node.children[0]);
        const expSuper = processNode(node.children[1]);
        return `POWER(${baseSuper},${expSuper})`;
      case 'mrow':
        return Array.from(node.children).map(processNode).join('');
      default:
        return node.textContent;
    }
  }
  
  return '=' + processNode(mathNode);
}

/**
 * Converts LaTeX to Excel formula.
 * @param {string} latex - The LaTeX string to convert.
 * @returns {string} The converted Excel formula.
 */
function convertLaTeXToExcel(latex) {
  let formula = latex.replace(/\s+/g, '');
  
  // Replace common LaTeX operations with Excel equivalents
  formula = formula.replace(/\\frac{([^}]*)}{([^}]*)}/g, '($1)/($2)');
  formula = formula.replace(/\\sqrt{([^}]*)}/g, 'SQRT($1)');
  formula = formula.replace(/\\sqrt\[(\d+)]{([^}]*)}/g, 'POWER($2,1/$1)');
  formula = formula.replace(/([a-zA-Z0-9)]}])\\^{([^}]*)}/g, 'POWER($1,$2)');
  formula = formula.replace(/\\sum/g, 'SUM');
  formula = formula.replace(/\\prod/g, 'PRODUCT');
  formula = formula.replace(/\\pi/g, 'PI()');
  formula = formula.replace(/\\exp/g, 'EXP');
  formula = formula.replace(/\\ln/g, 'LN');
  formula = formula.replace(/\\log/g, 'LOG');
  formula = formula.replace(/\\sin/g, 'SIN');
  formula = formula.replace(/\\cos/g, 'COS');
  formula = formula.replace(/\\tan/g, 'TAN');
  
  // Remove any remaining LaTeX commands
  formula = formula.replace(/\\/g, '');
  
  // Replace curly braces with parentheses
  formula = formula.replace(/{/g, '(').replace(/}/g, ')');
  
  // Remove dollar signs used for LaTeX math mode
  formula = formula.replace(/\$/g, '');
  
  return '=' + formula;
}

/**
 * Converts AsciiMath to Excel formula.
 * @param {string} asciimath - The AsciiMath string to convert.
 * @returns {string} The converted Excel formula.
 */
function convertAsciiMathToExcel(asciimath) {
  let formula = asciimath.replace(/`/g, '').replace(/\s+/g, '');
  
  // Replace common AsciiMath operations with Excel equivalents
  formula = formula.replace(/(\d+)\/(\d+)/g, '($1)/($2)');
  formula = formula.replace(/sqrt\(([^)]*)\)/g, 'SQRT($1)');
  formula = formula.replace(/root\((\d+)\)\(([^)]*)\)/g, 'POWER($2,1/$1)');
  formula = formula.replace(/([a-zA-Z0-9)]])\\^(\d+)/g, 'POWER($1,$2)');
  formula = formula.replace(/sum/g, 'SUM');
  formula = formula.replace(/prod/g, 'PRODUCT');
  formula = formula.replace(/pi/g, 'PI()');
  formula = formula.replace(/exp/g, 'EXP');
  formula = formula.replace(/ln/g, 'LN');
  formula = formula.replace(/log/g, 'LOG');
  formula = formula.replace(/sin/g, 'SIN');
  formula = formula.replace(/cos/g, 'COS');
  formula = formula.replace(/tan/g, 'TAN');
  
  return '=' + formula;
}

/**
 * Copies text to the clipboard.
 * @param {string} text - The text to copy.
 * @returns {Promise<void>}
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text.trim());
  } catch (err) {
    console.error('Failed to copy text: ', err);
    showNotification("Error", "Failed to copy to clipboard.");
  }
}

/**
 * Checks the content of an element based on the copy type.
 * @param {Element} element - The element to check.
 * @param {string} type - The type of content to check for (copyMathML, copyLaTeX, or copyExcel).
 * @returns {string} The checked content.
 */
function check(element, type) {
  try {
    if (IS_CHATGPT || IS_WIKIPEDIA) {
      // Use existing logic for ChatGPT and Wikipedia
      if (type === "copyMathML") {
        const annotation = element.querySelector("annotation")?.textContent;
        return annotation === "\\displaystyle" ? "\\displaystyle" : element.querySelector("math")?.outerHTML || "";
      }
      if (type === "copyLaTeX") {
        const latex = element.querySelector("annotation")?.textContent || "";
        return latex.replace("\\displaystyle", "");
      }
      if (type === "copyExcel") {
        const latex = element.querySelector("annotation")?.textContent || "";
        return convertToExcel(latex.replace("\\displaystyle", ""));
      }
    } else {
      // Handle general formula elements
      const content = extractFormulaContent(element);
      if (type === "copyMathML") {
        return content.includes('<math') ? content : '';
      }
      if (type === "copyLaTeX") {
        return content.includes('\\') || content.match(/`[^`]+`/) ? content : '';
      }
      if (type === "copyExcel") {
        return convertToExcel(content);
      }
    }
    return "";
  } catch (err) {
    console.error('Error in check function: ', err);
    showNotification("Error", "Failed to check element content.");
    return "";
  }
}

/**
 * Checks and copies content based on element and type.
 * @param {Element} element - The element to check and copy from.
 * @param {string} type - The type of content to copy (copyMathML, copyLaTeX, or copyExcel).
 */
async function checkAndCopy(element, type) {
  try {
    const content = check(element, type);
    if (!content) {
      showNotification("Error", `Failed to copy content as ${type}`);
      return;
    }
    await copyToClipboard(content);
    showNotification("Success", `Copied content as ${type.replace("copy", "")}`);
  } catch (err) {
    console.error('Error in checkAndCopy function: ', err);
    showNotification("Error", "Failed to check and copy content.");
  }
}

/**
 * Copies all relevant content from an element.
 * @param {Element} element - The element to copy from.
 * @param {string} type - The type of content to copy (copyMathML, copyLaTeX, or copyExcel).
 */
async function copyAll(element, type) {
  try {
    const doc = parser.parseFromString(element.innerHTML, 'text/html');
    [...doc.querySelectorAll(".math")].forEach((mathElement) => {
      const string = check(mathElement, type)
        .replaceAll("&lt;", "&amp;lt;")
        .replaceAll("&gt;", "&amp;gt;");
      mathElement.outerHTML = type === "copyLaTeX" ? `$${string}$` : 
                              type === "copyExcel" ? string :
                              string;
    });

    let contentString = doc.body.textContent || "";

    if (type === "copyMathML") {
      contentString = contentString.replaceAll("</math>\n+", "</math>\n");
    }

    if (!contentString.trim()) {
      showNotification("Error", "No content found to copy.");
      return;
    }

    await copyToClipboard(contentString.trim());
    showNotification("Success", `Copied all content as ${type.replace("copy", "")}`);
  } catch (err) {
    console.error('Error in copyAll function: ', err);
    showNotification("Error", "Failed to copy all content.");
  }
}

// Initialize the extension
if (IS_CHATGPT) {
  observeChatMutation();
}

// Add event listener for context menu on all websites
document.addEventListener("contextmenu", openContextMenu);
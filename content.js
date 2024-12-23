console.log("Content script loaded");

// 遠程 JSON 文件 URL
const keywordsUrl = "https://raw.githubusercontent.com/nkxrfxforum/OrphanSavior/refs/heads/main/keywords.json";

// 緩存變數
let keywordPairs = null;
let lastFetchedTime = 0;
const cacheDuration = 300000; // 緩存有效時間（5分鐘）

// 儲存延遲計時器
let inputTimer = null;
const inputDelay = 3000; // 延遲 3000ms 進行替換，這樣能有更高的處理效率

// 函數：讀取關鍵字映射（使用緩存機制）
async function fetchKeywords() {
  const currentTime = Date.now();

  if (keywordPairs && currentTime - lastFetchedTime < cacheDuration) {
    console.log("Using cached keywords...");
    return keywordPairs;
  }

  try {
    const response = await fetch(keywordsUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    keywordPairs = await response.json();
    lastFetchedTime = currentTime;
    console.log("Keywords loaded and cached:", keywordPairs);
    return keywordPairs;
  } catch (error) {
    console.error("Error loading keywords:", error);
    return null;
  }
}

// 函數：即時替換節點內容
function replaceKeywordsInNode(node) {
  if (!keywordPairs || isInInputField(node)) return;

  const regexMap = Object.entries(keywordPairs).map(([original, replacement]) => ({
      regex: new RegExp(`^${original}$`, "gi"),
    replacement,
  }));

  if (node.nodeType === 3) {
    let text = node.nodeValue;
    regexMap.forEach(({ regex, replacement }) => {
      text = text.replace(regex, replacement);
    });
    node.nodeValue = text; // 更新節點內容
  }
}

// 函數：判斷節點是否在輸入框或可編輯元素中
function isInInputField(node) {
  const parent = node.parentNode;
  if (!parent) return false;
  const tagName = parent.tagName?.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    parent.isContentEditable
  );
}

// 處理外部文本的替換
function replaceKeywordsInDocument() {
  if (!keywordPairs) return;

  const textNodes = getTextNodes(document.body);
  textNodes.forEach(node => replaceKeywordsInNode(node));
}

// 獲取文本節點
function getTextNodes(node) {
  let textNodes = [];
  if (node.nodeType === 3) {
    textNodes.push(node);
  } else {
    node.childNodes.forEach((childNode) => {
      textNodes = textNodes.concat(getTextNodes(childNode));
    });
  }
  return textNodes;
}

// 處理輸入框的替換，並且將替換延遲
function handleInputEvent(e) {
  if (inputTimer) {
    clearTimeout(inputTimer); // 清除上次計時器
  }

  // 延遲處理，讓用戶停止輸入後再進行處理
  inputTimer = setTimeout(() => {
    const inputNode = e.target;
    if (isInInputField(inputNode)) return; // 只處理輸入框外的內容

    const text = inputNode.value;
    const regexMap = Object.entries(keywordPairs).map(([original, replacement]) => ({
        regex: new RegExp(`^${original}$`, "gi"),
      replacement,
    }));

    let updatedText = text;
    regexMap.forEach(({ regex, replacement }) => {
      updatedText = updatedText.replace(regex, replacement);
    });

    // 只有在文本發生變化時才更新
    if (updatedText !== text) {
      inputNode.value = updatedText;
    }
  }, inputDelay);
}

// 使用 MutationObserver 動態監控 DOM 變化
function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 3) {
          // 直接替換文本節點
          replaceKeywordsInNode(node);
        } else if (node.nodeType === 1) {
          // 遍歷新插入的子節點
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: (currentNode) => {
              if (!currentNode.nodeValue.trim() || isInInputField(currentNode)) {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          });
          while (walker.nextNode()) {
            replaceKeywordsInNode(walker.currentNode);
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("MutationObserver started.");
}

// 初始化函數
(async function initialize() {
  await fetchKeywords(); // 加載關鍵字
  observeDOMChanges(); // 開啟 DOM 監控

  // 監聽輸入框輸入事件
  document.body.addEventListener("input", (e) => {
    if (isInInputField(e.target)) {
      handleInputEvent(e); // 只對輸入框進行延遲處理
    }
  });
})();

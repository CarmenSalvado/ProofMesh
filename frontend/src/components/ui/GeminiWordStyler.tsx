"use client";

import { useEffect } from "react";

const GEMINI_REGEX = /gemini/gi;
const GEMINI_SCAN_REGEX = /gemini/i;

function shouldSkipNode(textNode: Text): boolean {
  const parent = textNode.parentElement;
  if (!parent) return true;

  if (parent.closest(".gemini-word")) return true;
  if (parent.closest("[data-no-gemini-style]")) return true;
  if (parent.closest("[contenteditable='true']")) return true;
  if (parent.closest("script, style, noscript, textarea, input, code, pre, kbd, samp, var")) return true;

  return false;
}

function decorateTextNode(textNode: Text): void {
  const text = textNode.nodeValue;
  if (!text || !GEMINI_SCAN_REGEX.test(text)) return;
  if (shouldSkipNode(textNode)) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  text.replace(GEMINI_REGEX, (match, offset: number) => {
    if (offset > cursor) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, offset)));
    }

    const span = document.createElement("span");
    span.className = "gemini-word";
    span.textContent = match;
    fragment.appendChild(span);

    cursor = offset + match.length;
    return match;
  });

  if (cursor === 0) return;
  if (cursor < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
}

function decorateGeminiWords(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const textNode = node as Text;
      if (!textNode.nodeValue || !GEMINI_SCAN_REGEX.test(textNode.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      return shouldSkipNode(textNode)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach(decorateTextNode);
}

export function GeminiWordStyler() {
  useEffect(() => {
    decorateGeminiWords(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          decorateGeminiWords(addedNode);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}


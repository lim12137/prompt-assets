"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isPlainLeftClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function isSameOriginNavigation(anchor) {
  if (!anchor.href || anchor.target || anchor.hasAttribute("download")) {
    return false;
  }
  const targetUrl = new URL(anchor.href);
  const currentUrl = new URL(window.location.href);
  return targetUrl.origin === currentUrl.origin && targetUrl.href !== currentUrl.href;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef(null);
  const maxTimerRef = useRef(null);
  const pendingPathRef = useRef(null);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!isPlainLeftClick(event)) {
        return;
      }
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || !isSameOriginNavigation(anchor)) {
        return;
      }

      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(maxTimerRef.current);
      pendingPathRef.current = window.location.pathname;
      setVisible(true);
      maxTimerRef.current = window.setTimeout(() => {
        pendingPathRef.current = null;
        setVisible(false);
      }, 10000);
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(maxTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible || pendingPathRef.current === null || pendingPathRef.current === pathname) {
      return;
    }
    window.clearTimeout(maxTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      pendingPathRef.current = null;
      setVisible(false);
    }, 650);
  }, [pathname, visible]);

  return (
    <div
      role="status"
      aria-label="页面加载状态"
      aria-hidden={!visible}
      aria-live="polite"
      className={`pm-navigation-feedback ${visible ? "visible" : ""}`}
    >
      <span className="pm-loading-spinner" aria-hidden="true" />
      页面加载中...
    </div>
  );
}

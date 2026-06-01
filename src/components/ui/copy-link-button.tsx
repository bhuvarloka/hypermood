"use client";

import { useCallback, useState } from "react";

type Props = {
  url: string;
  ariaLabel?: string;
  className?: string;
};

export function CopyLinkButton({
  url,
  ariaLabel = "Copy public link",
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    const resolved = url.startsWith("http")
      ? url
      : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
    navigator.clipboard.writeText(resolved);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [url]);

  return (
    <button
      onClick={copy}
      className={`text-sm text-primary-400 animate-swiss hover:text-primary-900 shrink-0${
        className ? ` ${className}` : ""
      }`}
      aria-label={ariaLabel}
    >
      {copied ? "copied!" : "copy"}
    </button>
  );
}

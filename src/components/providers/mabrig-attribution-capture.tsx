"use client";

import { useEffect } from "react";

import { browserAttributionToken } from "@/lib/mabrig-attribution-client";

export function MabrigAttributionCapture() {
  useEffect(() => {
    browserAttributionToken();
  }, []);

  return null;
}

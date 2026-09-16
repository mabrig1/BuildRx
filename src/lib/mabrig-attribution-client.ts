export function browserAttributionToken() {
  if (typeof window === "undefined") return "";
  const parameter = "mabrig_attribution";

  try {
    const urlToken = new URL(window.location.href).searchParams.get(parameter) || "";
    if (urlToken) {
      window.sessionStorage.setItem("mabrig_attribution_v1", urlToken);
      window.localStorage.setItem("mabrig_attribution_v1", urlToken);
      return urlToken;
    }

    return (
      window.sessionStorage.getItem("mabrig_attribution_v1") ||
      window.localStorage.getItem("mabrig_attribution_v1") ||
      ""
    );
  } catch {
    return "";
  }
}

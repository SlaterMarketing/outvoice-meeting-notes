/**
 * Plain-language copy for Chrome runtime errors (reloaded extension, etc.).
 * Loaded before content overlay and popup scripts.
 */
(function () {
  const STALE_CONTEXT = /Extension context invalidated|message port closed|Receiving end does not exist|The message port closed before a response was received/i;

  /**
   * @param {unknown} err
   */
  globalThis.outvoiceFriendlyRuntimeError = function (err) {
    const s =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : String(err);
    if (STALE_CONTEXT.test(s)) {
      return "Outvoice restarted. Refresh this page, then try again.";
    }
    return s;
  };
})();

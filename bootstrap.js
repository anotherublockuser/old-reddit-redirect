(() => {
  const markerParam = "old_reddit_redirect";
  const blockText = "Your request has been blocked due to a network policy";
  const cookiePattern = /(?:^|;\s*)(loid|csrf_token)=/;
  const timeoutMs = 45000;
  const challengeParams = ["solution", "js_challenge", "token", "jsc_orig_r"];
  const url = new URL(location.href);

  const hasMarker = (url) => url.searchParams.has(markerParam);
  const isBlockPage = () => document.body?.innerText.includes(blockText);

  const cleanMarker = (url) => {
    if (hasMarker(url)) {
      url.searchParams.delete(markerParam);
      history.replaceState(null, "", url.href);
    }
  };

  const redirectToWarmup = (url) => {
    url.hostname = "sh.reddit.com";
    url.searchParams.set(markerParam, "1");
    location.replace(url.href);
  };

  const returnToOldReddit = () => {
    const returnUrl = new URL(location.href);
    returnUrl.hostname = "old.reddit.com";

    for (const name of challengeParams) {
      returnUrl.searchParams.delete(name);
    }

    location.replace(returnUrl.href);
  };

  const waitForRedditCookie = () => {
    const startedAt = Date.now();
    const checkCookie = () => {
      if (cookiePattern.test(document.cookie)) {
        returnToOldReddit();
        return;
      }

      if (Date.now() - startedAt < timeoutMs) {
        setTimeout(checkCookie, 250);
      }
    };

    checkCookie();
  };

  const handleOldReddit = (url) => {
    if (!isBlockPage()) {
      cleanMarker(url);
      return;
    }

    if (!hasMarker(url)) {
      redirectToWarmup(url);
    }
  };

  const handleWwwReddit = (url) => {
    if (hasMarker(url)) {
      waitForRedditCookie();
    }
  };

  if (url.hostname === "old.reddit.com") {
    handleOldReddit(url);
    return;
  }

  if (url.hostname === "www.reddit.com") {
    handleWwwReddit(url);
  }
})();

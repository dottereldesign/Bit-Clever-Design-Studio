(() => {
  const visible = element => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom <= 0 || box.right <= 0 || box.top >= innerHeight || box.left >= innerWidth) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  return [...document.querySelectorAll('input[type=password],[role=dialog],#onetrust-banner-sdk,#CybotCookiebotDialog,iframe[src*=captcha]')].some(visible)
    || /just a moment|verify you are human|checking your browser/i.test(document.title);
})()

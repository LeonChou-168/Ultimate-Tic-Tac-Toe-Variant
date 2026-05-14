from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        viewport={"width": 1440, "height": 1200}, device_scale_factor=2
    )
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.locator("text=进入主菜单").click()
    page.wait_for_timeout(300)
    page.locator("text=本地双人").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)

    page.screenshot(path="/tmp/uttv-board.png", full_page=True)

    seam_info = page.evaluate(
        """
        () => {
          const boards = Array.from(document.querySelectorAll('.small-board'));
          const target = boards[6];
          const next = boards[7];
          if (!target || !next) {
            return { error: 'boards missing' };
          }

          const targetRect = target.getBoundingClientRect();
          const nextRect = next.getBoundingClientRect();
          const targetStyle = getComputedStyle(target);
          const nextStyle = getComputedStyle(next);

          return {
            targetRect: {
              left: targetRect.left,
              right: targetRect.right,
              top: targetRect.top,
              bottom: targetRect.bottom,
            },
            nextRect: {
              left: nextRect.left,
              right: nextRect.right,
              top: nextRect.top,
              bottom: nextRect.bottom,
            },
            targetBoxShadow: targetStyle.boxShadow,
            nextBoxShadow: nextStyle.boxShadow,
            targetBorderRight: targetStyle.borderRight,
            nextBorderLeft: nextStyle.borderLeft,
            targetClasses: target.className,
            nextClasses: next.className,
          };
        }
        """
    )

    print(seam_info)
    browser.close()

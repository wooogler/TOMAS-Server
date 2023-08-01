import { Page } from "puppeteer";

const NO_PAGE_ERROR = new Error("Cannot find a page.");

export async function getHiddenElementIs(page: Page | null) {
  if (page) {
    const hiddenElementIs = await page.evaluate(() => {
      const hiddenElementIs: string[] = [];
      const elements = document.body.querySelectorAll("*");

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isHiddenByClip = style.clip === "rect(0px, 0px, 0px, 0px)";
        const isHiddenByClipPath = style.clipPath === "inset(100%)";
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.left > window.innerWidth ||
          rect.right < 0 ||
          style.visibility === "hidden" ||
          style.display === "none" ||
          isHiddenByClip ||
          isHiddenByClipPath
        ) {
          const i = el.getAttribute("i");
          if (i) hiddenElementIs.push(i);
          return;
        }
      });

      return hiddenElementIs;
    });

    return hiddenElementIs;
  }
  throw NO_PAGE_ERROR;
}

export async function addIAttribute(page: Page): Promise<void> {
  if (page) {
    await page.evaluate(() => {
      let idCounter = 0;
      const elements = Array.from(document.body.querySelectorAll("*"));

      // Add 'i' attribute to the body element
      document.body.setAttribute("i", String(idCounter));
      idCounter++;

      // Check existing 'i' attribute values and set the start value
      elements.forEach((el: Element) => {
        if (el.hasAttribute("i")) {
          const currentIValue = Number(el.getAttribute("i"));
          if (currentIValue >= idCounter) {
            idCounter = currentIValue + 1;
          }
        }
      });

      // Make sure that new 'i' values do not overlap with existing ones
      idCounter += 100;

      // Add 'i' attribute to elements that do not have it yet
      elements.forEach((el: Element) => {
        if (!el.hasAttribute("i")) {
          el.setAttribute("i", String(idCounter));
          idCounter++;
        }
      });
    });
  } else {
    throw NO_PAGE_ERROR;
  }
}

async function findModals(
  page: Page,
  hiddenElementIs: string[]
): Promise<{ i: string; html: string; zIndex: number }[]> {
  return await page.evaluate((hiddenElementIs) => {
    const MIN_MODAL_SIZE = 120; // 예시: 모달이 가져야 할 최소 크기
    const MIN_Z_INDEX = 5; // 예시: 모달로 간주되려면 최소한 얼마나 높은 z-index를 가져야 하는지

    const filterHiddenElements = (
      html: string,
      hiddenElementIs: string[]
    ): string => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      hiddenElementIs.forEach((hiddenI) => {
        const hiddenEl = doc.querySelector(`[i="${hiddenI}"]`);
        if (hiddenEl) hiddenEl.remove();
      });
      return doc.body.innerHTML; // <body> 태그 내부의 HTML만 반환
    };

    const modals: { i: string; html: string; zIndex: number }[] = [];
    const elements = Array.from(document.body.querySelectorAll("*")).filter(
      (el) => {
        const iAttr = el.getAttribute("i");
        return iAttr && !hiddenElementIs.includes(iAttr);
      }
    );

    elements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(el);
      const isPositioned =
        style.position === "fixed" || style.position === "absolute";
      const isLargeEnough =
        htmlEl.offsetWidth > MIN_MODAL_SIZE &&
        htmlEl.offsetHeight > MIN_MODAL_SIZE;
      const zIndex = parseInt(style.zIndex, 10);

      if (isPositioned && isLargeEnough && zIndex >= MIN_Z_INDEX) {
        const containsInteractiveElement =
          el.querySelector("button, a, input, select, textarea") != null;
        if (containsInteractiveElement) {
          const i = el.getAttribute("i");
          if (i) {
            const filteredHtml = filterHiddenElements(
              el.outerHTML,
              hiddenElementIs
            );
            modals.push({ i, html: filteredHtml, zIndex });
          }
        }
      }
    });

    console.log("modals: ", modals);

    return modals;
  }, hiddenElementIs);
}

function getTopmostModal(
  modals: { i: string; html: string; zIndex: number }[]
): { i: string; html: string } | null {
  if (modals.length === 0) return null;

  return modals.reduce((topmost, current) => {
    return current.zIndex > topmost.zIndex ? current : topmost;
  });
}

export async function trackModalChanges(
  page: Page,
  action: () => Promise<void>
): Promise<{ modalI: string | null; html: string }> {
  // Initial check for modals
  const initialHiddenElementIs = await getHiddenElementIs(page);
  const initialModals = await findModals(page, initialHiddenElementIs);

  // Perform the given action
  await action();
  await new Promise((r) => setTimeout(r, 500));

  await addIAttribute(page);

  // Recheck for modals
  const finalHiddenElementIs = await getHiddenElementIs(page);
  const finalModals = await findModals(page, finalHiddenElementIs);
  const topmostModal = getTopmostModal(finalModals);

  console.log(topmostModal ? topmostModal.i : "original");

  // Compare initial and final modals to determine changes
  if (initialModals.length === 0 && finalModals.length === 0) {
    const html = await page.content();
    return { modalI: null, html };
  } else if (initialModals.length === 0 && finalModals.length > 0) {
    // New modal appeared
    return {
      modalI: topmostModal?.i || null,
      html: topmostModal?.html || "",
    };
  } else if (initialModals.length > 0 && finalModals.length === 0) {
    // Modal disappeared
    const html = await page.content();
    return { modalI: null, html };
  } else {
    // Modal changed or stayed the same
    return {
      modalI: topmostModal?.i || null,
      html: topmostModal?.html || "",
    };
  }
}

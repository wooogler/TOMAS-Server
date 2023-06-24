import dotenv from "dotenv";
import express, { Request, Response } from "express";
import puppeteer, { Browser, Page } from "puppeteer";
import { JSDOM } from "jsdom";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT;
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const simplifyNestedStructure = (element: Element, targetTags: string[]) => {
  let currentElement = element;
  while (
    targetTags.includes(currentElement.tagName.toLowerCase()) &&
    currentElement.children.length === 1
  ) {
    let child = currentElement.children[0];
    if (child.children.length !== 1) {
      break;
    }
    currentElement.removeChild(child);
    currentElement.appendChild(child.children[0]);
  }

  Array.from(currentElement.children).forEach((child) =>
    simplifyNestedStructure(child, targetTags)
  );
};

const containsSpecificTag = (element: Element, includeTags: string[]) => {
  if (includeTags.includes(element.tagName.toLowerCase())) {
    return true;
  }

  for (const child of Array.from(element.children)) {
    if (containsSpecificTag(child, includeTags)) {
      return true;
    }
  }

  return false;
};

const isEmptyElement = (element: Element, includeTags: string[]) => {
  return (
    !containsSpecificTag(element, includeTags) &&
    !element.textContent?.trim() &&
    !element.hasAttributes()
  );
};

const removeEmptyElements = (element: Element, includeTags: string[]) => {
  const children = Array.from(element.children);
  for (const child of children) {
    if (isEmptyElement(child, includeTags)) {
      element.removeChild(child);
    } else removeEmptyElements(child, includeTags);
  }
};

const removeAttributes = (element: Element, attributesToKeep: string[]) => {
  const attributes = Array.from(element.attributes);
  for (const attribute of attributes) {
    if (!attributesToKeep.includes(attribute.name)) {
      element.removeAttribute(attribute.name);
    }
  }

  const children = Array.from(element.children);
  for (const child of children) {
    removeAttributes(child, attributesToKeep);
  }
};

const removeSpecificTags = (element: Element, tagNames: string[]) => {
  for (const tagName of tagNames) {
    const specificTagElements = Array.from(
      element.getElementsByTagName(tagName)
    );
    for (const specificTag of specificTagElements) {
      specificTag.parentNode?.removeChild(specificTag);
    }
  }
  const children = Array.from(element.children);
  for (const child of children) {
    removeSpecificTags(child, tagNames);
  }
};

const simplifyHtml = (html: string) => {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const rootElement = document.querySelector("*");
  if (rootElement) {
    removeAttributes(rootElement, ["type", "href", "i"]);
    removeSpecificTags(rootElement, [
      "script",
      "style",
      "svg",
      "path",
      "link",
      "meta",
    ]);
    removeEmptyElements(rootElement, ["input"]);
    simplifyNestedStructure(rootElement, ["div", "span"]);
  }
  return dom.serialize().replace(/\s\s+/g, "");
};

let globalBrowser: Browser | null = null;
let globalPage: Page | null = null;

interface EnterReqBody {
  url: string;
}

app.post(
  "/enter",
  async (req: Request<{}, {}, EnterReqBody>, res: Response) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).send({ error: 'Missing "url" in request body' });
    }

    try {
      globalBrowser = await puppeteer.launch({ headless: false });
      globalPage = await globalBrowser.newPage();
      await globalPage.goto(url, {
        waitUntil: "networkidle0",
      });

      await globalPage.evaluate(() => {
        let idCounter = 0;
        const elements = document.querySelectorAll("*");
        elements.forEach((el) => {
          el.setAttribute("i", String(idCounter++));
        });
      });

      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: (error as Error).toString() });
    }
  }
);

app.get("/html", async (req: Request, res: Response) => {
  if (!globalPage) {
    return res.status(400).send({ error: "No page loaded" });
  }

  try {
    const bodyHtml = await globalPage.content();
    const simplifiedHtml = simplifyHtml(bodyHtml);
    res.status(200).send(simplifiedHtml);
  } catch (error) {
    res.status(500).send({ error: (error as Error).toString() });
  }
});

interface ClickReqBody {
  i: string;
}

app.post(
  "/click",
  async (req: Request<{}, {}, ClickReqBody>, res: Response) => {
    const { i } = req.body;

    if (!i) {
      return res.status(400).send({ error: 'Missing "i" in request body' });
    }
    if (!globalPage) {
      return res.status(400).send({ error: "No page loaded" });
    }

    try {
      await globalPage.evaluate((i) => {
        const element = document.querySelector(`[i="${i}"]`);
        if (element) {
          (element as HTMLElement).click();
        }
      }, i);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: (error as Error).toString() });
    }
  }
);

interface InputReqBody {
  i: string;
  value: string;
}

app.post(
  "/input",
  async (req: Request<{}, {}, InputReqBody>, res: Response) => {
    const { i, value } = req.body;

    if (!i || value === undefined) {
      return res
        .status(400)
        .send({ error: 'Missing "i" or "value" in request body' });
    }

    if (!globalPage) {
      return res.status(400).send({ error: "No page loaded" });
    }

    try {
      await globalPage.evaluate(
        ({ i, value }) => {
          const element = document.querySelector(`[i="${i}"]`);
          if (element && element.tagName.toLowerCase() === "input") {
            (element as HTMLInputElement).value = value;
          }
        },
        { i, value }
      );

      res.sendStatus(200);
    } catch (error) {
      res.status(500).send({ error: (error as Error).toString() });
    }
  }
);

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});

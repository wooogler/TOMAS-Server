import { simplifyItemHtml } from "../utils/htmlHandler";
import {
  Prompt,
  getAiResponse,
  getGpt4Response,
} from "../utils/langchainHandler";
import { ActionComponent, ScreenResult } from "../utils/pageHandler";
import { JSDOM } from "jsdom";
import { Action } from "../utils/parsingAgent";

export async function getUsefulAttrFromList(
  actionComponents: ActionComponent[],
  screenDescription: string
) {
  const optionList = actionComponents
    .map((item) => {
      return `"i": ${item.i}, "description": ${item.description}, "html": ${item.html}`;
    })
    .join("\n");
  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `You are the AI assistant who sees a list of items in webpage. For each item, there's a description and full html.
As a database developer, we want to create a table for those items to keep all useful information in html for user, and help user to select from those items.
Please help us to choose which attributes to keep.
Remember, our ultimate goal is to help the user to make their decision from those options based on the attribute we keep. 
Only keep the name of attributes. You do not have to keep an example of the attribute value.
The description of the webpage:${screenDescription}
The output should be like:
- <attr1>
- <attr2>
- ...

Please do not include any other information in the output.`,
    },
    {
      role: "HUMAN",
      content: `
              options: ${optionList}
            `,
    },
  ];
  const confirmation = await getAiResponse(makeListPrompts);
  const array = confirmation
    .split("\n")
    .filter((item) => item.startsWith("-"))
    .map((item) => item.replace(/^- */, "").trim());
  return array;
}

async function getAttrValueFromItem(
  longComponent: Action,
  screenDescription: string
) {
  const simpleItemHtml = simplifyItemHtml(longComponent.html);

  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Extract all useful information the users can see on the web browser for them to select the item they want. 

Description of the section where the list is located:
${screenDescription}

HTML of one item in the list:
${simpleItemHtml}

Output the attributes and values in the following JSON format:

{
  <Attribute 1>: <value 1>,
  <Attribute 2>: <value 2>,
  ...
}

Please do not include any other information in the output.`,
    },
  ];

  console.log(makeListPrompts[0].content);

  const attrValue = await getGpt4Response(makeListPrompts);
  return attrValue;
}

export async function getDataFromHTML(screen: ScreenResult) {
  // console.log(
  //   `actionDescriptions: ${screen.actionComponents
  //     .map((item) => item.description)
  //     .join("\n")}`
  // );

  const { actions, screenDescription } = screen;

  const longComponent = actions.reduce((longestItem, current) => {
    return current.html.length > longestItem.html.length
      ? current
      : longestItem;
  });
  const longElementDescType = longComponent.content?.split("-")[0];

  let results = [];

  if (true) {
    results = actions.map((comp) => comp.content);
  } else {
    const attrValue = await getAttrValueFromItem(
      longComponent,
      screenDescription
    );

    async function processComponent(component: Action) {
      const simpleItemHtml = simplifyItemHtml(component.html);
      const makeItemPrompts: Prompt[] = [
        {
          role: "SYSTEM",
          content: `Extract the information from the given HTML element using the same attribute with the example.
  
  Here is an example of another element in the same list.
  ${attrValue}
  
  HTML of the element:
  ${simpleItemHtml}
  
  Output the attributes and values in the following JSON format:
  
  {
    <attr1>: <val1>,
    <attr2>: <val2>,
    ...
  }
  
  Please do not include any other information in the output.
  `,
        },
      ];

      const jsonString = await getAiResponse(makeItemPrompts);
      const jsonObject = JSON.parse(jsonString);

      return jsonObject;
    }

    results = await Promise.all(actions.map(processComponent));
  }

  const data = results.map((item, index) => {
    return {
      data: item,
      i: actions[index].i.toString(),
      description: actions[index].description,
      actionType: actions[index].type,
      content: actions[index].content,
    };
  });
  return data;
}

export async function getListFromSelectResult(
  option: ActionComponent,
  screenDescription: string,
  attrList: string[]
) {
  const makeListPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `
You are the AI assistant who sees an option in a list from webpage. For this option, there's a description and full html.

Please find all value of corresponding attributes in attribute list for this option.

The attrList is: ${attrList.map((item) => `"${item}"`).join(", ")}

Output your result in JSON format.

The json should be in the following format:
{
    "i": <value of i>,
    "description": <description>,
    <attr1>: <value1>,
    <attr2>: <value2>, 
    <attr3>: [<value3_1>, <value3_2>...]
    ...
}

The description of the webpage:
${screenDescription}
`,
    },
    {
      role: "HUMAN",
      content: `
            option html: ${option.html}
            option description: ${option.description}
          `,
    },
  ];
  const confirmation = await getAiResponse(makeListPrompts);
  try {
    return JSON.parse(confirmation) as {
      i: string;
      description: string;
    } & Record<string, string | string[]>;
  } catch (error) {
    console.log("error in parsing json: ", error);
  }
}

export async function extractTextLabelFromHTML(
  itemHtml: string,
  screenDescription: string
) {
  const simpleItemHtml = simplifyItemHtml(itemHtml);

  const makeTextLabelPrompts: Prompt[] = [
    {
      role: "SYSTEM",
      content: `Generate the text label for the given HTML element.

Description of the section where the element is located:
${screenDescription}

HTML of the element:
${simpleItemHtml}`,
    },
  ];
  return await getAiResponse(makeTextLabelPrompts);
}

export async function reveal(page, selector) {
  const ids = await page.locator(selector).evaluate((element) => {
    const ids = [];
    for (let node = element.parentElement; node; node = node.parentElement)
      if (node.tagName === "DETAILS") ids.unshift(node.id);
    return ids;
  });
  for (const id of ids)
    if ((await page.locator("#" + id).getAttribute("open")) === null)
      await page.locator("#" + id + ">summary").click();
}
export async function click(page, selector) {
  await reveal(page, selector);
  await page.locator(selector).click();
}
export async function addSlide(page, template) {
  await page.locator("#studio-gallery-open").click();
  await page.locator('[data-template="' + template + '"]').click();
  await page.locator("#studio-gallery-apply").click();
}
export async function selectTab(page, name) {
  if (await page.locator("#we-settings-open").count()) {
    const project = [
      "Branding",
      "Presentation settings",
      "Sections",
      "Kiosk loops",
      "Recovery & reset",
    ].includes(name);
    const open = await page.locator("#we-settings").evaluate((el) => el.open);
    if (project && !open) await page.locator("#we-settings-open").click();
    else if (!project && open) await page.locator("#we-settings-close").click();
    if (name === "Content") name = "Slide";
  }
  await page.getByRole("tab", { name, exact: true }).click();
}

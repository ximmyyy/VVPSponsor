import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("mobiele navigatie: focus blijft in dialoog, Escape sluit en herstelt focus", async ({
  page,
}) => {
  await page.goto("/beheer");
  const trigger = page.getByRole("button", { name: "Navigatie openen" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("link", { name: "Overzicht" }).click();
  await expect(dialog).toHaveCount(0);
});

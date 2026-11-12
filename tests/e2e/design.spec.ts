import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [route, heading] of [
  ["/", "Samen maken we"],
  ["/beheer", "Sterke relaties."],
  ["/beheer/bestuur", "Goed inzicht."],
  ["/portaal", "Onze club."],
  ["/ontwerp", "Helder in iedere toestand."],
  ["/inloggen", "Inloggen"], ["/herstellen", "Wachtwoord herstellen"], ["/mfa", "Extra verificatie"],
]) {
  test(`${route}: responsief, toegankelijk en zonder browserfouten`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    // Wacht op hydration, zodat toetsenbord-/axe-controles echte interactieve UI toetsen.
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(244, 246, 249)",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const a11y = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(errors).toEqual([]);
    if (route === "/beheer" || route === "/portaal") {
      const nav = page.locator(".desktop-sidebar");
      if (await nav.isVisible()) {
        await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
        await expect(nav.locator("[aria-disabled='true'] a")).toHaveCount(0);
      }
    }
  });
}

test("skiplink is eerste tabstop en verplaatst focus naar hoofdinhoud", async ({
  page,
}) => {
  await page.goto("/beheer");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Direct naar inhoud" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#inhoud")).toBeFocused();
});

test("lege, fout- en laadstatus en scrollbare tabel zijn beschikbaar", async ({
  page,
}) => {
  await page.goto("/ontwerp");
  await expect(page.getByRole("status")).toContainText(
    "Gegevens worden geladen",
  );
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Voorbeeld: laden niet gelukt",
  );
  await expect(
    page.getByRole("heading", { name: "Nog geen gegevens", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nog niet beschikbaar", exact: true }),
  ).toBeDisabled();
  const table = page.getByRole("region", {
    name: "Voorbeeldtabel, horizontaal scrollbaar",
  });
  await table.focus();
  await expect(table).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("niet-lokale host krijgt geen interne ontwerpweergave", async ({
  request,
}) => {
  const response = await request.get("/beheer", {
    headers: { Host: "example.com" },
  });
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain("Sterke relaties.");
});

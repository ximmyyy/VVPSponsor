import { test, expect } from "@playwright/test";

test("productie toont de publieke layout zonder lokale ontwerplinks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Samen maken we",
  );
  await expect(
    page.getByText("Inloggen en sponsorfuncties zijn nog niet beschikbaar.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.locator("a[href^='/beheer'],a[href^='/portaal'],a[href^='/ontwerp']"),
  ).toHaveCount(0);
});
for (const route of [
  "/beheer",
  "/beheer/bestuur",
  "/portaal",
  "/ontwerp",
  "/beheer/onbekend",
  "/portaal/onbekend",
]) {
  test(`productie blokkeert ${route} ook met APP_ENV=local`, async ({
    request,
  }) => {
    const response = await request.get(route);
    expect(response.status()).toBe(404);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(await response.text()).not.toContain("Lokale ontwerpweergave");
  });
}

test("onbekende publieke pagina toont een werkende terugweg", async ({
  page,
}) => {
  await page.goto("/bestaat-niet");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Deze pagina is niet beschikbaar",
  );
  await page.getByRole("link", { name: "Naar de startpagina" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Samen maken we",
  );
});

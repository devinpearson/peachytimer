import { expect, test } from "@playwright/test";

test("the timekeeper's controls drive the speaker's light live", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a timing room" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z2-9]{5}\/control$/);
  const code = page.url().match(/room\/([A-Z2-9]{5})/)![1];

  const display = await context.newPage();
  await display.goto(`/room/${code}`);
  const light = display.getByTestId("light");
  await expect(light).toHaveAttribute("data-light", "off");
  await expect(display.getByText("Waiting for the timekeeper")).toBeVisible();

  // Manual lights reach the other screen over the WebSocket.
  await page.getByRole("button", { name: "Amber", exact: true }).click();
  await expect(light).toHaveAttribute("data-light", "amber");
  await page.getByRole("button", { name: "Automatic" }).click();
  await expect(light).toHaveAttribute("data-light", "off");

  // Custom times of 0:01 / 0:02 / 0:03 let the automatic light change within the test.
  await page.getByText("Custom times").click();
  await page.getByLabel("Green at").fill("0:01");
  await page.getByLabel("Amber at").fill("0:02");
  await page.getByLabel("Red at").fill("0:03");
  await page.getByRole("button", { name: "Use these times" }).click();
  await expect(page.getByText("Custom (0:01–0:03)").first()).toBeVisible();

  await page.getByLabel("Speaker").fill("Ted");
  await page.getByLabel("Speaker").press("Enter");
  await expect(display.getByText("Ted")).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(light).toHaveAttribute("data-light", "green", { timeout: 3000 });
  await expect(light).toHaveAttribute("data-light", "red", { timeout: 4000 });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await page.getByRole("button", { name: "Stop & reset" }).click();
  await expect(page.getByTestId("history")).toContainText("Ted");
  await expect(page.getByTestId("control-clock")).toHaveText("0:00");
  await expect(light).toHaveAttribute("data-light", "off");
});

test("a viewer without the control link can't run the timer", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a timing room" }).click();
  await expect(page).toHaveURL(/\/control$/);
  const code = page.url().match(/room\/([A-Z2-9]{5})/)![1];

  const stranger = await browser.newPage();
  await stranger.goto(`/room/${code}/control`);
  await expect(stranger.getByText(`This device can't run room ${code}`)).toBeVisible();
  await stranger.close();
});

test("the control link hands timer access to another device", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start a timing room" }).click();
  await expect(page.getByText("Control (gives timer access)")).toBeVisible();
  const link = await page.locator("code", { hasText: "#token=" }).textContent();

  const other = await browser.newPage();
  await other.goto(link!);
  await expect(other.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(other).not.toHaveURL(/#token=/);
  await other.close();
});

test("unknown rooms and bad codes are explained", async ({ page }) => {
  await page.goto("/room/ZZZZZ");
  await expect(page.getByText("Room ZZZZZ isn't running")).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Room code").fill("nope");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Room codes are 5 letters and numbers")).toBeVisible();
});

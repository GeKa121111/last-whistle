#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const publicHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
assert.equal(rootHtml, publicHtml, "the deployed root page and local-build page must stay in sync");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp"
};

async function main() {
  const badResponses = [];
  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        badResponses.push({ status: 404, path: pathname });
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = "http://127.0.0.1:" + address.port;
  let browser;
  let page;
  const pageErrors = [];
  const failedLocalRequests = [];
  const results = [];

  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block"
    });
    page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => {
      if (request.url().startsWith(baseUrl)) failedLocalRequests.push({
        url: request.url(),
        error: request.failure() ? request.failure().errorText : "request failed"
      });
    });
    page.on("response", response => {
      if (response.url().startsWith(baseUrl) && response.status() >= 400) {
        badResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
      }
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      return Boolean(window.LWStoryRuntime)
        && document.querySelector("#startName")
        && document.querySelector("#startScreen").classList.contains("show");
    }, null, { timeout: 30000 });
    results.push("startup");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      "mobile player-setup screen must not overflow horizontally"
    );

    await page.locator("#createCareerBtn").click();
    await page.waitForFunction(() => {
      const input = document.querySelector("#startName");
      return input && input.validationMessage.includes("اسم اللاعب");
    });
    assert.equal(
      await page.evaluate(() => Boolean(window.LWStoryRuntime.getState().careerStarted)),
      false,
      "an empty name must not start a career"
    );
    results.push("empty-name validation");

    await page.locator("#startName").fill("  Mohamed Ahmed  ");
    assert.equal(
      await page.locator("#startName").evaluate(input => input.validationMessage),
      "",
      "editing the name must clear the custom validation error"
    );
    await page.locator("#createCareerBtn").click();
    await page.waitForFunction(() => {
      return !document.querySelector("#startScreen").classList.contains("show")
        && window.LWStoryRuntime.getState().careerStarted
        && document.querySelector("#modalShade").classList.contains("open");
    }, null, { timeout: 15000 });
    assert.equal(
      await page.evaluate(() => window.LWStoryRuntime.getState().name),
      "Mohamed Ahmed",
      "the normalized player name must be saved in the career"
    );
    await page.locator("#modalChoices button").filter({ hasText: "يلا نبدأ" }).click();
    results.push("career creation");

    const sections = ["home", "training", "stats", "wellness", "league", "europe", "contract", "national", "shop", "life", "diary"];
    for (const section of sections) {
      await page.locator("#menuOpen").click();
      await page.locator('#drawer .navBtn[data-page="' + section + '"]').click();
      await page.waitForFunction(value => {
        const active = document.querySelector(".page.active");
        return active && active.id === "page-" + value;
      }, section);
    }
    await page.locator("#shopItems [data-buy]").first().waitFor({ state: "attached" });
    assert.ok(await page.locator("#shopItems [data-buy]").count() > 0, "the player store must render purchasable items");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      "the player-store screen must not overflow horizontally on a mobile viewport"
    );
    results.push("11-section navigation and store rendering");

    await page.locator("#menuOpen").click();
    await page.locator('#drawer .navBtn[data-page="home"]').click();
    const beforeApps = await page.evaluate(() => Number(window.LWStoryRuntime.getState().seasonApps) || 0);
    assert.equal(await page.locator("#heroMatch").isVisible(), false,
      "legacy hero CTA must remain hidden after the redesigned story-mode shell is installed");
    await page.locator("#lw-cta-match").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#lw-cta-match").click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("خطة المباراة");
    });
    await page.locator("#modalChoices button").filter({ hasText: "متوازن" }).click();
    await page.waitForFunction(before => {
      const state = window.LWStoryRuntime.getState();
      return (Number(state.seasonApps) || 0) > before
        && Array.isArray(state.recordedMatchIds)
        && state.recordedMatchIds.length > 0
        && Array.isArray(state.careerMatchHistory)
        && state.careerMatchHistory.length > 0;
    }, beforeApps, { timeout: 20000 });
    results.push("one complete match simulation and match-history recording");

    const modalOpen = await page.locator("#modalShade").evaluate(el => el.classList.contains("open"));
    if (modalOpen) await page.locator("#modalClose").click();
    await page.locator("#seasonTransferAction").scrollIntoViewIfNeeded();
    await page.locator("#seasonTransferAction").click();
    await page.waitForFunction(() => {
      const active = document.querySelector(".page.active");
      return active && active.id === "page-contract";
    }, null, { timeout: 10000 });
    results.push("season transfer-market navigation");

    assert.deepEqual(pageErrors, [], "the game must not throw uncaught JavaScript errors in Chromium");
    assert.deepEqual(failedLocalRequests, [], "the game must not fail to load local JavaScript/CSS/assets");
    assert.deepEqual(badResponses, [], "all local page assets must return successful responses");
    console.log("PASS: real Chromium smoke test completed: " + results.join("; ") + ".");
    console.log("PASS: no uncaught browser exceptions or failed local assets.");
  } catch (error) {
    if (page) {
      const screenshot = path.join(process.env.RUNNER_TEMP || os.tmpdir(), "last-whistle-browser-smoke.png");
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error("Browser smoke screenshot: " + screenshot);
    }
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});

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

    await page.waitForFunction(() => Boolean(window.LWCareerAI && window.LWCareerAIUI
      && document.querySelector("#careerAIPanel") && document.querySelector("#careerAIOverview")?.textContent.trim()), null, { timeout: 10000 });
    await page.locator('[data-ai-action="coach"]').click();
    assert.ok(await page.locator("#careerAIResultTitle").textContent().then(text => text.trim().length > 0),
      "AI coach must return a context-aware report");
    await page.locator('[data-ai-action="tactics"]').click();
    assert.ok(await page.locator("#careerAIResultTitle").textContent().then(text => text.includes("خطة مقترحة")),
      "AI match analyst must recommend a tactic for the upcoming opponent");
    assert.equal(await page.locator("#careerAIApplyTactic").isVisible(), true,
      "the recommended tactic must be offered as an actionable match option");
    results.push("career AI coach and upcoming-match tactical recommendation");


    await page.waitForFunction(() => Boolean(document.querySelector("#lw-hub-money")?.textContent.trim()), null, { timeout: 5000 });
    const startingContext = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const text = id => document.querySelector("#" + id)?.textContent.trim() || "";
      return {
        age: Number(state.age), division: Number(state.leagueDivision), contractType: state.contractType,
        contractSeasons: Number(state.contractSeasons), position: state.pos, leagueCount: Array.isArray(state.league) ? state.league.length : 0,
        matchTarget: Number(state.seasonAppsTarget), shooting: Number(state.shooting), dribbling: Number(state.dribbling),
        speed: Number(state.speed), defending: Number(state.defending), goalkeeping: Number(state.goalkeeping), physical: Number(state.physical),
        headerCurrency: text("headCurrency"), summaryCurrency: text("kpiCurrency"), storeCurrency: text("storeCurrency"),
        commandBalance: text("lw-hub-money"), nextMatchCountdown: text("lw-console-round"), nextMatchMeta: text("lw-next-match-meta")
      };
    });
    assert.equal(startingContext.age, 17, "the default career starts at age 17");
    assert.equal(startingContext.division, 2, "players aged 16-18 must begin in the second tier/academy route");
    assert.equal(startingContext.contractType, "youth-amateur", "young players must receive a youth/amateur contract");
    assert.equal(startingContext.contractSeasons, 1, "youth deals begin with a one-season term");
    assert.equal(startingContext.leagueCount, 12, "the second tier must use a 12-team schedule");
    assert.equal(startingContext.matchTarget, 22, "a 12-team double round-robin has 22 matches");
    assert.ok(startingContext.shooting >= 55 && startingContext.shooting <= 68, "a winger starts with winger-level shooting");
    assert.ok(startingContext.dribbling >= 55 && startingContext.dribbling <= 68, "a winger starts with winger-level dribbling");
    assert.ok(startingContext.speed >= 55 && startingContext.speed <= 68, "a winger starts with winger-level speed");
    assert.ok(startingContext.defending >= 15 && startingContext.defending <= 28, "a winger does not start as a defender");
    assert.ok(startingContext.goalkeeping >= 5 && startingContext.goalkeeping <= 12, "a winger does not start as a goalkeeper");
    assert.ok(startingContext.physical >= 45 && startingContext.physical <= 58, "physical skill is initialized by position");
    assert.deepEqual([startingContext.headerCurrency, startingContext.summaryCurrency, startingContext.storeCurrency], ["ج.م", "ج.م", "ج.م"],
      "header, player summary, and store must use the Egyptian currency for an Egyptian league");
    assert.ok(startingContext.commandBalance.includes("ج.م"), "the main career command center shows the wallet currency");
    const countryCurrencyChecks = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const originalCountry = state.leagueCountry;
      const checks = [];
      for (const [country, expected] of [["إنجلترا", "£"], ["ألمانيا", "€"], ["الولايات المتحدة", "$"], ["مصر", "ج.م"]]) {
        state.leagueCountry = country;
        window.LWStoryRuntime.render();
        checks.push({
          country,
          expected,
          header: document.querySelector("#headCurrency")?.textContent.trim(),
          summary: document.querySelector("#kpiCurrency")?.textContent.trim(),
          store: document.querySelector("#storeCurrency")?.textContent.trim()
        });
      }
      state.leagueCountry = originalCountry;
      window.LWStoryRuntime.render();
      return checks;
    });
    for (const check of countryCurrencyChecks) {
      assert.deepEqual([check.header, check.summary, check.store], [check.expected, check.expected, check.expected],
        "header, summary and store currency should match " + check.country);
    }
    assert.ok(startingContext.nextMatchCountdown.length > 0 && startingContext.nextMatchMeta.includes("22"),
      "the dashboard shows the upcoming fixture and dynamic season length");
    results.push("position-based starting stats, youth contract, dynamic league length, currency and match countdown");

    const homeActionPlacement = await page.evaluate(() => {
      const commandCenter = document.querySelector("#lw-command-center");
      const storyPanel = document.querySelector("#lw-story-panel");
      const transferButton = document.querySelector("#lw-cta-transfers");
      const seasonButton = document.querySelector("#lw-cta-season");
      const seasonRoadmap = document.querySelector("#page-home .seasonJourneyCard");
      const shortcutPanel = document.querySelector("#page-home .hub-launch-panel");
      const playerSummary = document.querySelector("#page-home .hub-player-card");
      const duplicateActionPanel = document.querySelector("#page-home .hub-home-season-actions");
      if (!commandCenter || !storyPanel || !transferButton || !seasonButton || !seasonRoadmap) return null;
      return {
        commandCenterBeforeStory: !!(commandCenter.compareDocumentPosition(storyPanel) & Node.DOCUMENT_POSITION_FOLLOWING),
        bothPrimaryActionsVisible: transferButton.getClientRects().length > 0 && seasonButton.getClientRects().length > 0,
        commandCenterAboveSeasonRoadmap: commandCenter.getBoundingClientRect().top < seasonRoadmap.getBoundingClientRect().top,
        duplicateShortcutsHidden: !!shortcutPanel && getComputedStyle(shortcutPanel).display === "none",
        duplicatePlayerSummaryHidden: !!playerSummary && getComputedStyle(playerSummary).display === "none",
        duplicateActionPanelHidden: !!duplicateActionPanel && getComputedStyle(duplicateActionPanel).display === "none"
      };
    });
    assert.ok(homeActionPlacement, "redesigned home dashboard must exist");
    assert.equal(homeActionPlacement.commandCenterBeforeStory, true,
      "player command center must lead the home page");
    assert.equal(homeActionPlacement.bothPrimaryActionsVisible, true,
      "match-season and transfer actions must be visible inside the command center");
    assert.equal(homeActionPlacement.commandCenterAboveSeasonRoadmap, true,
      "the main player controls must appear before the season roadmap");
    assert.equal(homeActionPlacement.duplicateShortcutsHidden, true,
      "the duplicated shortcut panel must be removed from the home screen");
    assert.equal(homeActionPlacement.duplicatePlayerSummaryHidden, true,
      "the duplicate player summary must be removed from the home screen");
    assert.equal(homeActionPlacement.duplicateActionPanelHidden, true,
      "the old season action panel must be hidden after moving its actions into the command center");
    results.push("redesigned home hierarchy and duplicate-panel cleanup");

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
    await page.locator('#drawer .navBtn[data-page="shop"]').click();
    await page.locator('#shopItems [data-buy="boots"]').click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("تأكيد الشراء");
    });
    await page.locator("#modalChoices button").filter({ hasText: "اشتري دلوقتي" }).click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      return state.boots === true && Number(state.money) === 50
        && document.querySelector("#inventory").textContent.includes("حذاء احترافي");
    }, null, { timeout: 15000 });
    results.push("store purchase changes balance and inventory");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime && window.LWStoryRuntime.getState();
      return state && state.careerStarted && state.name === "Mohamed Ahmed"
        && state.boots === true && Number(state.money) === 50
        && !document.querySelector("#startScreen").classList.contains("show");
    }, null, { timeout: 20000 });
    results.push("career and store ownership persist after reload");

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
    await page.locator("#lw-cta-transfers").scrollIntoViewIfNeeded();
    await page.locator("#lw-cta-transfers").click();
    await page.waitForFunction(() => {
      const active = document.querySelector(".page.active");
      return active && active.id === "page-contract";
    }, null, { timeout: 10000 });
    results.push("season transfer-market navigation");

    // Exercise the complete league season lifecycle, not just a single match.
    await page.locator("#menuOpen").click();
    await page.locator('#drawer .navBtn[data-page="home"]').click();
    await page.locator("#lw-cta-season").click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("تكملة النصف الأول");
    }, null, { timeout: 10000 });
    await page.locator("#modalChoices button").filter({ hasText: "كمّل لحد الشتاء" }).click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      const title = document.querySelector("#modalTitle");
      return state.winterBreakPending === true
        && Number(state.seasonApps) >= Math.ceil((Number(state.seasonAppsTarget) || 34) / 2)
        && title && title.textContent.includes("ملخص منتصف الموسم");
    }, null, { timeout: 30000 });
    results.push("first-half simulation reaches the winter break");

    await page.locator("#modalChoices button").filter({ hasText: "راجع انتقالات الشتاء" }).click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("انتقالات منتصف الموسم");
    });
    await page.locator("#modalChoices button").filter({ hasText: "مراجعة العقد والسوق" }).click();
    await page.waitForFunction(() => {
      const active = document.querySelector(".page.active");
      return active && active.id === "page-contract";
    }, null, { timeout: 10000 });
    assert.equal(
      await page.evaluate(() => window.LWStoryRuntime.getState().journeyTransferReviewed),
      true,
      "winter market review must be persisted in the season journey"
    );
    results.push("winter transfer review is recorded");

    // Exercise a real in-page transfer offer, negotiation form, and accepted transfer.
    // The seeded offer is deterministic and the career is restored afterwards so the
    // normal full-season lifecycle below is still tested from the original winter break.
    const transferFixture = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const backup = JSON.parse(JSON.stringify(state));
      const clubs = window.LWWorldDB?.clubs?.() || [];
      const target = clubs.find(row =>
        row && row.country === state.leagueCountry
        && row.name !== state.clubName
        && (Number(row.division) || 1) === 1
      );
      if (!target) throw new Error("Could not find a same-country top-division club for transfer-flow testing.");
      const profile = window.LWWorldDB?.leagueById?.(target.leagueId) || {};
      if (!profile.league) throw new Error("Transfer-flow test target has no domestic league mapping.");

      state.retired = false;
      state.careerStarted = true;
      state.loan = null;
      state.freeAgent = false;
      state.transferCooldown = 0;
      state.winterBreakPending = true;
      state.cupState = null;
      const windowId = "winter-season-" + Number(state.season);
      state.transferOffersWindowId = windowId;
      state.transferOffers = [{
        id: "browser-flow-offer",
        status: "pending",
        windowId,
        club: target.name,
        country: target.country,
        league: profile.league,
        leagueEnglish: profile.english || "",
        season: window.LWWorldDB?.season || "2026/27",
        source: "LWWorldDB",
        sourceUrl: profile.url || "",
        division: Number(target.division) || 1,
        power: Number(target.ovr) || 60,
        prestige: Number(target.prestige) || 60,
        currency: profile.currency || "ج.م",
        stars: Array.isArray(target.stars) ? target.stars.slice(0, 3) : [],
        positionRivals: [],
        role: "أساسي",
        wage: 700,
        signingBonus: 120,
        goalBonus: 30,
        cleanSheetBonus: 25,
        contractSeasons: 3,
        releaseClause: 0
      }];
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("contract");
      window.LWStoryRuntime.render();
      return { backup, targetClub: target.name, targetCountry: target.country, windowId };
    });

    const seededOffer = page.locator('#transferMarket [data-negotiate-offer="browser-flow-offer"]');
    await seededOffer.waitFor({ state: "visible", timeout: 10000 });
    await seededOffer.click();
    await page.locator("#transferNegotiationPanel").waitFor({ state: "visible", timeout: 10000 });
    assert.ok(
      await page.locator("#transferNegotiationPanel").textContent().then(text => text.includes(transferFixture.targetClub)),
      "the selected club's contract terms must render inside the negotiation panel"
    );
    assert.equal(
      await page.locator('#transferNegotiationPanel [data-negotiation-field="wage"]').inputValue(),
      "700",
      "the initial weekly salary must match the club offer"
    );
    await page.locator('#transferNegotiationPanel [data-submit-negotiation]').click();
    await page.waitForFunction(targetName => {
      const state = window.LWStoryRuntime.getState();
      return state.clubName === targetName
        && Number(state.weeklyWage) === 700
        && Number(state.contractSeasons) === 3
        && Number(state.goalBonusPerGoal) === 30
        && Number(state.cleanSheetBonus) === 25
        && Number(state.transferCooldown) === 14
        && Array.isArray(state.transferHistory)
        && state.transferHistory.some(row => String(row.text || "").includes(targetName));
    }, transferFixture.targetClub, { timeout: 15000 });
    const acceptedTransfer = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        club: state.clubName,
        country: state.leagueCountry,
        offerStatus: state.transferOffers.find(row => row.id === "browser-flow-offer")?.status,
        history: state.transferHistory[0]?.text || "",
        clubExistsInLeague: Array.isArray(state.league) && state.league.some(row => row.name === state.clubName)
      };
    });
    assert.equal(acceptedTransfer.club, transferFixture.targetClub);
    assert.equal(acceptedTransfer.country, transferFixture.targetCountry);
    assert.equal(acceptedTransfer.offerStatus, "accepted", "accepted offers must be marked as accepted");
    assert.ok(acceptedTransfer.history.includes(transferFixture.targetClub), "accepted transfers must enter the career history");
    assert.equal(acceptedTransfer.clubExistsInLeague, true, "the destination club must exist in its rebuilt league table");
    results.push("transfer offer renders, accepted negotiation signs the contract, and destination league is rebuilt");

    await page.evaluate(backup => {
      const state = window.LWStoryRuntime.getState();
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, backup);
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("home");
      window.LWStoryRuntime.render();
    }, transferFixture.backup);

    await page.locator("#menuOpen").click();
    await page.locator('#drawer .navBtn[data-page="home"]').click();
    // At the winter break, the primary season action correctly reopens the winter-market decision.
    await page.locator("#lw-cta-season").click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("انتقالات منتصف الموسم");
    }, null, { timeout: 10000 });
    await page.locator("#modalChoices button").filter({ hasText: "حاكي آخر" }).click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      const title = document.querySelector("#modalTitle");
      return state.seasonFinished === true
        && Number(state.seasonApps) === Number(state.seasonAppsTarget)
        && Array.isArray(state.seasonHistory)
        && state.seasonHistory.some(row => Number(row.season) === Number(state.season))
        && title && title.textContent.includes("نهاية الموسم");
    }, null, { timeout: 45000 });
    results.push("full season completion archives a final season record");

    const completedSeason = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const text = id => document.querySelector("#" + id)?.textContent || "";
      return {
        season: Number(state.season),
        apps: Number(state.seasonApps),
        target: Number(state.seasonAppsTarget),
        finished: state.seasonFinished,
        historyCount: Array.isArray(state.seasonHistory) ? state.seasonHistory.length : 0,
        hasSummary: Boolean(state.seasonSummary),
        awardCeremonyCount: Array.isArray(state.awardCeremonies) ? state.awardCeremonies.length : 0,
        awardNomineeCount: Number(state.awardCeremonies?.[0]?.ballonDor?.topFive?.length) || 0,
        awardCeremonyText: text("ballonDOrCeremony"),
        careerAwardCountText: text("careerAwardCount"),
        trophyCabinetText: text("trophyCabinet"),
        currentCompetitionCount: Array.isArray(state.currentCompetitions) ? state.currentCompetitions.length : 0,
        goldenBootRowCount: document.querySelectorAll("#goldenBootLeaderboard tbody tr").length,
        playmakerRowCount: document.querySelectorAll("#playmakerLeaderboard tbody tr").length
      };
    });
    assert.equal(completedSeason.finished, true);
    assert.equal(completedSeason.apps, completedSeason.target, "a season cannot be marked complete before all scheduled matches are played");
    assert.ok(completedSeason.historyCount > 0, "the completed season must be archived");
    assert.equal(completedSeason.hasSummary, true, "the season report must be saved");
    assert.ok(completedSeason.awardCeremonyCount > 0, "finishing a season must persist an award ceremony");
    assert.equal(completedSeason.awardNomineeCount, 5, "the ceremony must persist the five Ballon d'Or nominees");
    assert.ok(completedSeason.awardCeremonyText.includes("الكرة الذهبية"), "the award ceremony must render in the real UI");
    assert.ok(completedSeason.awardCeremonyText.includes("أفضل 5 مرشحين"), "the UI must display the Ballon d'Or shortlist");
    assert.ok(completedSeason.currentCompetitionCount > 0, "current competitions must remain linked to the player season");
    assert.ok(completedSeason.goldenBootRowCount > 0, "the golden-boot leaderboard must render player rows");
    assert.ok(completedSeason.playmakerRowCount > 0, "the playmaker leaderboard must render player rows");
    results.push("season totals, award ceremony, Ballon d'Or shortlist, trophy cabinet, competitions and leaderboards reconcile");

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

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

    const metadataShapeProbe = await page.evaluate(() => {
      const engine = window.LWMatch;
      if (!engine || typeof engine.validateResult !== "function") return null;
      const match = engine.simulateMatch({
        seed: 8144,
        player: { name: "Metadata Shape", position: "مهاجم", role: "أساسي",
          shooting: 65, composure: 65, trust: 50, fitness: 80, energy: 80, fatigue: 10 }
      });
      const malformed = JSON.parse(JSON.stringify(match));
      malformed.metadata = [];
      const legacy = JSON.parse(JSON.stringify(match));
      delete legacy.metadata;
      return {
        valid: engine.validateResult(match).ok,
        malformedReason: engine.validateResult(malformed).reason,
        legacyValid: engine.validateResult(legacy).ok
      };
    });
    assert.ok(metadataShapeProbe, "the browser must expose the deployed match engine");
    assert.equal(metadataShapeProbe.valid, true, "a valid generated match must pass in Chromium");
    assert.equal(metadataShapeProbe.malformedReason, "invalid-metadata-shape",
      "Chromium must reject a malformed metadata array");
    assert.equal(metadataShapeProbe.legacyValid, true,
      "Chromium must retain compatibility with legacy matches that omit metadata");
    results.push("match metadata shape validation and legacy compatibility");

    const matchOptionsProbe = await page.evaluate(() => {
      const engine = window.LWMatch;
      const invalidOptions = [null, true, false, 0, "invalid", []];
      return invalidOptions.map(options => {
        try {
          engine.simulateMatch(options);
          return false;
        } catch (error) {
          return error && error.message === "invalid-match-options";
        }
      });
    });
    assert.deepEqual(matchOptionsProbe, [true, true, true, true, true, true],
      "Chromium must reject null, primitive and array match options");
    results.push("match simulation options container validation");

    const matchSeedReplayProbe = await page.evaluate(() => {
      const engine = window.LWMatch;
      const options = {
        teamPower: 64, opponentPower: 59, home: true,
        player: { name: "Seed Replay", position: "وسط دفاعي", role: "أساسي",
          shooting: 58, passing: 68, vision: 66, composure: 64, fitness: 82,
          trust: 72, energy: 88, fatigue: 12, physical: 70, speed: 62, dribbling: 55 }
      };
      const first = engine.simulateMatch(options);
      const replay = engine.simulateMatch({ ...options, seed: first.metadata.seed });
      const zero = engine.simulateMatch({ ...options, seed: 0 });
      const zeroReplay = engine.simulateMatch({ ...options, seed: zero.metadata.seed });
      return {
        implicitSeed: first.metadata.seed,
        implicitReplayMatches: JSON.stringify(first) === JSON.stringify(replay),
        zeroSeed: zero.metadata.seed,
        zeroReplayMatches: JSON.stringify(zero) === JSON.stringify(zeroReplay)
      };
    });
    assert.ok(Number.isSafeInteger(matchSeedReplayProbe.implicitSeed),
      "Chromium must expose the effective implicit match seed");
    assert.equal(matchSeedReplayProbe.implicitReplayMatches, true,
      "Chromium matches must be reproducible from their recorded implicit seed");
    assert.equal(matchSeedReplayProbe.zeroSeed, 0,
      "Chromium must preserve an explicit zero seed");
    assert.equal(matchSeedReplayProbe.zeroReplayMatches, true,
      "Chromium must replay matches generated with an explicit zero seed");
    results.push("match simulation seed replay metadata");


    const saveLedgerProbe = await page.evaluate(() => {
      const engine = window.LWMatch;
      const makeOptions = (seed, position) => ({
        seed, teamPower: 62, opponentPower: 60,
        player: { name: "Save Ledger Regression", position, role: "أساسي",
          shooting: 24, passing: 55, vision: 50, composure: 65, fitness: 85,
          trust: 70, energy: 90, fatigue: 5, physical: 60, speed: 45, dribbling: 35 }
      });
      const freeMinute = match => {
        const entry = match.events.find(event => event.type === "substitution-on" && event.side === "player");
        const start = entry ? Number(entry.minute) : 0;
        const exit = match.events
          .filter(event => event.side === "player" && ["red-card", "injury", "substitution"].includes(event.type))
          .sort((a, b) => Number(a.minute) - Number(b.minute))[0];
        const end = exit ? Number(exit.minute) : start + Number(match.player.minutes || 0);
        const used = new Set(match.events.map(event => Number(event.minute)));
        for (let minute = start + 1; minute < end; minute += 1) if (!used.has(minute)) return minute;
        return null;
      };
      const insert = (match, minute, events) => {
        const index = match.events.findIndex(event => Number(event.minute) > minute);
        match.events.splice(index < 0 ? match.events.length : index, 0, ...events);
      };
      const keeper = engine.simulateMatch(makeOptions(91821, "حارس مرمى"));
      const keeperMinute = freeMinute(keeper);
      keeper.player.saves = Number(keeper.player.saves || 0) + 1;
      insert(keeper, keeperMinute, [{ type: "save", minute: keeperMinute, side: "team",
        actor: "Save Ledger Regression", creditedToPlayer: true }]);
      const orphan = engine.validateResult(keeper);

      const outfield = engine.simulateMatch(makeOptions(91822, "مهاجم"));
      const outfieldMinute = freeMinute(outfield);
      outfield.player.saves = Number(outfield.player.saves || 0) + 1;
      insert(outfield, outfieldMinute, [
        { type: "shot", minute: outfieldMinute, side: "opponent", onTarget: true,
          shooter: "opponent", creditedToPlayer: false },
        { type: "save", minute: outfieldMinute, side: "team",
          actor: "Save Ledger Regression", creditedToPlayer: true }
      ]);
      const wrongPosition = engine.validateResult(outfield);

      const legacy = engine.simulateMatch(makeOptions(91823, "حارس مرمى"));
      for (const event of legacy.events) if (event.type === "shot") delete event.onTarget;
      return {
        orphanReason: orphan.reason,
        orphanConsistent: orphan.saveShotLedgerConsistent,
        outfieldReason: wrongPosition.reason,
        outfieldConsistent: wrongPosition.saveRoleConsistent,
        legacyAccepted: engine.validateResult(legacy).ok
      };
    });
    assert.equal(saveLedgerProbe.orphanReason, "invalid-save-shot-link",
      "Chromium must reject a credited save without a matching opponent shot");
    assert.equal(saveLedgerProbe.orphanConsistent, false,
      "Chromium must expose orphaned save-shot attribution");
    assert.equal(saveLedgerProbe.outfieldReason, "invalid-save-player-position",
      "Chromium must reject saves attributed to an outfield player");
    assert.equal(saveLedgerProbe.outfieldConsistent, false,
      "Chromium must expose goalkeeper-only save attribution");
    assert.equal(saveLedgerProbe.legacyAccepted, true,
      "Chromium must preserve legacy save ledgers without shot-target metadata");
    results.push("goalkeeper save-shot attribution and legacy-ledger validation");





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

    await page.waitForFunction(() => Boolean(window.LWWorldAI
      && document.querySelector("#worldAIHomePanel")
      && Number(document.querySelector("#worldAIHomePlayers")?.textContent || 0) > 100), null, { timeout: 20000 });
    assert.equal(await page.locator("#careerAIPanel").count(), 0,
      "the game should use autonomous world simulation rather than a conversational AI panel");
    assert.ok(await page.locator("#worldAIHomeTeams").textContent().then(text => Number(text) > 40),
      "the persistent world AI must initialize multiple clubs");
    assert.ok(await page.locator("#worldAIHomePlayers").textContent().then(text => Number(text) > 100),
      "the persistent world AI must initialize player squads");
    await page.evaluate(() => window.LWStoryRuntime.showPage("europe"));
    await page.waitForFunction(() => Boolean(document.querySelector("#worldAISimulationDashboard")
      && document.querySelector("#worldAITopScorers")?.textContent.trim()
      && document.querySelector("#worldAITransferLog")?.textContent.trim()), null, { timeout: 20000 });
    const worldContext = await page.evaluate(() => {
      const world = window.LWStoryRuntime.getState().worldSimulation;
      return { clubs: Object.keys(world?.clubs || {}).length, players: Object.keys(world?.players || {}).length,
        completed: Array.isArray(world?.completedSeasons) ? world.completedSeasons.length : 0 };
    });
    assert.ok(worldContext.clubs > 40 && worldContext.players > worldContext.clubs * 10,
      "world AI must persist a multi-club squad database");
    results.push("persistent AI football world, squad initialization and transfers/statistics dashboard");


    await page.waitForFunction(() => Boolean(document.querySelector("#lw-hub-money")?.textContent.trim()), null, { timeout: 5000 });
    const startingContext = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const text = id => document.querySelector("#" + id)?.textContent.trim() || "";
      return {
        age: Number(state.age), division: Number(state.leagueDivision), contractType: state.contractType,
        contractSeasons: Number(state.contractSeasons), position: state.pos, leagueCount: Array.isArray(state.league) ? state.league.length : 0,
        matchTarget: Number(state.seasonAppsTarget), shooting: Number(state.shooting), dribbling: Number(state.dribbling),
        developmentSnapshotSeason: Number(state.seasonDevelopmentSnapshot?.season) || 0,
        developmentSnapshotShooting: Number(state.seasonDevelopmentSnapshot?.attributes?.shooting) || 0,
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
    assert.equal(startingContext.developmentSnapshotSeason, 1, "the player-development snapshot must be initialized at the start of the career season");
    assert.equal(startingContext.developmentSnapshotShooting, startingContext.shooting, "the starting snapshot must retain the actual pre-training skill baseline");
    assert.ok(startingContext.shooting >= 55 && startingContext.shooting <= 68, "a winger starts with winger-level shooting");
    assert.ok(startingContext.dribbling >= 55 && startingContext.dribbling <= 68, "a winger starts with winger-level dribbling");
    assert.ok(startingContext.speed >= 55 && startingContext.speed <= 68, "a winger starts with winger-level speed");
    assert.ok(startingContext.defending >= 15 && startingContext.defending <= 28, "a winger does not start as a defender");
    assert.equal(startingContext.goalkeeping, 0, "outfield players must start with no goalkeeper skill");
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

    await page.evaluate(() => window.LWStoryRuntime.showPage("home"));
    // A player in the youth route must not see the professional transfer shortcut.
    // Re-check the same dashboard as an adult during the summer window so layout
    // coverage still verifies both primary actions when the market is legitimately open.
    await page.locator("#lw-command-center").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#lw-cta-season").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const transfers = document.querySelector("#lw-cta-transfers");
      return !!transfers && (transfers.hidden || getComputedStyle(transfers).display === "none");
    }, null, { timeout: 10000 });
    await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      window.__transferEligibilityTestBackup = JSON.parse(JSON.stringify(state));
      state.age = 18;
      state.academyCareer = false;
      state.academyReserve = false;
      state.academyGraduationPending = false;
      state.academyGraduated = true;
      state.freeAgent = false;
      state.winterBreakPending = false;
      state.calendarDay = 15;
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.render();
    });
    await page.locator("#lw-cta-transfers").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => {
      const season = document.querySelector("#lw-cta-season");
      const transfers = document.querySelector("#lw-cta-transfers");
      return !!season && !!transfers && season.getBoundingClientRect().width > 0 && transfers.getBoundingClientRect().width > 0;
    }, null, { timeout: 10000 });
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
        bothPrimaryActionsVisible: transferButton.getBoundingClientRect().width > 0 && seasonButton.getBoundingClientRect().width > 0,
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
      "match-season and transfer actions must be visible inside the command center during an open transfer window");
    assert.equal(homeActionPlacement.commandCenterAboveSeasonRoadmap, true,
      "the main player controls must appear before the season roadmap");
    assert.equal(homeActionPlacement.duplicateShortcutsHidden, true,
      "the duplicated shortcut panel must be removed from the home screen");
    assert.equal(homeActionPlacement.duplicatePlayerSummaryHidden, true,
      "the duplicate player summary must be removed from the home screen");
    assert.equal(homeActionPlacement.duplicateActionPanelHidden, true,
      "the old season action panel must be hidden after moving its actions into the command center");
    await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const backup = window.__transferEligibilityTestBackup;
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, backup);
      delete window.__transferEligibilityTestBackup;
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("home");
      window.LWStoryRuntime.render();
    });
    await page.waitForFunction(() => {
      const transfers = document.querySelector("#lw-cta-transfers");
      return !!transfers && (transfers.hidden || getComputedStyle(transfers).display === "none");
    }, null, { timeout: 10000 });
    results.push("youth transfer lock and adult summer-market shortcut visibility");

    const sections = ["home", "training", "stats", "wellness", "league", "europe", "contract", "national", "shop", "life", "diary"];
    for (const section of sections) {
      await page.locator("#mobileMore").click();
      await page.locator('#drawer .navBtn[data-page="' + section + '"]').click();
      await page.waitForFunction(value => {
        const active = document.querySelector(".page.active");
        return active && active.id === "page-" + value;
      }, section);
      const layout = await page.evaluate(() => {
        const offenders = [...document.querySelectorAll("#page-europe *, #page-europe")]
          .map(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return null;
            const style = getComputedStyle(el);
            return { tag: el.tagName, id: el.id || "", cls: String(el.className || "").slice(0, 100),
              left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width),
              scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: style.overflowX,
              whiteSpace: style.whiteSpace };
          })
          .filter(row => row && (row.right > window.innerWidth + 1 || row.left < -1))
          .sort((a, b) => b.right - a.right)
          .slice(0, 20);
        return { documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth, offenders };
      });
      assert.ok(layout.documentWidth <= layout.viewportWidth + 1,
        "mobile section must not overflow horizontally: " + section
        + " (" + layout.documentWidth + "px document vs " + layout.viewportWidth + "px viewport); offenders="
        + JSON.stringify(layout.offenders));
      if (section === "europe") {
        const worldLayout = await page.evaluate(() => {
          const rect = selector => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const box = node.getBoundingClientRect();
            return { width: Math.round(box.width), left: Math.round(box.left), right: Math.round(box.right) };
          };
          const drawer = document.querySelector("#drawer");
          return {
            viewportWidth: window.innerWidth,
            page: rect("#page-europe"),
            grid: rect("#page-europe .world-ai-dashboard-grid"),
            card: rect("#worldAISimulationDashboard"),
            copy: rect("#worldAISimulationDashboard .cardHead > div"),
            drawerHidden: !!drawer && !drawer.classList.contains("open")
              && getComputedStyle(drawer).visibility === "hidden"
          };
        });
        assert.ok(worldLayout.page && worldLayout.page.width >= worldLayout.viewportWidth * 0.86,
          "world dashboard page must use the mobile viewport width: " + JSON.stringify(worldLayout));
        assert.ok(worldLayout.grid && worldLayout.grid.width >= worldLayout.page.width * 0.9,
          "world dashboard grid must not collapse into a narrow side column: " + JSON.stringify(worldLayout));
        assert.ok(worldLayout.card && worldLayout.card.width >= worldLayout.grid.width * 0.9,
          "world dashboard card must fill its grid: " + JSON.stringify(worldLayout));
        assert.ok(worldLayout.copy && worldLayout.copy.width >= worldLayout.card.width * 0.65,
          "world dashboard heading text must have a readable line width: " + JSON.stringify(worldLayout));
        assert.equal(worldLayout.drawerHidden, true,
          "the mobile side drawer must be hidden when closed: " + JSON.stringify(worldLayout));
      }
    }
    await page.locator("#shopItems [data-buy]").first().waitFor({ state: "attached" });
    assert.ok(await page.locator("#shopItems [data-buy]").count() > 0, "the player store must render purchasable items");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
      "the player-store screen must not overflow horizontally on a mobile viewport"
    );
    const directRatingPurchase = await page.evaluate(() => {
      const state = { pos: "جناح", age: 25, money: 1000 };
      const result = window.LWCareer.purchaseItem(state, { id: "ovrBoost", price: 100 });
      return { status: result.status, money: state.money, ownsBoost: Boolean(state.ovrBoost) };
    });
    assert.deepEqual(directRatingPurchase, {
      status: "direct-rating-purchase-disabled", money: 1000, ownsBoost: false
    }, "the embedded career engine must reject direct OVR purchases without mutating the save");
    results.push("embedded career engine blocks direct OVR purchase");
    const unknownStorePurchase = await page.evaluate(() => {
      const state = { pos: "جناح", age: 25, money: 1000 };
      const result = window.LWCareer.purchaseItem(state, { id: "futureMysteryBoost", price: 100 });
      return { status: result.status, money: state.money, ownsItem: Boolean(state.futureMysteryBoost) };
    });
    assert.deepEqual(unknownStorePurchase, {
      status: "invalid-item", money: 1000, ownsItem: false
    }, "the embedded career engine must reject unknown store IDs without mutating the save");
    results.push("embedded career engine blocks unknown store IDs");
    results.push("11-section navigation and store rendering");

    await page.evaluate(async () => {
      const state = window.LWStoryRuntime.getState();
      state.money = 3000;
      const saved = window.LWStoryRuntime.save();
      if (!saved) throw new Error("could not seed funds for XP multiplier purchase test");
      if (window.LWStateStore && typeof window.LWStateStore.flush === "function") await window.LWStateStore.flush(state);
    });
    await page.locator("#mobileMore").click();
    await page.locator('#drawer .navBtn[data-page="shop"]').click();
    await page.locator('#shopItems [data-buy="xpMultiplier"]').click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("تأكيد الشراء");
    });
    await page.locator("#modalChoices button").filter({ hasText: "اشتري دلوقتي" }).click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      return state.xpMultiplier === true && Number(state.money) === 600
        && document.querySelector("#inventory").textContent.includes("مضاعف خبرة المسيرة");
    }, null, { timeout: 15000 });
    results.push("store purchase changes balance and inventory");

    const saveDiagnostic = await page.evaluate(async () => {
      const state = window.LWStoryRuntime.getState();
      const stateChars = JSON.stringify(state).length;
      const worldChars = JSON.stringify(state.worldSimulation || {}).length;
      const saveSucceeded = window.LWStoryRuntime.save();
      if (window.LWStateStore && typeof window.LWStateStore.flush === "function") {
        await window.LWStateStore.flush(state);
      }
      let afterSave = null;
      if (window.LWStateStore && typeof window.LWStateStore.load === "function") {
        afterSave = await window.LWStateStore.load("career:default");
      }
      const raw = localStorage.getItem("lastWhistleCareer_v4") || "";
      return {
        stateMoney: Number(state.money), stateXPMultiplier: !!state.xpMultiplier,
        stateChars, worldChars,
        worldPlayers: Object.keys(state.worldSimulation?.players || {}).length,
        worldClubs: Object.keys(state.worldSimulation?.clubs || {}).length,
        worldProperties: Object.entries(state.worldSimulation || {}).map(([key, value]) => ({ key, chars: (() => { try { return JSON.stringify(value).length; } catch { return -1; } })(), count: Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : null })).sort((a,b) => b.chars-a.chars).slice(0,12),
        saveSucceeded, afterSavedMoney: afterSave ? Number(afterSave.money) : null,
        afterSavedXPMultiplier: afterSave ? !!afterSave.xpMultiplier : null,
        afterSavedChars: afterSave ? JSON.stringify(afterSave).length : raw.length,
        storageBackend: afterSave ? "IndexedDB" : "legacy-fallback"
      };
    });
    console.log("PURCHASE_SAVE_QUEUE_DIAGNOSTICS " + JSON.stringify(saveDiagnostic));
    assert.equal(saveDiagnostic.saveSucceeded, true,
      "saving after purchase must succeed; diagnostic=" + JSON.stringify(saveDiagnostic));
    assert.equal(saveDiagnostic.afterSavedMoney, 600, "IndexedDB must persist the post-purchase balance");
    assert.equal(saveDiagnostic.afterSavedXPMultiplier, true, "IndexedDB must persist store ownership");
    const persistedPurchase = {
      money: saveDiagnostic.afterSavedMoney,
      xpMultiplier: saveDiagnostic.afterSavedXPMultiplier,
      chars: saveDiagnostic.afterSavedChars,
      storageBackend: saveDiagnostic.storageBackend
    };
    console.log("PURCHASE_PERSISTENCE_VERIFIED " + JSON.stringify(persistedPurchase));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime && window.LWStoryRuntime.getState();
      return state && state.careerStarted && state.name === "Mohamed Ahmed"
        && state.xpMultiplier === true && Number(state.money) === 600
        && Number(state.schemaVersion) === 10
        && !document.querySelector("#startScreen").classList.contains("show");
    }, null, { timeout: 20000 });
    results.push("career and store ownership persist after reload");

    // Full backup must remain portable with the multi-thousand-player world simulation.
    await page.locator("#mobileMore").click();
    const [backupDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#exportSaveBtn").click()
    ]);
    const backupPath = await backupDownload.path();
    assert.ok(backupPath, "backup export must provide a downloadable file");
    const backupText = fs.readFileSync(backupPath, "utf8");
    const backupPayload = JSON.parse(backupText);
    assert.equal(backupPayload.game, "LAST WHISTLE");
    assert.equal(backupPayload.version, 7, "new backups must use the compressed backup format");
    assert.equal(backupPayload.encoding, "lz-string-utf16");
    assert.equal(typeof backupPayload.career, "string");
    assert.ok(fs.statSync(backupPath).size < 5000000, "large world save must fit within import size limit");
    const exportedBackupFacts = await page.evaluate(encoded => {
      const json = window.LZString.decompressFromUTF16(encoded);
      if (typeof json !== "string") throw new Error("exported backup did not decompress");
      const save = JSON.parse(json);
      return {
        name: save.name,
        money: Number(save.money),
        xpMultiplier: !!save.xpMultiplier,
        worldPlayers: Object.keys(save.worldSimulation?.players || {}).length,
        worldClubs: Object.keys(save.worldSimulation?.clubs || {}).length,
        hasSeasonDevelopment: !!save.seasonTrainingReport || !!save.seasonDevelopmentSnapshot
      };
    }, backupPayload.career);
    assert.equal(exportedBackupFacts.name, "Mohamed Ahmed");
    assert.equal(exportedBackupFacts.money, 600);
    assert.equal(exportedBackupFacts.xpMultiplier, true);
    assert.ok(exportedBackupFacts.worldPlayers > 1000, "backup must include the full player-world database");
    assert.ok(exportedBackupFacts.worldClubs > 100, "backup must include the world club database");
    // Make the live state observably different so the restore assertion cannot pass
    // against the pre-import career before the asynchronous file parser finishes.
    await page.evaluate(() => {
      window.LWStoryRuntime.getState().money = 49;
    });
    // The explicit save button belongs to the diary page. Check the durable IndexedDB slot
    // after flushing the current state; localStorage is only the legacy fallback now.
    await page.evaluate(() => window.LWStoryRuntime.showPage("diary"));
    await page.locator("#saveBtn").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#saveBtn").click();
    const sentinelMoney = await page.evaluate(async () => {
      const liveState = window.LWStoryRuntime.getState();
      if (window.LWStateStore && typeof window.LWStateStore.flush === "function") {
        await window.LWStateStore.flush(liveState);
        const saved = await window.LWStateStore.load("career:default");
        if (saved) return Number(saved.money);
      }
      const raw = localStorage.getItem("lastWhistleCareer_v4") || "";
      const json = raw.startsWith("LWZ1:") ? window.LZString.decompressFromUTF16(raw.slice(5)) : raw;
      return Number(JSON.parse(json).money);
    });
    assert.equal(sentinelMoney, 49, "the sentinel save must be persisted before the backup round-trip");
    await page.evaluate(() => {
      const host = document.querySelector("#toastHost");
      if (host) host.innerHTML = "";
      window.__backupRestoreNotices = [];
      if (host) {
        const observer = new MutationObserver(() => {
          const text = host.querySelector(".toast")?.textContent || "";
          if (text) window.__backupRestoreNotices.push(text);
        });
        observer.observe(host, { childList: true, subtree: true, characterData: true });
        window.__backupRestoreObserver = observer;
      }
    });
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#importSaveInput").setInputFiles(backupPath);
    await page.waitForFunction(() => {
      const notices = window.__backupRestoreNotices || [];
      return notices.some(text => text.includes("تمت استعادة")
        || text.includes("الملف غير صالح") || text.includes("تعذرت الاستعادة"));
    }, null, { timeout: 30000 });
    const restoreNotice = await page.evaluate(() => {
      window.__backupRestoreObserver?.disconnect();
      return (window.__backupRestoreNotices || []).join(" | ");
    });
    assert.ok(restoreNotice.includes("تمت استعادة"),
      "backup restore must complete successfully; observed notices: " + restoreNotice);
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime?.getState();
      return state && state.name === "Mohamed Ahmed" && state.xpMultiplier === true
        && Number(state.money) === 600
        && Object.keys(state.worldSimulation?.players || {}).length > 1000
        && Object.keys(state.worldSimulation?.clubs || {}).length > 100;
    }, null, { timeout: 30000 });
    await page.waitForFunction(() => {
      const drawer = document.querySelector("#drawer");
      return drawer && !drawer.classList.contains("open");
    }, null, { timeout: 10000 });
    results.push("compressed backup exports and restores the player career and full world AI database");

    await page.locator("#mobileMore").click();
    await page.locator('#drawer .navBtn[data-page="home"]').click();
    await page.waitForFunction(() => {
      const app = document.querySelector(".app.hasSidebar");
      const center = document.querySelector("#lw-command-center");
      const matchButton = document.querySelector("#lw-cta-match");
      return app?.getAttribute("data-active-page") === "home"
        && center && getComputedStyle(center).display !== "none"
        && matchButton && getComputedStyle(matchButton).visibility !== "hidden";
    }, null, { timeout: 10000 });
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
    assert.equal(await page.locator("#lw-cta-transfers").isVisible(), false,
      "the professional transfer shortcut must remain hidden for the under-18 career");
    const youthTransferFlags = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        age: state.age, academyCareer: state.academyCareer,
        academyReserve: state.academyReserve, academyGraduationPending: state.academyGraduationPending,
        academyGraduated: state.academyGraduated, freeAgent: state.freeAgent,
        winterBreakPending: state.winterBreakPending, calendarDay: state.calendarDay
      };
    });
    await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.age = 18;
      state.academyCareer = false;
      state.academyReserve = false;
      state.academyGraduationPending = false;
      state.academyGraduated = true;
      state.freeAgent = false;
      state.winterBreakPending = false;
      state.calendarDay = 15;
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.render();
    });
    await page.locator("#lw-cta-transfers").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#lw-cta-transfers").scrollIntoViewIfNeeded();
    await page.locator("#lw-cta-transfers").click();
    await page.waitForFunction(() => {
      const active = document.querySelector(".page.active");
      return active && active.id === "page-contract";
    }, null, { timeout: 10000 });
    await page.evaluate(flags => {
      Object.assign(window.LWStoryRuntime.getState(), flags);
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("home");
      window.LWStoryRuntime.render();
    }, youthTransferFlags);
    await page.waitForFunction(() => {
      const button = document.querySelector("#lw-cta-transfers");
      return !!button && (button.hidden || getComputedStyle(button).display === "none");
    }, null, { timeout: 10000 });
    results.push("youth transfer lock and age-eligible summer transfer-market navigation");

    // Regression: league/group cup fixtures must only be appended once to cup history.
    const cupPhaseFixture = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const backup = JSON.parse(JSON.stringify(state));
      const teams = [state.clubName, "كأس اختبار — منافس 1", "كأس اختبار — منافس 2", "كأس اختبار — منافس 3"];
      state.playedToday = false; state.trainedToday = false; state.injuryDays = 0;
      state.energy = 85; state.fatigue = 10; state.dailyActionUsed = false; state.dailyActionType = "";
      state.cupState = {
        name: "بطولة اختبار سجل المباريات", system: "uefa36", phase: "league", phaseGames: 4, phasePlayed: 0,
        teams,
        points: 0, gd: 0, gf: 0, rounds: [], stage: 0, twoLegs: [], tieLeg: 1, tieAggregate: 0,
        tieOpponent: "", eliminated: false, champion: false, history: [], matchesPlayed: 0,
        createdSeason: Number(state.season), createdCalendarDay: Number(state.calendarDay), rank: null,
        opponent: teams[1], bracketWins: 0, leagueOpponents: [], phaseResults: [], groupOpponents: {},
        groups: [], playerGroup: -1,
        standings: teams.map(name => ({ name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }))
      };
      window.LWStoryRuntime.showPage("europe");
      window.LWStoryRuntime.render();
      return { backup, clubName: state.clubName };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      const title = document.querySelector("#modalTitle");
      return Number(state.cupState?.phasePlayed) === 1 && title && title.textContent.includes("نتيجة البطولة");
    }, null, { timeout: 15000 });
    const cupPhaseResult = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        phasePlayed: Number(state.cupState.phasePlayed),
        matchesPlayed: Number(state.cupState.matchesPlayed),
        historyCount: state.cupState.history.length,
        history: state.cupState.history.slice()
      };
    });
    assert.equal(cupPhaseResult.phasePlayed, 1);
    assert.equal(cupPhaseResult.matchesPlayed, 1);
    assert.equal(cupPhaseResult.historyCount, 1, "a cup league/group match must create exactly one history entry");
    assert.ok(cupPhaseResult.history[0].includes("مرحلة الدوري"));
    results.push("cup phase match history is recorded once");
    await page.locator("#modalClose").click();
    await page.evaluate(backup => {
      const state = window.LWStoryRuntime.getState();
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, backup);
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("home");
      window.LWStoryRuntime.render();
    }, cupPhaseFixture.backup);

    // Regression: first-leg home advantage must depend on the current tie leg,
    // not the number of previous matches in the same cup.
    const cupTieFixture = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      const backup = JSON.parse(JSON.stringify(state));
      const teams = [state.clubName, "اختبار نصف النهائي", "اختبار نهائي", "اختبار احتياطي"];
      state.playedToday = false; state.trainedToday = false; state.injuryDays = 0;
      state.energy = 85; state.fatigue = 10; state.dailyActionUsed = false; state.dailyActionType = "";
      state.cupState = {
        name: "بطولة اختبار الذهاب والإياب", system: "knockout", phase: "knockout", phaseGames: 0, phasePlayed: 0,
        teams,
        points: 0, gd: 0, gf: 0, rounds: ["نصف النهائي", "النهائي"], stage: 0, twoLegs: [true, false],
        tieLeg: 1, tieAggregate: 0, tieOpponent: "", eliminated: false, champion: false, history: [],
        matchesPlayed: 3, createdSeason: Number(state.season), createdCalendarDay: Number(state.calendarDay),
        rank: null, opponent: teams[1], bracketWins: 0, leagueOpponents: [], phaseResults: [], groupOpponents: {},
        groups: [], playerGroup: -1,
        standings: teams.map(name => ({ name, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }))
      };
      window.LWStoryRuntime.showPage("europe");
      window.LWStoryRuntime.render();
      return { backup, opponent: teams[1] };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    await page.waitForFunction(() => {
      const state = window.LWStoryRuntime.getState();
      const title = document.querySelector("#modalTitle");
      return Number(state.cupState?.tieLeg) === 2 && title && title.textContent.includes("نتيجة البطولة");
    }, null, { timeout: 15000 });
    const tieLegResult = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        home: state.cupMatchHistory?.[0]?.home,
        tieLeg: Number(state.cupState.tieLeg),
        opponent: state.cupState.tieOpponent,
        stage: Number(state.cupState.stage),
        matchesPlayed: Number(state.cupState.matchesPlayed)
      };
    });
    assert.equal(tieLegResult.home, true, "the first leg must be a home match even when earlier cup rounds made the match count odd");
    assert.equal(tieLegResult.tieLeg, 2, "a first leg must keep the tie open for its return fixture");
    assert.equal(tieLegResult.opponent, cupTieFixture.opponent, "the second leg must preserve the first-leg opponent");
    assert.equal(tieLegResult.stage, 0, "a first leg must not advance the player to the next cup round");
    results.push("two-leg cup fixture keeps opponent and correct home/away leg");

    await page.locator("#modalClose").click();
    const invalidTieAggregateBefore = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.playedToday = false;
      state.trainedToday = false;
      state.energy = 85;
      state.fatigue = 10;
      state.dailyActionUsed = false;
      state.dailyActionType = "";
      state.cupState.tieLeg = 2;
      state.cupState.tieAggregate = true;
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.render();
      return {
        energy: Number(state.energy),
        matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay),
        historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length,
        tieAggregate: state.cupState.tieAggregate,
        tieLeg: Number(state.cupState.tieLeg)
      };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    const invalidTieAggregateAfter = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        energy: Number(state.energy),
        matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay),
        historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length,
        tieAggregate: state.cupState.tieAggregate,
        tieLeg: Number(state.cupState.tieLeg)
      };
    });
    assert.deepEqual(invalidTieAggregateAfter, invalidTieAggregateBefore,
      "an invalid second-leg aggregate must be rejected before energy, calendar, or match history changes");
    results.push("invalid second-leg cup aggregate is rejected without consuming a match action");

    const invalidTieLegBefore = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.cupState.tieAggregate = 0;
      state.cupState.tieLeg = 3;
      state.cupState.tieOpponent = state.cupState.teams[1];
      window.LWStoryRuntime.save();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, tieLeg: state.cupState.tieLeg
      };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    const invalidTieLegAfter = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, tieLeg: state.cupState.tieLeg
      };
    });
    assert.deepEqual(invalidTieLegAfter, invalidTieLegBefore,
      "an invalid tieLeg must be rejected before consuming a match action");
    results.push("invalid cup tieLeg is rejected without consuming a match action");

    const invalidTieOpponentBefore = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.cupState.tieLeg = 2;
      state.cupState.tieOpponent = { corrupted: true };
      window.LWStoryRuntime.save();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, tieOpponent: state.cupState.tieOpponent
      };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    const invalidTieOpponentAfter = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, tieOpponent: state.cupState.tieOpponent
      };
    });
    assert.deepEqual(invalidTieOpponentAfter, invalidTieOpponentBefore,
      "an invalid second-leg opponent must be rejected before consuming a match action");
    results.push("invalid second-leg opponent is rejected without consuming a match action");

    const malformedTwoLegsBefore = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.cupState.twoLegs = "true";
      window.LWStoryRuntime.save();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, twoLegs: state.cupState.twoLegs
      };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    const malformedTwoLegsAfter = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, twoLegs: state.cupState.twoLegs
      };
    });
    assert.deepEqual(malformedTwoLegsAfter, malformedTwoLegsBefore,
      "malformed twoLegs metadata must be rejected before consuming a match action");
    results.push("malformed twoLegs metadata is rejected without consuming a match action");

    const shortTwoLegsBefore = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.cupState.stage = 1;
      state.cupState.twoLegs = [true];
      window.LWStoryRuntime.save();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, stage: state.cupState.stage,
        twoLegs: state.cupState.twoLegs
      };
    });
    await page.locator("#cupActive [data-play-cup]").click();
    const shortTwoLegsAfter = await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      return {
        energy: Number(state.energy), matchesPlayed: Number(state.cupState.matchesPlayed),
        calendarDay: Number(state.calendarDay), historyLength: state.cupState.history.length,
        cupMatchHistoryLength: state.cupMatchHistory.length, stage: state.cupState.stage,
        twoLegs: state.cupState.twoLegs
      };
    });
    assert.deepEqual(shortTwoLegsAfter, shortTwoLegsBefore,
      "a twoLegs array missing the current knockout stage must be rejected before consuming a match action");
    results.push("incomplete twoLegs stage metadata is rejected without consuming a match action");

    await page.evaluate(backup => {
      const state = window.LWStoryRuntime.getState();
      Object.keys(state).forEach(key => delete state[key]);
      Object.assign(state, backup);
      window.LWStoryRuntime.save();
      window.LWStoryRuntime.showPage("home");
      window.LWStoryRuntime.render();
    }, cupTieFixture.backup);

    // Exercise the complete league season lifecycle, not just a single match.
    await page.evaluate(() => {
      const state = window.LWStoryRuntime.getState();
      state.age = Math.max(18, Number(state.age) || 18);
      state.academyCareer = false;
      state.academyReserve = false;
      state.academyGraduationPending = false;
      state.academyGraduated = true;
      // Isolate this season-lifecycle test from matches played by earlier smoke fixtures.
      state.seasonApps = 0;
      state.leagueApps = 0;
      // The CTA computes the midpoint before simulateSeasonBlock() calls ensureLeague().
      // Keep the target initialized in this clean fixture so the button cannot capture zero.
      const fixtureLeagueCount = Array.isArray(state.league) && state.league.length >= 2
        ? state.league.length
        : 12;
      state.seasonAppsTarget = Math.max(2, 2 * (fixtureLeagueCount - 1));
      // Avoid match-ID collisions with earlier fixtures in this same browser smoke run.
      state.leagueSegmentId = "browser-season-lifecycle-" + Date.now();
      state.leagueSegmentIsPartial = false;
      // Use the same season-aware fixture spacing as the simulation.
      // Place the midpoint fixture on calendar day 184 (start of the natural winter window).
      const fixtureMidpoint = Math.ceil(state.seasonAppsTarget / 2);
      const interval = Math.max(5, Math.min(15, Math.ceil(300 / Math.max(1, state.seasonAppsTarget))));
      state.calendarDay = 184 - Math.max(0, fixtureMidpoint - 1) * interval;
      state.day = Math.max(Number(state.day) || 1, 100);
      state.leagueRoundIndex = 0;
      state.leagueRoundHistory = [];
      state.seasonGoals = 0;
      state.seasonAssists = 0;
      state.seasonPoints = 0;
      state.seasonFinished = false;
      state.retired = false;
      state.calendarEvents = [];
      state.playedToday = false;
      state.trainedToday = false;
      state.lastLeagueMatchCalendarDay = 0;
      state.winterBreakPending = false;
      state.seasonPhase = "firstHalf";
      state.trainingIntensity = "intense";
      window.LWStoryRuntime.save();
    });
    await page.locator("#mobileMore").click();
    await page.locator('#drawer .navBtn[data-page="home"]').click();
    await page.locator("#lw-cta-season").click();
    await page.waitForFunction(() => {
      const title = document.querySelector("#modalTitle");
      return document.querySelector("#modalShade").classList.contains("open")
        && title && title.textContent.includes("محاكاة الموسم");
    }, null, { timeout: 10000 });
    await page.locator("#modalChoices button").filter({ hasText: "ابدأ الموسم" }).click();
    try {
      await page.waitForFunction(() => {
        const state = window.LWStoryRuntime.getState();
        const title = document.querySelector("#modalTitle");
        return state.winterBreakPending === true
          && Number(state.seasonApps) >= Math.ceil((Number(state.seasonAppsTarget) || 34) / 2)
          && title && title.textContent.includes("ملخص منتصف الموسم");
      }, null, { timeout: 30000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const state = window.LWStoryRuntime.getState();
        const title = document.querySelector("#modalTitle");
        return {
          calendarDay: Number(state.calendarDay) || 0,
          seasonApps: Number(state.seasonApps) || 0,
          seasonAppsTarget: Number(state.seasonAppsTarget) || 0,
          seasonPhase: state.seasonPhase || "",
          winterBreakPending: !!state.winterBreakPending,
          lastLeagueMatchCalendarDay: Number(state.lastLeagueMatchCalendarDay) || 0,
          pendingCalendarEvents: Array.isArray(state.calendarEvents) ? state.calendarEvents.length : 0,
          seasonFinished: !!state.seasonFinished,
          retired: !!state.retired,
          leagueCount: Array.isArray(state.league) ? state.league.length : -1,
          fixtureRoundCount: Array.isArray(state.fixtureSchedule) ? state.fixtureSchedule.length : -1,
          leagueRoundIndex: Number(state.leagueRoundIndex) || 0,
          modalTitle: title?.textContent || ""
        };
      });
      throw new Error("Season did not reach winter break: " + JSON.stringify(diagnostic) + "; " + error.message);
    }
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
      state.age = Math.max(18, Number(state.age) || 18);
      state.apps = Math.max(2, Number(state.apps) || 0);
      state.trust = Math.max(60, Number(state.trust) || 0);
      state.daysSinceTransfer = Math.max(14, Number(state.daysSinceTransfer) || 0);
      state.academyReserve = false;
      state.academyGraduationPending = false;
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
        // The smoke test verifies the negotiation flow, not whether this generated career can join a top-tier club.
        power: Math.min(Number(target.ovr) || 60, 45),
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
      // Simulate continuing into the second half while the January window is still open.
      // Offers saved by older builds use winter-season-N and must remain negotiable.
      state.winterBreakPending = false;
      state.seasonPhase = "secondHalf";
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

    await page.locator("#mobileMore").click();
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
        trainingIntensity: state.trainingIntensity,
        schemaVersion: Number(state.schemaVersion),
        historyCount: Array.isArray(state.seasonHistory) ? state.seasonHistory.length : 0,
        trainingSessions: Number(state.seasonTrainingReport?.sessions) || 0,
        trainingXP: Number(state.seasonTrainingReport?.xp) || 0,
        developmentRecord: Array.isArray(state.seasonDevelopmentHistory)
          ? state.seasonDevelopmentHistory.find(row => Number(row.season) === Number(state.season)) || null
          : null,
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
    assert.equal(completedSeason.trainingIntensity, "intense", "AI season simulation must not overwrite the user's selected training intensity");
    assert.equal(completedSeason.schemaVersion, 10, "the loaded/saved career must use the current schema version");
    assert.equal(completedSeason.apps, completedSeason.target, "a season cannot be marked complete before all scheduled matches are played");
    assert.ok(completedSeason.historyCount > 0, "the completed season must be archived");
    assert.equal(completedSeason.hasSummary, true, "the season report must be saved");
    assert.ok(completedSeason.trainingSessions > 0, "season simulation must execute automatic AI training sessions");
    assert.ok(completedSeason.trainingXP > 0, "automatic training must accumulate training XP");
    assert.ok(completedSeason.developmentRecord, "the completed season must archive its player-development record");
    assert.equal(Number(completedSeason.developmentRecord.season), completedSeason.season);
    assert.equal(Number(completedSeason.developmentRecord.sessions), completedSeason.trainingSessions,
      "the season-development archive must reconcile with its training-session ledger");
    assert.ok(completedSeason.awardCeremonyCount > 0, "finishing a season must persist an award ceremony");
    assert.equal(completedSeason.awardNomineeCount, 5, "the ceremony must persist the five Ballon d'Or nominees");
    assert.ok(completedSeason.awardCeremonyText.includes("الكرة الذهبية"), "the award ceremony must render in the real UI");
    assert.ok(completedSeason.awardCeremonyText.includes("أفضل 5 مرشحين"), "the UI must display the Ballon d'Or shortlist");
    assert.ok(completedSeason.currentCompetitionCount > 0, "current competitions must remain linked to the player season");
    assert.ok(completedSeason.goldenBootRowCount > 0, "the golden-boot leaderboard must render player rows");
    assert.ok(completedSeason.playmakerRowCount > 0, "the playmaker leaderboard must render player rows");
    results.push("season totals, award ceremony, Ballon d'Or shortlist, trophy cabinet, competitions and leaderboards reconcile");

    // The end-of-season report is modal; close it before testing the page drawer.
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#modalShade")?.classList.contains("open"));
    const mobileRoutes = ["home", "training", "stats", "wellness", "league", "contract", "national", "shop", "europe", "life", "diary", "social"];
    const mobileLayoutAudit = [];
    for (const route of mobileRoutes) {
      const layout = await page.evaluate(async routeName => {
        window.LWStoryRuntime.showPage(routeName);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const viewport = window.innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const worldGrid = routeName === "europe" ? document.querySelector("#page-europe .world-ai-dashboard-grid") : null;
        const worldGridWidth = worldGrid ? Math.round(worldGrid.getBoundingClientRect().width) : null;
        const worldCardWidths = worldGrid
          ? Array.from(worldGrid.querySelectorAll(".world-ai-dashboard-card")).map(card => Math.round(card.getBoundingClientRect().width))
          : [];
        const offenders = Array.from(document.querySelectorAll("body *")).filter(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed" || style.position === "sticky") return false;
          if (rect.width <= 0 || rect.height <= 0) return false;
          return rect.left < -1 || rect.right > viewport + 1;
        }).slice(0, 8).map(element => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || "",
            className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth
          };
        });
        const directory = document.querySelector("#globalDirectoryPanel");
        const directoryPage = directory ? directory.closest(".page") : null;
        const directoryRect = directory ? directory.getBoundingClientRect() : null;
        const activePages = Array.from(document.querySelectorAll("main > .page.active")).map(page => page.id);
        const directoryVisible = Boolean(directory && directoryPage
          && directoryPage.parentElement === document.querySelector("main")
          && getComputedStyle(directoryPage).display !== "none"
          && directoryRect && directoryRect.width > 0 && directoryRect.height > 0);
        return {
          route: routeName, viewport, documentWidth, bodyWidth, worldGridWidth, worldCardWidths, offenders,
          activePages, directoryCount: document.querySelectorAll("#globalDirectoryPanel").length,
          directoryPage: directoryPage ? directoryPage.id : null, directoryVisible
        };
      }, route);
      mobileLayoutAudit.push(layout);
      assert.deepEqual(layout.activePages, ["page-" + route],
        "only the selected page may be active on mobile: " + JSON.stringify(layout));
      assert.equal(layout.directoryCount, 1,
        "the global football directory must exist exactly once: " + JSON.stringify(layout));
      assert.equal(layout.directoryPage, "page-europe",
        "the global football directory must remain inside the dedicated World Football page: " + JSON.stringify(layout));
      assert.equal(layout.directoryVisible, route === "europe",
        "the global football directory must be visible only on the World Football page: " + JSON.stringify(layout));
      assert.ok(
        layout.documentWidth <= layout.viewport + 1 && layout.bodyWidth <= layout.viewport + 1,
        "mobile page '" + route + "' has horizontal overflow: " + JSON.stringify(layout)
      );
      if (route === "europe") {
        assert.ok(layout.worldGridWidth !== null, "the world dashboard grid must exist on the Europe page");
        assert.ok(
          layout.worldGridWidth >= layout.viewport * 0.82,
          "the mobile world dashboard must use the available width instead of collapsing into a narrow column: " + JSON.stringify(layout)
        );
        assert.ok(
          layout.worldCardWidths.length > 0 && layout.worldCardWidths.every(width => width >= layout.viewport * 0.72),
          "world dashboard cards must remain readable and full-width on mobile: " + JSON.stringify(layout)
        );
      }
    }
    await page.evaluate(() => window.LWStoryRuntime.showPage("home"));

    // The Career Hub must not mix the dark app shell with legacy white cards.
    const careerThemeAudit = await page.evaluate(() => {
      const surfaces = [
        [".hub-launch-panel", "rgb(16, 23, 18)"],
        [".hub-tile", "rgb(18, 29, 22)"],
        [".hub-training-card .trainingControls", "rgb(17, 26, 20)"],
        [".hub-training-rules>div", "rgb(17, 26, 20)"],
        [".hub-readiness-feature", "rgb(16, 24, 19)"],
        [".hub-readiness-score", "rgb(21, 32, 25)"],
        [".hub-injury-panel", "rgb(21, 32, 25)"],
        [".hub-recovery-action", "rgb(17, 26, 20)"],
        [".hub-definition", "rgb(17, 26, 20)"]
      ];
      return surfaces.map(([selector, expected]) => {
        const element = document.querySelector(selector);
        return { selector, expected, actual: element ? getComputedStyle(element).backgroundColor : null };
      });
    });
    for (const surface of careerThemeAudit) {
      assert.ok(surface.actual, "Career Hub surface is missing: " + surface.selector);
      assert.equal(surface.actual, surface.expected,
        "Career Hub surface must use the shared dark theme: " + JSON.stringify(surface));
    }
    const careerTypeAudit = await page.evaluate(() => [
      [".hub-tile-desc", "10px"],
      [".hub-training-card .trainingNote", "10px"],
      [".hub-recovery-action p", "10px"]
    ].map(([selector, expected]) => {
      const element = document.querySelector(selector);
      return { selector, expected, actual: element ? getComputedStyle(element).fontSize : null };
    }));
    for (const type of careerTypeAudit) {
      assert.equal(type.actual, type.expected,
        "Career Hub helper text must remain readable on mobile: " + JSON.stringify(type));
    }
    results.push("Career Hub dark-theme consistency and readable mobile helper text");


    // Mobile navigation uses four primary tabs and a More drawer with focus restoration.
    const mobileNavShape = await page.evaluate(() => {
      const nav = document.querySelector(".bottomNav");
      const more = document.querySelector("#mobileMore");
      const menu = document.querySelector("#menuOpen");
      const buttons = Array.from(nav.querySelectorAll("button"));
      return {
        buttonCount: buttons.length,
        routes: buttons.filter(button => button.dataset.page).map(button => button.dataset.page),
        moreVisible: Boolean(more && getComputedStyle(more).display !== "none"),
        moreHeight: more ? Math.round(more.getBoundingClientRect().height) : 0,
        headerMenuHidden: menu ? getComputedStyle(menu).display === "none" : false,
        navFits: nav.scrollWidth <= nav.clientWidth + 1
      };
    });
    assert.equal(mobileNavShape.buttonCount, 5, "mobile bottom navigation must have five evenly-spaced actions");
    assert.deepEqual(mobileNavShape.routes, ["home", "training", "stats", "wellness"],
      "the mobile bottom bar must prioritize the four most-used player destinations");
    assert.equal(mobileNavShape.moreVisible, true, "the More entry must remain visible on mobile");
    assert.ok(mobileNavShape.moreHeight >= 44, "the More entry must meet the minimum touch-target height");
    assert.equal(mobileNavShape.headerMenuHidden, true,
      "mobile must have one clear entry to the full drawer rather than duplicate hamburger controls");
    assert.equal(mobileNavShape.navFits, true, "the five-action mobile bar must fit without internal horizontal scrolling");
    await page.locator("#mobileMore").click();
    await page.waitForFunction(() => document.querySelector("#drawer")?.classList.contains("open"));
    const mobileDrawerOpen = await page.evaluate(() => ({
      moreExpanded: document.querySelector("#mobileMore").getAttribute("aria-expanded"),
      headerExpanded: document.querySelector("#menuOpen").getAttribute("aria-expanded"),
      hidden: document.querySelector("#drawer").getAttribute("aria-hidden"),
      inert: document.querySelector("#drawer").hasAttribute("inert"),
      focusInside: document.querySelector("#drawer").contains(document.activeElement)
    }));
    assert.equal(mobileDrawerOpen.moreExpanded, "true", "More must expose the expanded drawer state");
    assert.equal(mobileDrawerOpen.headerExpanded, "true", "both drawer triggers must share the expanded state");
    assert.equal(mobileDrawerOpen.hidden, null, "the open drawer must be exposed to assistive technology");
    assert.equal(mobileDrawerOpen.inert, false, "the open drawer must be keyboard accessible");
    assert.equal(mobileDrawerOpen.focusInside, true, "opening More must move focus into the drawer");
    await page.locator('#drawer .navBtn[data-page="diary"]').click();
    await page.waitForFunction(() => document.querySelector("#page-diary")?.classList.contains("active")
      && !document.querySelector("#drawer")?.classList.contains("open"));
    const mobileDrawerClosed = await page.evaluate(() => ({
      moreExpanded: document.querySelector("#mobileMore").getAttribute("aria-expanded"),
      headerExpanded: document.querySelector("#menuOpen").getAttribute("aria-expanded"),
      moreActive: document.querySelector("#mobileMore").classList.contains("active"),
      hidden: document.querySelector("#drawer").getAttribute("aria-hidden"),
      inert: document.querySelector("#drawer").hasAttribute("inert"),
      focusReturned: document.activeElement === document.querySelector("#mobileMore"),
      currentPage: document.querySelector('#drawer .navBtn[data-page="diary"]').getAttribute("aria-current")
    }));
    assert.equal(mobileDrawerClosed.moreExpanded, "false", "closing More must reset expanded state");
    assert.equal(mobileDrawerClosed.headerExpanded, "false", "the header trigger state must remain synchronized");
    assert.equal(mobileDrawerClosed.moreActive, true, "More must indicate when a non-primary section is active");
    assert.equal(mobileDrawerClosed.hidden, "true", "the closed drawer must be hidden from assistive technology");
    assert.equal(mobileDrawerClosed.inert, true, "the closed drawer must not remain keyboard-focusable");
    assert.equal(mobileDrawerClosed.focusReturned, true, "navigation must restore focus to the More trigger");
    assert.equal(mobileDrawerClosed.currentPage, "page", "the selected drawer route must remain marked current");
    await page.locator('.bottomNav [data-page="wellness"]').click();
    const quickTabAfterDrawer = await page.evaluate(() => ({
      pageActive: document.querySelector("#page-wellness")?.classList.contains("active"),
      moreActive: document.querySelector("#mobileMore")?.classList.contains("active"),
      ariaCurrent: document.querySelector('.bottomNav [data-page="wellness"]')?.getAttribute("aria-current")
    }));
    assert.equal(quickTabAfterDrawer.pageActive, true, "primary tabs must still navigate after using More");
    assert.equal(quickTabAfterDrawer.moreActive, false, "More should not look selected on a primary tab");
    assert.equal(quickTabAfterDrawer.ariaCurrent, "page", "the active primary tab must expose aria-current");
    results.push("five-item mobile navigation, More drawer, aria state, and focus restoration");

    // The transfer-market search has a programmatic label, and its result count is announced.
    await page.evaluate(() => window.LWStoryRuntime.showPage("contract"));
    const contractMarketAccess = await page.evaluate(() => {
      const search = document.querySelector("#transferSearch");
      const count = document.querySelector("#transferMarketCount");
      const list = document.querySelector("#transferMarket");
      const kpiLabel = document.querySelector("#page-contract .kpiLabel");
      return {
        type: search?.type,
        label: search?.getAttribute("aria-label"),
        controls: search?.getAttribute("aria-controls"),
        description: search?.getAttribute("aria-describedby"),
        countRole: count?.getAttribute("role"),
        countLive: count?.getAttribute("aria-live"),
        countAtomic: count?.getAttribute("aria-atomic"),
        resultsLabel: list?.getAttribute("aria-label"),
        searchFits: !!search && search.getBoundingClientRect().right <= window.innerWidth + 1
          && search.getBoundingClientRect().width > 0,
        kpiLabelSize: kpiLabel ? getComputedStyle(kpiLabel).fontSize : null
      };
    });
    assert.equal(contractMarketAccess.type, "search", "transfer-market filter must use a search input");
    assert.equal(contractMarketAccess.label, "ابحث عن نادٍ أو دوري أو دولة",
      "transfer-market search must have a programmatic Arabic label");
    assert.equal(contractMarketAccess.controls, "transferMarket",
      "transfer-market search must identify its results region");
    assert.equal(contractMarketAccess.description, "transferMarketNotice",
      "transfer-market search must point to the eligibility and market explanation");
    assert.equal(contractMarketAccess.countRole, "status", "the result count must be exposed as a status region");
    assert.equal(contractMarketAccess.countLive, "polite", "result updates must be announced without interrupting");
    assert.equal(contractMarketAccess.countAtomic, "true", "the entire result count must be announced together");
    assert.equal(contractMarketAccess.resultsLabel, "نتائج سوق الأندية", "the results region must have an accessible name");
    assert.equal(contractMarketAccess.searchFits, true, "the contract search field must fit the mobile viewport");
    assert.equal(contractMarketAccess.kpiLabelSize, "11px", "contract KPI labels must be readable on mobile");
    results.push("contract market search accessibility, live result count, and readable KPI labels");

    // Secondary labels on the statistics, competition, and contract pages share one readable scale.
    await page.evaluate(() => window.LWStoryRuntime.showPage("stats"));
    const statsTypography = await page.evaluate(() => ({
      kpi: document.querySelector("#page-stats .hub-stats-summary .kpiLabel")
        ? getComputedStyle(document.querySelector("#page-stats .hub-stats-summary .kpiLabel")).fontSize : null,
      copy: document.querySelector("#page-stats .muted.small")
        ? getComputedStyle(document.querySelector("#page-stats .muted.small")).fontSize : null
    }));
    assert.equal(statsTypography.kpi, "11px", "statistics KPI labels must use the readable secondary type scale");
    assert.equal(statsTypography.copy, "11px", "statistics explanatory copy must remain readable on mobile");
    await page.evaluate(() => window.LWStoryRuntime.showPage("league"));
    const leagueTypography = await page.evaluate(() => {
      const element = document.querySelector("#page-league .muted.small");
      return element ? getComputedStyle(element).fontSize : null;
    });
    assert.equal(leagueTypography, "11px", "competition explanatory copy must use the readable secondary type scale");
    await page.evaluate(() => window.LWStoryRuntime.showPage("contract"));
    results.push("readable secondary typography on stats, competition, and contract pages");





    results.push("mobile horizontal-overflow audit across all 12 career/world/social pages");

    // At tablet widths the redesign hides the bottom bar and moves the drawer off-canvas.
    // The hamburger must remain visible so every page remains reachable.
    await page.setViewportSize({ width: 820, height: 900 });
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    ));
    const tabletNavigationBefore = await page.evaluate(() => {
      const menu = document.querySelector("#menuOpen");
      const bottom = document.querySelector(".bottomNav");
      const drawer = document.querySelector("#drawer");
      const menuRect = menu.getBoundingClientRect();
      return {
        menuVisible: getComputedStyle(menu).display !== "none" && menuRect.width >= 30 && menuRect.height >= 30,
        bottomNavigationHidden: getComputedStyle(bottom).display === "none",
        drawerInitiallyClosed: !drawer.classList.contains("open"),
        drawerAriaHidden: drawer.getAttribute("aria-hidden"),
        drawerInert: drawer.hasAttribute("inert"),
        menuExpanded: menu.getAttribute("aria-expanded")
      };
    });
    assert.equal(tabletNavigationBefore.menuVisible, true,
      "tablet navigation must expose a working hamburger between 761px and 1000px: " + JSON.stringify(tabletNavigationBefore));
    assert.equal(tabletNavigationBefore.bottomNavigationHidden, true,
      "tablet layout should use the sidebar drawer rather than the narrow mobile bottom bar");
    assert.equal(tabletNavigationBefore.drawerInitiallyClosed, true,
      "tablet drawer should start closed to preserve the content width");
    assert.equal(tabletNavigationBefore.drawerAriaHidden, "true",
      "closed tablet drawer must be hidden from assistive technology");
    assert.equal(tabletNavigationBefore.drawerInert, true,
      "closed tablet drawer must not contain keyboard-focusable controls");
    assert.equal(tabletNavigationBefore.menuExpanded, "false",
      "the menu trigger must expose the collapsed state");
    await page.locator("#menuOpen").click();
    await page.waitForFunction(() => {
      const drawer = document.querySelector("#drawer");
      const rect = drawer.getBoundingClientRect();
      return drawer.classList.contains("open") && rect.width > 0
        && rect.left < window.innerWidth && rect.right <= window.innerWidth + 1;
    }, null, { timeout: 5000 });
    const drawerAccessible = await page.evaluate(() => {
      const drawer = document.querySelector("#drawer");
      return {
        expanded: document.querySelector("#menuOpen").getAttribute("aria-expanded"),
        ariaHidden: drawer.getAttribute("aria-hidden"),
        inert: drawer.hasAttribute("inert"),
        focusInsideDrawer: drawer.contains(document.activeElement)
      };
    });
    assert.equal(drawerAccessible.expanded, "true", "opening the tablet drawer must expose aria-expanded=true");
    assert.equal(drawerAccessible.ariaHidden, null, "open drawer must be exposed to assistive technology");
    assert.equal(drawerAccessible.inert, false, "open drawer controls must become keyboard accessible");
    assert.equal(drawerAccessible.focusInsideDrawer, true, "opening the drawer must move focus into it");
    await page.locator('#drawer .navBtn[data-page="training"]').click();
    await page.waitForFunction(() => {
      return document.querySelector("#page-training")?.classList.contains("active")
        && !document.querySelector("#drawer")?.classList.contains("open");
    }, null, { timeout: 5000 });
    const drawerAfterNavigation = await page.evaluate(() => ({
      expanded: document.querySelector("#menuOpen").getAttribute("aria-expanded"),
      ariaHidden: document.querySelector("#drawer").getAttribute("aria-hidden"),
      inert: document.querySelector("#drawer").hasAttribute("inert"),
      currentPage: document.querySelector('#drawer .navBtn[data-page="training"]').getAttribute("aria-current"),
      focusReturned: document.activeElement === document.querySelector("#menuOpen")
    }));
    assert.equal(drawerAfterNavigation.expanded, "false", "closing the drawer must reset aria-expanded");
    assert.equal(drawerAfterNavigation.ariaHidden, "true", "closed drawer must return to aria-hidden");
    assert.equal(drawerAfterNavigation.inert, true, "closed drawer must return to inert");
    assert.equal(drawerAfterNavigation.currentPage, "page",
      "active navigation must expose aria-current=page");
    assert.equal(drawerAfterNavigation.focusReturned, true, "closing the drawer must restore focus to its trigger");
    results.push("tablet navigation and drawer keyboard/accessibility state at 820px");

    // Modal dialogs must receive focus, keep keyboard focus inside, and return it on close.
    await page.evaluate(() => window.LWStoryRuntime.showPage("contract"));
    await page.locator("#contractDetailsBtn").click();
    await page.waitForFunction(() => document.querySelector("#modalShade")?.classList.contains("open"));
    const modalInitialFocus = await page.evaluate(() => ({
      role: document.querySelector("#modalShade")?.getAttribute("role"),
      modal: document.querySelector("#modalShade")?.getAttribute("aria-modal"),
      focusInside: document.querySelector("#modalShade .modal")?.contains(document.activeElement)
    }));
    assert.equal(modalInitialFocus.role, "dialog", "modal must expose dialog semantics");
    assert.equal(modalInitialFocus.modal, "true", "modal must be announced as modal");
    assert.equal(modalInitialFocus.focusInside, true, "opening a modal must move focus into the dialog");
    await page.keyboard.press("Shift+Tab");
    const wrappedBackwards = await page.evaluate(() => document.querySelector("#modalShade .modal")?.contains(document.activeElement));
    assert.equal(wrappedBackwards, true, "Shift+Tab from the first modal control must wrap within the dialog");
    await page.keyboard.press("Tab");
    const wrappedForwards = await page.evaluate(() => document.querySelector("#modalShade .modal")?.contains(document.activeElement));
    assert.equal(wrappedForwards, true, "Tab from the last modal control must wrap within the dialog");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#modalShade")?.classList.contains("open"));
    const modalFocusRestored = await page.evaluate(() => document.activeElement === document.querySelector("#contractDetailsBtn"));
    assert.equal(modalFocusRestored, true, "closing a modal must restore focus to the control that opened it");
    results.push("modal focus entry, keyboard trap, Escape close, and focus restoration");

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

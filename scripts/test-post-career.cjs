#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const rootHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.equal(rootHtml, html, "root and public app shells must stay identical");
function extractFunction(name) {
  const match = new RegExp("(?:async\\s+)?function\\s+" + name + "\\(").exec(html);
  assert.ok(match, "Missing game function: " + name);
  const start = match.index;
  const next = /\n(?:async\s+)?function\s+/.exec(html.slice(start + match[0].length));
  const end = next ? start + match[0].length + next.index : html.length;
  return html.slice(start, end);
}
const source = "let postCareerMutationPending=false;\n" + [
  "runPostCareerMutation", "startPostCareerPath", "openPostCareerMenu", "performPostCareerAction"
].map(extractFunction).join("\n");
function makeSandbox(overrides = {}) {
  const { flushQueue = [], saveQueue = [], ...stateOverrides } = overrides;
  const flushResults = flushQueue.slice(), saveResults = saveQueue.slice();
  const notices = [], logs = [], stories = [], modals = [];
  const counters = { saves: 0, flushes: 0, renders: 0 };
  const state = { retired:true, retirementRecord:{age:40}, season:10, clubName:"Test FC",
    clubPower:60, professionalism:65, money:50000, randomSeed:1234, ...stateOverrides };
  const sandbox = {
    state, club:()=>({name:state.clubName||"Test FC"}),
    toast:message=>notices.push(String(message)),
    clamp:(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0)),
    log:message=>logs.push(String(message)),
    setStory:(title,body)=>stories.push({title:String(title),body:String(body)}),
    cloneSeasonTransitionState:value=>JSON.parse(JSON.stringify(value)),
    restoreSeasonTransitionState:snapshot=>{
      Object.keys(state).forEach(key=>{if(!Object.prototype.hasOwnProperty.call(snapshot,key))delete state[key];});
      Object.keys(snapshot).forEach(key=>{state[key]=snapshot[key];});
    },
    saveGame:()=>{counters.saves++;return saveResults.length?saveResults.shift():true;},
    flushQueuedSave:()=>{
      counters.flushes++;
      const next=flushResults.length?flushResults.shift():true;
      return typeof next==="function"?next():Promise.resolve(next);
    },
    render:()=>{counters.renders++;},
    openModal:(title,body,choices)=>modals.push({title:String(title),body:String(body),choices}),
    newCareer:()=>{state.resetRequested=true;}, showPage:page=>{state.lastPage=page;},
    currencyLabel:()=>"£", randomUnit:()=>0.01, console:{error:()=>{},warn:()=>{}}
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:"post-career-actions"});
  return {sandbox,state,notices,logs,stories,modals,counters,flushResults};
}
(async()=>{
  const agent=makeSandbox();
  assert.equal(await agent.sandbox.startPostCareerPath("agent"),true);
  assert.equal(agent.state.postCareer.path,"agent","agent path must be durably saved");
  assert.equal(agent.modals.at(-1).title,"وكالة اللاعبين");
  assert.equal(agent.counters.flushes,1,"starting a path must await a durable flush");
  await agent.sandbox.performPostCareerAction("scout");
  assert.equal(agent.state.postCareer.clients,1);
  assert.ok(agent.state.money>50000);
  assert.ok(agent.state.postCareer.earnings>0);
  assert.match(agent.state.postCareer.lastAction,/أتعاب/);
  await agent.sandbox.performPostCareerAction("negotiate");
  assert.ok(agent.state.postCareer.actions>=2);
  assert.ok(agent.logs.some(row=>row.includes("مرحلة ما بعد الاعتزال")));
  assert.equal(agent.counters.flushes,3,"each successful agency action must be flushed");
  const investor=makeSandbox();
  assert.equal(await investor.sandbox.startPostCareerPath("investor"),true);
  await investor.sandbox.performPostCareerAction("buy-share");
  assert.equal(investor.state.postCareer.shares,1);
  assert.ok(investor.state.postCareer.investment>0);
  await investor.sandbox.performPostCareerAction("operate-year");
  assert.equal(investor.state.postCareer.yearsOperated,1);
  assert.equal(investor.state.postCareer.dividendsDue,1);
  await investor.sandbox.performPostCareerAction("dividend");
  assert.equal(investor.state.postCareer.dividendsDue,0);
  assert.ok(investor.state.postCareer.earnings>0);
  const moneyAfterDividend=investor.state.money;
  await investor.sandbox.performPostCareerAction("dividend");
  assert.equal(investor.state.money,moneyAfterDividend,"dividends cannot be claimed twice");
  assert.ok(investor.notices.length>0);
  assert.equal(investor.counters.flushes,4,"invalid duplicate claims must not create another save");
  const inactive=makeSandbox({retired:false,retirementRecord:null});
  assert.equal(await inactive.sandbox.startPostCareerPath("agent"),false);
  assert.equal(inactive.state.postCareer,undefined);
  assert.ok(inactive.notices.length>0);
  const failedStart=makeSandbox({flushQueue:[false,true]});
  assert.equal(await failedStart.sandbox.startPostCareerPath("agent"),false);
  assert.equal(failedStart.state.postCareer,undefined,"failed path creation must restore prior state");
  assert.equal(failedStart.counters.saves,2);
  assert.equal(failedStart.counters.flushes,2,"rollback persistence must be awaited");
  assert.ok(failedStart.notices.some(message=>message.includes("استعادة بيانات المسيرة")));
  const failedScout=makeSandbox();
  assert.equal(await failedScout.sandbox.startPostCareerPath("agent"),true);
  const moneyBeforeScout=failedScout.state.money;
  failedScout.flushResults.push(false,true);
  assert.equal(await failedScout.sandbox.performPostCareerAction("scout"),false);
  assert.equal(failedScout.state.money,moneyBeforeScout,"failed scout save must refund cost and fee");
  assert.equal(failedScout.state.postCareer.clients,0);
  assert.equal(failedScout.state.postCareer.actions,0);
  assert.equal(failedScout.counters.flushes,3);
  const failedDividend=makeSandbox();
  await failedDividend.sandbox.startPostCareerPath("investor");
  await failedDividend.sandbox.performPostCareerAction("buy-share");
  await failedDividend.sandbox.performPostCareerAction("operate-year");
  const moneyBeforeDividend=failedDividend.state.money;
  failedDividend.flushResults.push(false,true);
  assert.equal(await failedDividend.sandbox.performPostCareerAction("dividend"),false);
  assert.equal(failedDividend.state.money,moneyBeforeDividend);
  assert.equal(failedDividend.state.postCareer.dividendsDue,1);
  assert.equal(failedDividend.state.postCareer.earnings,0);
  const failedQueue=makeSandbox({saveQueue:[false,true],flushQueue:[true]});
  assert.equal(await failedQueue.sandbox.startPostCareerPath("investor"),false);
  assert.equal(failedQueue.state.postCareer,undefined);
  assert.equal(failedQueue.counters.flushes,1);
  let releaseFlush;
  const pending=makeSandbox({flushQueue:[()=>new Promise(resolve=>{releaseFlush=resolve;})]});
  const firstStart=pending.sandbox.startPostCareerPath("agent");
  assert.equal(pending.state.postCareer.path,"agent");
  assert.equal(await pending.sandbox.startPostCareerPath("investor"),false);
  assert.equal(pending.state.postCareer.path,"agent");
  releaseFlush(true);
  assert.equal(await firstStart,true);
  assert.equal(pending.counters.saves,1);
  const postCareerFunctions=[extractFunction("startPostCareerPath"),extractFunction("performPostCareerAction")].join("\n");
  assert.doesNotMatch(postCareerFunctions,/saveGame\(true\)/);
  assert.match(extractFunction("runPostCareerMutation"),/flushQueuedSave\(\{backupFirst:true\}\)/);
  const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  const publicSw=fs.readFileSync(path.join(root,"public","sw.js"),"utf8");
  assert.equal(sw,publicSw);
  require("./assert-static-cache-version.cjs")(sw,429);
  console.log("PASS: post-career agency and investment actions are durable, rollback-safe, and protected against repeated clicks.");
})().catch(error=>{console.error(error);process.exitCode=1;});

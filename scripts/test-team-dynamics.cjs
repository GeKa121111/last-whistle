"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "team-dynamics.js"), "utf8");
const deployed = fs.readFileSync(path.join(root, "public", "team-dynamics.js"), "utf8");
assert.equal(source, deployed, "root/public team dynamics scripts must remain byte-identical");

const players = {
  p1:{id:"p1",name:"Captain Candidate",clubId:"club-a",position:"قلب دفاع",group:"defender",ovr:84,age:29,prestige:82,isGenerated:false},
  p2:{id:"p2",name:"Defender Rival",clubId:"club-a",position:"قلب دفاع",group:"defender",ovr:78,age:25,prestige:70,isGenerated:false},
  p3:{id:"p3",name:"Midfielder",clubId:"club-a",position:"وسط",group:"midfielder",ovr:80,age:27,prestige:76,isGenerated:false},
  p4:{id:"p4",name:"Generated Defender",clubId:"club-a",position:"ظهير",group:"defender",ovr:74,age:22,prestige:55,isGenerated:true}
};
const club = {id:"club-a",name:"Test FC",country:"Egypt",power:80,roster:["p1","p2","p3","p4"]};
let state = null;
let saveResult = true;
let saves = 0, renders = 0, toasts = 0, intervalCallback = null;
let stateRevision = 1, domReadyCallback = null;
const lines = [
  {id:"p1",name:"Captain Candidate",club:"Test FC",clubName:"Test FC",country:"Egypt",ovr:84,appearances:10,goals:0,assists:1,averageRating:7.3,displayStats:{appearances:8,goals:0,assists:1,averageRating:7.3}},
  {id:"p2",name:"Defender Rival",club:"Test FC",clubName:"Test FC",country:"Egypt",ovr:78,appearances:12,goals:1,assists:0,averageRating:6.9,displayStats:{appearances:10,goals:1,assists:0,averageRating:6.9}},
  {id:"p3",name:"Midfielder",club:"Test FC",clubName:"Test FC",country:"Egypt",ovr:80,appearances:12,goals:2,assists:4,averageRating:7.2,displayStats:{appearances:10,goals:2,assists:4,averageRating:7.2}},
  {id:"p4",name:"Generated Defender",club:"Test FC",clubName:"Test FC",country:"Egypt",ovr:74,appearances:10,goals:0,assists:1,averageRating:6.8,displayStats:{appearances:9,goals:0,assists:1,averageRating:6.8}}
];
const window = {
  LWWorldAI:{
    normalize(value){return String(value||"").toLowerCase().replace(/\s+/g,"");},
    clubKey(name,country){return country.toLowerCase()+"|"+name.toLowerCase();},
    groupForPosition(position){
      if(position==="حارس مرمى") return "goalkeeper";
      if(["قلب دفاع","ظهير","وسط دفاعي"].includes(position)) return "defender";
      if(["وسط","وسط مهاجم"].includes(position)) return "midfielder";
      return "attacker";
    },
    rosterPlayers(world,club){return club.roster.map(id=>world.players[id]).filter(Boolean);},
    getSeasonLines(){return lines;}
  },
  LWWorldDB:{},
  LWCareer:{
    uniqueMatchRows(rows){
      const seen=new Set();
      return rows.filter(row=>{
        const key=String(row.id||row.matchId||[row.season,row.scope,row.club,row.opponent,row.day,row.minutes,row.goals,row.assists,row.rating].join("|"));
        if(seen.has(key)) return false;
        seen.add(key);return true;
      });
    }
  },
  LWStateStore:{
    getRevision:()=>stateRevision,
    subscribe(){return ()=>{};}
  },
  LWStoryRuntime:{
    getState:()=>state,
    overall:()=>78,
    save(){saves++;return saveResult;},
    render(){renders++;},
    toast(){toasts++;}
  },
  addEventListener(){},
  setInterval(callback){intervalCallback=callback;return 1;}
};
const nodes = {};
const host = {
  innerHTML:"",hidden:false,children:[],
  addEventListener(){},
  setAttribute(){},
  appendChild(node){this.children.push(node);},
  insertBefore(node){this.children.push(node);},
  querySelector(){return null;}
};
const grid={children:[{},{}],insertBefore(node){this.children.push(node);}};
const page={querySelector(){return grid;}};
const document={
  readyState:"loading",hidden:false,
  getElementById(id){return id==="page-contract"?page:id==="lwTeamDynamicsPanel"?host:(nodes[id]||null);},
  createElement(){return {id:"",className:"",addEventListener(){},setAttribute(){},innerHTML:"",hidden:false};},
  addEventListener(name,callback){if(name==="DOMContentLoaded")domReadyCallback=callback;},
};
const context={window,document,console,Math,Number,String,Array,Object,JSON,Promise,Set};
vm.createContext(context);
vm.runInContext(source,context,{filename:"team-dynamics.js"});
const dynamics=window.LWTeamDynamics;
assert.ok(dynamics,"team dynamics API must be exposed");

function match(id, season, rating, goals, assists, scope="league") {
  return {id,season,scope,minutes:90,rating,goals,assists,club:"Test FC",opponent:"Opponent",day:10};
}
state={
  careerStarted:true,retired:false,seasonFinished:false,season:2,day:15,
  name:"Player",age:25,pos:"قلب دفاع",clubName:"Test FC",leagueCountry:"Egypt",
  trust:70,professionalism:75,teamChemistry:60,morale:70,seasonApps:10,seasonAppsTarget:30,
  worldSimulation:{schemaVersion:1,projectionRevision:1,rosterMembershipSchemaVersion:1,
    currentSeason:2,clubs:{"club-a":club},players,seasonStats:{}},
  seasonLog:[],
  careerMatchHistory:Array.from({length:8},(_,i)=>match("initial-"+i,2,7.0,0,0))
};
let view=dynamics.snapshot(state);
assert.equal(view.ready,true);
assert.equal(view.clubName,"Test FC");
assert.equal(view.leader.id,"p1","highest leadership-index teammate should be named as the leadership candidate");
assert.equal(view.rival.id,"p2","the first direct rival must come from the player's own role group");
assert.equal(view.readyToRequest,true,"age, trust, professionalism, form and appearances should qualify for a challenge");
assert.equal(view.rivals.some(item=>item.id==="p3"),false,"a different position group must not enter the direct-rival list");
assert.equal(view.rival.stats.goals,1,"rival comparison should use the simulated season line");
assert.equal(view.rival.isGenerated,false);
assert.equal(view.stats.appearances,8);
assert.equal(view.stats.averageRating,7);

const malformedMinutesHistoryState = Object.assign({},state,{
  careerMatchHistory:[
    match("minutes-number",2,7.8,0,0),
    Object.assign(match("minutes-string",2,7.6,0,0),{minutes:"90"}),
    Object.assign(match("minutes-infinity",2,9.9,0,0),{minutes:Infinity}),
    Object.assign(match("minutes-infinity-string",2,9.8,0,0),{minutes:"Infinity"}),
    Object.assign(match("minutes-array",2,9.7,0,0),{minutes:[]}),
    Object.assign(match("minutes-array-string",2,9.6,0,0),{minutes:["90"]}),
    Object.assign(match("minutes-boolean",2,9.5,0,0),{minutes:true}),
    Object.assign(match("minutes-malformed-stats",2,9.4,0,0),{goals:["5"],assists:[2],rating:["9"]})
  ],
  seasonLog:[]
});
const malformedMinutesHistoryView=dynamics.snapshot(malformedMinutesHistoryState);
assert.equal(malformedMinutesHistoryView.stats.appearances,3,
  "only finite number or numeric-string minutes may qualify a leadership appearance");
assert.ok(Math.abs(malformedMinutesHistoryView.stats.averageRating-7.7)<1e-9,
  "array/object-style rating values must not enter the current-form average");
assert.equal(malformedMinutesHistoryView.stats.goals,0,
  "array-style goal values must not be counted as real match contributions");
assert.equal(malformedMinutesHistoryView.stats.assists,0,
  "array-style assist values must not be counted as real match contributions");

const malformedSeasonHistoryState = Object.assign({},state,{
  careerMatchHistory:[
    match("season-current-number",2,7.8,0,0),
    match("season-current-string","2",7.6,0,0),
    match("season-missing",undefined,6.8,0,0),
    Object.assign(match("season-object",2,9.9,0,0),{season:{}}),
    Object.assign(match("season-array",2,9.8,0,0),{season:[]}),
    Object.assign(match("season-invalid-string",2,9.7,0,0),{season:"not-a-season"}),
    Object.assign(match("season-boolean",2,9.6,0,0),{season:true}),
    match("season-previous",1,4.0,0,0)
  ],
  seasonLog:[]
});
const malformedSeasonHistoryView=dynamics.snapshot(malformedSeasonHistoryState);
assert.equal(malformedSeasonHistoryView.stats.appearances,3,
  "current form must include numeric/current and genuinely missing legacy seasons only");
assert.ok(Math.abs(malformedSeasonHistoryView.stats.averageRating-7.4)<1e-9,
  "malformed or prior-season rows must not inflate current-season leadership form");
assert.equal(Array.from(malformedSeasonHistoryView.stats.formRows,row=>row.id).sort().join(","),
  "season-current-number,season-current-string,season-missing",
  "malformed season objects, arrays, booleans and strings must not be relabelled as current-season matches");

const malformedChallengeSeasonState=Object.assign({},state,{
  teamLeadership:{challenge:{
    clubKey:"egypt|test fc",
    season:{valueOf:null,toString:null},
    startAppearances:8
  }}
});
const malformedChallengeSeasonView=dynamics.snapshot(malformedChallengeSeasonState);
assert.equal(malformedChallengeSeasonView.challenge,null,
  "a malformed saved captaincy season must be ignored without throwing or activating the challenge");

const legacySeasonRows = Array.from({length:8},(_,i)=>match("legacy-"+(i+1),2,5+(i*0.4),0,0));
const legacyOnlyState = Object.assign({},state,{careerMatchHistory:[],seasonLog:legacySeasonRows});
const legacyOnlyView = dynamics.snapshot(legacyOnlyState);
assert.equal(legacyOnlyView.stats.formRows.map(row=>row.id).join(","),
  "legacy-8,legacy-7,legacy-6,legacy-5",
  "legacy seasonLog history must be reversed before recent-form and captaincy checks");

assert.equal(dynamics.requestCaptaincy(state).ok,true);
assert.equal(saves,1,"starting a captaincy challenge must persist once");
view=dynamics.snapshot(state);
assert.ok(view.challenge,"the challenge must be stored in the career save");
assert.equal(view.challengeMatches,0);
assert.equal(dynamics.requestCaptaincy(state).reason,"challenge-already-active");

state.careerMatchHistory.unshift(
  match("after-1",2,7.1,0,0),
  match("after-2",2,7.3,0,0),
  match("after-3",2,7.0,0,1),
  match("after-4",2,7.2,0,0)
);
view=dynamics.snapshot(state);
assert.equal(view.challengeMatches,4);
assert.equal(view.challengeReady,true,"four good new performances and captaincy standing should complete the challenge");
const beforeClaimSaves=saves;
assert.equal(dynamics.claimCaptaincy(state).ok,true);
assert.equal(saves,beforeClaimSaves+1,"claiming the captaincy must persist once");
assert.equal(state.teamLeadership.activeCaptain.clubKey,"egypt|test fc");
assert.equal(state.teamLeadership.captainHistory.length,1);
assert.equal(state.teamLeadership.challenge,null);
assert.equal(state.teamChemistry,64);
assert.equal(state.morale,73);
assert.equal(state.diary[0].type,"شارة القيادة");
assert.equal(dynamics.claimCaptaincy(state).reason,"already-captain","the captaincy must not be granted twice");

state.teamLeadership.activeCaptain.clubKey="other-club";
view=dynamics.snapshot(state);
assert.equal(view.isCaptain,false,"a captaincy from a former club must not apply to a new club");

const lowState={
  careerStarted:true,retired:false,season:1,day:3,age:17,pos:"قلب دفاع",
  clubName:"Test FC",leagueCountry:"Egypt",trust:20,professionalism:40,
  teamChemistry:40,seasonApps:2,seasonAppsTarget:30,careerMatchHistory:[],
  worldSimulation:state.worldSimulation
};
assert.equal(dynamics.requestCaptaincy(lowState).reason,"not-eligible");

state.teamLeadership={rivalId:"p4"};
view=dynamics.snapshot(state);
assert.equal(view.rival.id,"p4","an explicitly selected teammate rival should be retained");
assert.equal(dynamics.selectRival(state).ok,true);
assert.notEqual(state.teamLeadership.rivalId,"p4");
assert.equal(saves,beforeClaimSaves+2,"rival selection must save once");

const incomplete=Object.assign({},state,{teamLeadership:{challenge:{
  clubKey:"egypt|test fc",season:2,startAppearances:20
}}});
const beforeIncomplete=JSON.stringify(incomplete.teamLeadership);
assert.equal(dynamics.claimCaptaincy(incomplete).reason,"challenge-not-complete");
assert.equal(JSON.stringify(incomplete.teamLeadership),beforeIncomplete);

const failed={
  careerStarted:true,retired:false,season:2,age:25,pos:"قلب دفاع",day:20,
  clubName:"Test FC",leagueCountry:"Egypt",trust:70,professionalism:75,
  teamChemistry:50,morale:50,seasonApps:10,seasonAppsTarget:30,
  worldSimulation:state.worldSimulation,careerMatchHistory:Array.from({length:8},(_,i)=>match("fail-"+i,2,7,0,0))
};
saveResult=false;
assert.equal(dynamics.requestCaptaincy(failed).reason,"save-failed");
assert.equal(failed.teamLeadership,undefined,"rejected saves must roll back the challenge object");
saveResult=true;

const noWorld={careerStarted:true,clubName:"Missing FC",leagueCountry:"Egypt",worldSimulation:state.worldSimulation};
assert.equal(dynamics.snapshot(noWorld).ready,false,"missing club data must not fabricate a squad or rival");

assert.equal(typeof domReadyCallback,"function","team dynamics must wait for DOM readiness before mounting its panel");
domReadyCallback();
assert.equal(typeof intervalCallback,"function","the panel must install its state refresh safety poll");
const beforeRenderedAverage=dynamics.snapshot(state).stats.averageRating.toFixed(2);
assert.ok(host.innerHTML.includes(beforeRenderedAverage),
  "the rendered leadership panel must display the current average match rating");
state.careerMatchHistory[0].rating=Number(state.careerMatchHistory[0].rating)+2;
stateRevision+=1;
intervalCallback();
const afterRenderedAverage=dynamics.snapshot(state).stats.averageRating.toFixed(2);
assert.notEqual(afterRenderedAverage,beforeRenderedAverage,
  "the in-place match rating mutation must change the underlying current-form metric");
assert.ok(host.innerHTML.includes(afterRenderedAverage),
  "a new state-store revision must refresh the panel even when match-history array length is unchanged");
console.log("PASS: real squad leadership candidate, same-role rivalry, persisted captaincy challenge, performance gates, one-time award, save rollback, and in-place match-history UI refresh.");

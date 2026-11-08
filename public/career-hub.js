(function(){
  "use strict";
  var timer=null,lastSnapshot="",lastRuntime=null;
  var lastHistoryRef=null,lastHistoryLength=-1,lastHistoryTail="",lastHistoryRevision=null,lastHistorySignature="";
  var lastSeasonLogRef=null,lastSeasonLogLength=-1,lastSeasonLogTail="",lastSeasonLogSignature="";
  var refreshScheduled=false,queuedForce=false,archiveObserver=null;
  var api=function(){return window.LWStoryRuntime||null;};
  var $=function(id){return document.getElementById(id);};
  function finiteNumber(value){
    if(typeof value!=="number"&&typeof value!=="string")return null;
    if(typeof value==="string"&&value.trim()==="")return null;
    var parsed=Number(value);
    return Number.isFinite(parsed)?parsed:null;
  }
  var clamp=function(v,min,max){var parsed=finiteNumber(v);return Math.max(min,Math.min(max,Math.round(parsed===null?0:parsed)));};
  function careerDay(s){
    var day=finiteNumber(s&&s.day);
    return day!==null&&Number.isSafeInteger(day)&&day>=1?day:null;
  }
  function dailyActionUsedOnDay(s,today){
    if(!s||!s.dailyActionUsed)return false;
    if(today===null)return true;
    var rawDay=s.dailyActionDay;
    if(rawDay==null||(typeof rawDay==="string"&&rawDay.trim()===""))return true;
    var savedDay=finiteNumber(rawDay);
    return savedDay===null||!Number.isSafeInteger(savedDay)||savedDay<1||savedDay===today;
  }
  var text=function(id,value){var e=$(id),next=String(value);if(e&&e.textContent!==next)e.textContent=next;};
  var bar=function(id,value){var e=$(id),next=clamp(value,0,100)+"%";if(e&&e.style.width!==next)e.style.width=next;};
  function statusTrust(v){
    if(v>=80)return "ثقة قوية جدًا — حافظ على مستواك";
    if(v>=60)return "موقفك جيد — الاستمرارية مهمة";
    if(v>=40)return "لسه بتثبت نفسك في الملعب";
    if(v>=25)return "ثقة محدودة — محتاج أداء ثابت";
    return "الثقة منخفضة — ركز على الأداء والانضباط";
  }
  function statusRelation(v){
    if(v>=80)return "علاقة قوية وتواصل جيد";
    if(v>=60)return "علاقة مستقرة";
    if(v>=40)return "علاقة بتتبني";
    if(v>=25)return "محتاج تواصل مهني أفضل";
    return "العلاقة متوترة";
  }
  function statusEnergy(v){
    if(v>=75)return "طاقة عالية";
    if(v>=50)return "طاقة مناسبة لمعظم الأنشطة";
    if(v>=30)return "طاقة منخفضة — راجع الحمل البدني";
    return "طاقة حرجة — الراحة أولى";
  }
  function statusFatigue(v){
    if(v<20)return "إجهاد منخفض";
    if(v<45)return "إجهاد معتدل";
    if(v<65)return "إجهاد مرتفع — تجنب الشدة المكثفة";
    return "إجهاد شديد — يفضّل الاستشفاء";
  }
  function recommendation(s,energy,fatigue,trust,relation){
    if(s.retired)return {title:"المسيرة انتهت",text:"اللاعب معتزل؛ المؤشرات هنا للمراجعة فقط."};
    if(s.winterBreakPending)return {title:"راجع انتقالات منتصف الموسم",text:"المسيرة متوقفة مؤقتًا عند نافذة الشتاء. راجع السوق أو اختار تكملة الموسم قبل تمرير يوم الراحة أو اليوم التالي."};
    var injuryDays=finiteNumber(s.injuryDays);
    if(injuryDays!==null&&injuryDays>0)return {title:"الأولوية للتعافي",text:"عندك إصابة لسه باقي لها "+injuryDays+" يوم. التدريب والمشاركة مقفولين لحد ما مدة الإصابة تخلص؛ يوم الراحة يقللها يومًا."};
    if(energy<30||fatigue>=70)return {title:"خد راحة قبل أي مجهود",text:"طاقتك أو مستوى الإجهاد مش مناسبين لحصة قوية. يوم استشفاء يمرر يومًا في التقويم ويرفع الطاقة ويقلل الإجهاد."};
    if(energy<48||fatigue>=55)return {title:"خفّف الحمل البدني",text:"الأفضل تختار راحة، أو حصة خفيفة لو لسه ما تمرنتش وما لعبتش النهارده. تجنب الشدة المكثفة."};
    if(s.playedToday)return {title:"يوم المباراة خلص",text:"التدريب مقفول في نفس يوم المباراة. راجع نتيجة الماتش وخد راحة أو تقدّم لليوم التالي."};
    if(s.trainedToday)return {title:"أنهيت تدريب اليوم",text:"حصة واحدة كفاية في اليوم. لو محتاج تعافي اختار الراحة؛ أو تقدّم ليوم جديد لاستعادة الطاقة تدريجيًا."};
    if(trust<35)return {title:"ابنِ الثقة في الملعب",text:"ثقة الجهاز الفني منخفضة. التدريب المنتظم يساعد، لكن تقييمات المباريات الجيدة هي العامل الأوضح، وجلسة المدرب لا تضمن مكانًا أساسيًا."};
    if(relation<35)return {title:"حسّن التواصل مع المدرب",text:"العلاقة خارج الملعب محتاجة شغل. اختار جلسة الالتزام بدل الشكوى، وخلي الأداء في الملعب يدعم كلامك."};
    return {title:"جاهز تختار خطوتك",text:"طاقتك وإجهادك في نطاق معقول. اختار تدريبًا يناسب مركزك أو استعد للمباراة حسب جدولك."};
  }
  function historyRowSignature(row){
    if(!row||typeof row!=="object"||Array.isArray(row))return "-";
    // Keep the cache key aligned with uniqueMatchRows(): match identity metadata
    // can change deduplication even when minutes/goals/assists stay unchanged.
    try{
      var signature=JSON.stringify(Object.keys(row).sort().map(function(key){return [key,row[key]];}));
      if(typeof signature==="string")return signature;
    }catch(error){}
    var fields=["id","matchId","scope","competition","leagueCompetition","season","segmentId","club","opponent","day","calendarDay","matchday","minutes","goals","assists"];
    return JSON.stringify(fields.map(function(key){
      var value;
      try{value=row[key];}catch(error){return [key,"[unreadable]"];}
      if(value===undefined)return [key,null];
      if(value===null||typeof value==="string"||typeof value==="boolean")return [key,value];
      if(typeof value==="number")return [key,Number.isFinite(value)?value:String(value)];
      try{
        var nested=JSON.stringify(value);
        return [key,nested===undefined?"["+typeof value+"]":nested];
      }catch(error){return [key,"["+typeof value+"]"];}
    }));
  }
  function historyTailSignature(history){
    return history.length?historyRowSignature(history[history.length-1]):"-";
  }
  function stateSignature(s,revision,force){
    var history=Array.isArray(s.careerMatchHistory)?s.careerMatchHistory:[];
    var seasonLog=Array.isArray(s.seasonLog)?s.seasonLog:[];
    var tail=historyTailSignature(history);
    var seasonTail=historyTailSignature(seasonLog);
    if(force||revision===null||history!==lastHistoryRef||history.length!==lastHistoryLength||tail!==lastHistoryTail
      ||seasonLog!==lastSeasonLogRef||seasonLog.length!==lastSeasonLogLength||seasonTail!==lastSeasonLogTail
      ||revision!==lastHistoryRevision){
      lastHistorySignature=history.map(historyRowSignature).join(",");
      lastSeasonLogSignature=seasonLog.map(historyRowSignature).join(",");
      lastHistoryRef=history;lastHistoryLength=history.length;lastHistoryTail=tail;
      lastSeasonLogRef=seasonLog;lastSeasonLogLength=seasonLog.length;lastSeasonLogTail=seasonTail;
      lastHistoryRevision=revision;
    }
    return JSON.stringify([
      s.careerStarted,s.retired,s.winterBreakPending,s.injuryDays,s.injuryName,
      s.energy,s.morale,s.fatigue,s.trust,s.coachRelationship,s.playedToday,s.trainedToday,
      s.dailyActionUsed,finiteNumber(s.dailyActionDay),s.dailyActionType,careerDay(s),s.season,
      s.apps,s.totalCareerAppearances,s.goals,s.assists,s.seasonApps,s.pos,lastHistorySignature,lastSeasonLogSignature
    ]);
  }
  
  function renderSeasonDevelopmentArchiveBreakdown(state){
    var root=$("seasonDevelopmentArchive");
    if(!root||typeof root.querySelectorAll!=="function")return;
    var current=state||(api()&&api().getState?api().getState():null);
    var history=Array.isArray(current&&current.seasonDevelopmentHistory)?current.seasonDevelopmentHistory:[];
    var rows=history.filter(function(row){
      if(!row||typeof row!=="object"||Array.isArray(row))return false;
      var season=finiteNumber(row.season);
      return season!==null&&Number.isSafeInteger(season)&&season>0;
    }).slice().sort(function(a,b){return finiteNumber(b.season)-finiteNumber(a.season);});
    var cards=Array.prototype.slice.call(root.querySelectorAll("details.season-development-item"));
    if(!cards.length||cards.length!==rows.length)return;
    cards.forEach(function(card,index){
      var row=rows[index]||{};
      var section=card.querySelector(".season-development-breakdown");
      if(!section){
        section=document.createElement("div");
        section.className="season-development-breakdown";
        var heading=document.createElement("p");
        heading.className="muted small";
        heading.textContent="تفصيل الخبرة والإصابات";
        section.appendChild(heading);
        var initialGrid=document.createElement("div");
        initialGrid.className="kpiGrid";
        initialGrid.style.margin="8px 0";
        section.appendChild(initialGrid);
        var existingMetrics=card.querySelector(".kpiGrid");
        if(existingMetrics&&existingMetrics.parentNode)existingMetrics.parentNode.insertBefore(section,existingMetrics.nextSibling);
        else card.appendChild(section);
      }
      var headingNode=section.querySelector("p");
      if(!headingNode){
        headingNode=document.createElement("p");
        headingNode.className="muted small";
        section.insertBefore(headingNode,section.firstChild);
      }
      if(headingNode.textContent!=="تفصيل الخبرة والإصابات")headingNode.textContent="تفصيل الخبرة والإصابات";
      var grid=section.querySelector(".kpiGrid");
      if(!grid){
        grid=document.createElement("div");
        grid.className="kpiGrid";
        grid.style.margin="8px 0";
        section.appendChild(grid);
      }
      var metrics=[
        {label:"XP التدريب الآلي",value:row.xp},
        {label:"XP التدريب اليدوي",value:row.manualXP},
        {label:"إصابات التدريب الآلي",value:row.injuries},
        {label:"إصابات التدريب اليدوي",value:row.manualInjuries}
      ];
      var items=Array.prototype.slice.call(grid.querySelectorAll(".kpi"));
      if(items.length!==metrics.length){
        grid.textContent="";
        items=[];
      }
      metrics.forEach(function(metric,metricIndex){
        var item=items[metricIndex];
        if(!item){
          item=document.createElement("div");
          item.className="kpi";
          grid.appendChild(item);
        }
        var number=item.querySelector(".kpiNum");
        if(!number){
          number=document.createElement("div");
          number.className="kpiNum";
          item.insertBefore(number,item.firstChild);
        }
        var caption=item.querySelector(".kpiLabel");
        if(!caption){
          caption=document.createElement("div");
          caption.className="kpiLabel";
          item.appendChild(caption);
        }
        var parsed=finiteNumber(metric.value);
        var next=parsed===null?"—":Math.round(Math.max(0,parsed)).toLocaleString("en-US");
        if(number.textContent!==next)number.textContent=next;
        if(caption.textContent!==metric.label)caption.textContent=metric.label;
      });
    });
  }
  function render(force){
    var runtime=api(),s=runtime&&runtime.getState?runtime.getState():null;
    if(!s){lastSnapshot="";lastRuntime=null;lastHistoryRef=null;lastHistoryLength=-1;lastHistoryTail="";lastHistoryRevision=null;lastHistorySignature="";lastSeasonLogRef=null;lastSeasonLogLength=-1;lastSeasonLogTail="";lastSeasonLogSignature="";return;}
    renderSeasonDevelopmentArchiveBreakdown(s);
    var store=window.LWStateStore;
    var revision=store&&typeof store.getRevision==="function"?Number(store.getRevision()):null;
    if(!Number.isFinite(revision))revision=null;
    var signature=stateSignature(s,revision,!!force);
    if(!force&&runtime===lastRuntime&&signature===lastSnapshot)return;
    lastRuntime=runtime;lastSnapshot=signature;
    var energy=clamp(s.energy,0,100),morale=clamp(s.morale,0,100),fatigue=clamp(s.fatigue,0,100);
    var trust=clamp(s.trust,0,100),relation=clamp(s.coachRelationship==null?35:s.coachRelationship,0,100),injury=Math.max(0,finiteNumber(s.injuryDays)||0);
    var readiness=Math.round(energy*.42+(100-fatigue)*.25+morale*.13+trust*.12+relation*.08);
    if(injury>0)readiness=Math.min(24,readiness);
    var advice=recommendation(s,energy,fatigue,trust,relation);
    text("wellnessReadinessScore",readiness);
    text("wellnessStatusTitle",advice.title);
    text("wellnessStatusText",advice.text);
    text("wellnessAdvice",s.winterBreakPending?"التوصية: احسم قرار نافذة الشتاء أو اختار تكملة الموسم قبل تمرير اليوم.":energy<40||fatigue>=60||injury>0?"التوصية: افتح قسم الإجراءات بالأسفل واختر يوم استشفاء.":trust<35||relation<35?"التوصية: جلسة مع المدرب أو تدريب منتظم، حسب حالة يومك.":"التوصية: اختار بين التدريب والمباراة حسب تقويم المسيرة.");
    text("wellnessEnergyValue",energy+"/100");
    text("wellnessEnergyLabel",statusEnergy(energy));bar("wellnessEnergyBar",energy);
    text("wellnessFatigueValue",fatigue+"/100");
    text("wellnessFatigueLabel",statusFatigue(fatigue));bar("wellnessFatigueBar",fatigue);
    text("wellnessMoraleValue",morale+"/100");
    text("wellnessMoraleLabel",morale>=70?"معنويات مرتفعة":morale>=45?"معنويات مستقرة":"المعنويات محتاجة دعم");bar("wellnessMoraleBar",morale);
    text("wellnessTrustValue",trust+"/100");text("wellnessTrustLabel",statusTrust(trust));bar("wellnessTrustBar",trust);
    text("wellnessCoachRelationshipValue",relation+"/100");text("wellnessCoachRelationshipLabel",statusRelation(relation));bar("wellnessCoachRelationshipBar",relation);
    text("wellnessInjuryValue",injury>0?"مصاب — "+injury+" يوم":"لا توجد إصابة");
    text("wellnessInjuryLabel",injury>0?"التدريب والمباراة غير متاحين أثناء التعافي.":"مفيش إصابة مسجلة؛ راقب الطاقة والإجهاد قبل المجهود.");
    var injuryPanel=$("wellnessInjuryPanel");if(injuryPanel)injuryPanel.classList.toggle("is-injured",injury>0);
    var bodyBadge=$("wellnessBodyBadge");if(bodyBadge){bodyBadge.textContent=injury>0?"تعافٍ مطلوب":energy<40||fatigue>60?"حمل مرتفع":"جاهزية بدنية";bodyBadge.className="pill "+(injury>0||energy<30||fatigue>=70?"red":energy<48||fatigue>=55?"gold":"green");}
    var today=careerDay(s);
    text("wellnessDayStatus","اليوم "+(today===null?1:today)+" · الموسم "+(finiteNumber(s.season)||1));
    var used=dailyActionUsedOnDay(s,today);
    var daily=$("wellnessDailyActionLabel");
    if(daily)daily.textContent=used?"استخدمت نشاطك الجانبي اليوم: "+(s.dailyActionType||"نشاط يومي"):"النشاط الجانبي متاح النهارده";
    document.querySelectorAll('#page-wellness [data-action="coach"]').forEach(function(button){button.disabled=!!s.retired||used;});
    var careerCount=function(value,maximum){
      var parsed=finiteNumber(value);
      var limit=typeof maximum==="number"&&Number.isFinite(maximum)&&maximum>=0?maximum:1000000;
      return parsed===null?0:Math.floor(Math.max(0,Math.min(limit,parsed)));
    };
    var historyRowCompleteness=function(row){
      var score=0;
      ["minutes","goals","assists","rating"].forEach(function(key){
        if(finiteNumber(row&&row[key])!==null)score+=1;
      });
      try{
        if(row&&row.stats&&typeof row.stats==="object"&&!Array.isArray(row.stats))
          score+=Math.min(4,Object.keys(row.stats).length);
      }catch(error){}
      return score;
    };
    var normalizeHistoryRows=function(rows,sourcePriority){
      return (Array.isArray(rows)?rows:[]).reduce(function(valid,row){
        if(!row||typeof row!=="object"||Array.isArray(row))return valid;
        var minutes=finiteNumber(row.minutes);
        if(minutes===null||minutes<=0||minutes>120)return valid;
        var rawScope=row.scope;
        var scope=rawScope===undefined||rawScope===null||(typeof rawScope==="string"&&rawScope.trim()==="")
          ?"league":typeof rawScope==="string"?rawScope.trim().toLowerCase():"";
        if(!scope)return valid;
        valid.push({
          row:Object.assign({},row,{
            minutes:minutes,goals:careerCount(row.goals,20),assists:careerCount(row.assists,20),scope:scope
          }),
          completeness:historyRowCompleteness(row),
          priority:sourcePriority
        });
        return valid;
      },[]);
    };
    // Prefer the most complete duplicate record; use the canonical career ledger
    // as the tie-breaker over the legacy seasonLog snapshot.
    var legacySeasonRows=normalizeHistoryRows(s.seasonLog,0);
    var historyRows=normalizeHistoryRows(s.careerMatchHistory,1);
    var combinedHistoryRows=legacySeasonRows.concat(historyRows)
      .sort(function(a,b){return b.completeness-a.completeness||b.priority-a.priority;})
      .map(function(entry){return entry.row;});
    var uniqueHistoryRows=window.LWCareer&&typeof window.LWCareer.uniqueMatchRows==="function"
      ?window.LWCareer.uniqueMatchRows(combinedHistoryRows):combinedHistoryRows;
    var careerRows=uniqueHistoryRows.filter(function(row){return row&&row.scope!=="international";});
    var careerMinutes=careerRows.reduce(function(total,row){return total+row.minutes;},0);
    var loggedGoals=careerRows.reduce(function(total,row){return total+row.goals;},0);
    var loggedAssists=careerRows.reduce(function(total,row){return total+row.assists;},0);
    var roleLabel=({"حارس مرمى":"حارس مرمى","قلب دفاع":"قلب دفاع","ظهير":"ظهير","وسط":"وسط","وسط دفاعي":"وسط دفاعي","وسط مهاجم":"وسط مهاجم","جناح":"جناح","مهاجم":"مهاجم متحرك","رأس حربة":"رأس حربة"})[String(s.pos||"")]||String(s.pos||"غير محدد");
    var roleAdvice=({"حارس مرمى":"قيّم الحارس بالتصديات والتقييمات والثبات؛ الأهداف ليست معيار مركزه.","قلب دفاع":"راقب الالتحامات والاعتراضات والتمريرات والتقييم، مش الأهداف بس.","ظهير":"السرعة واللياقة والمساهمات الهجومية مع الواجب الدفاعي أهم من عدد الأهداف وحده.","وسط":"دورك ربط الدفاع بالهجوم، وتوزيع اللعب بالتمرير والرؤية، مع المساهمة في افتكاك الكرة والحفاظ على اللياقة.","وسط دفاعي":"قيّم قطع الكرات وجودة التمرير والاستحواذ تحت الضغط بجانب التقييم.","وسط مهاجم":"الرؤية وصناعة الفرص والتمريرات الحاسمة مؤشرات أساسية بجانب التسجيل.","جناح":"تابع المراوغة والسرعة والتسديد وصناعة الفرص؛ مساهماتك التهديفية هي المقياس الهجومي الأوضح.","مهاجم":"دورك ربط الوسط بالهجوم وصناعة الفرص والتحرك بين الخطوط؛ قِس الأهداف والصناعة معًا.","رأس حربة":"دورك إنهاء الهجمة داخل المنطقة؛ تابع الأهداف والتسديدات ومعدل التسجيل لكل 90 دقيقة."})[String(s.pos||"")]||"الأداء يتقاس حسب مركز اللاعب ومساهمته في نتيجة الفريق.";
    text("statsCareerApps",Math.max(careerCount(s.apps,1000000),careerCount(s.totalCareerAppearances,1000000)));
    text("statsCareerGoals",careerCount(s.goals,10000000));text("statsCareerAssists",careerCount(s.assists,10000000));
    text("statsSeasonApps",careerCount(s.seasonApps,1000000));
    text("statsGoalsPer90",careerMinutes>0?(loggedGoals*90/careerMinutes).toFixed(2):"0.00");
    text("statsAssistsPer90",careerMinutes>0?(loggedAssists*90/careerMinutes).toFixed(2):"0.00");
    text("statsMinutesPerAppearance",careerRows.length?Math.round(careerMinutes/careerRows.length):0);
    text("statsPositionContext","مركزك الحالي: "+roleLabel+" — "+roleAdvice+" المعدلات محسوبة من سجل المباريات المحفوظة.");
    var hint=$("homeReadinessHint");
    if(hint){
      if(injury>0)hint.textContent="حالتك الحالية: إصابة لمدة "+injury+" يوم — افتح الجاهزية عشان تتابع التعافي.";
      else if(energy<35||fatigue>=65)hint.textContent="نصيحة اليوم: الطاقة أو الإجهاد بيقولوا إن الراحة أهم من حصة مكثفة.";
      else if(used)hint.textContent="نصيحة اليوم: استخدمت نشاطك الجانبي؛ باقي لك التدريب أو الراحة أو المباراة حسب التقويم.";
      else if(trust<35)hint.textContent="نصيحة اليوم: ثقة الجهاز الفني محتاجة أداء ثابت وتواصل مهني.";
      else hint.textContent="جاهزيتك مقبولة؛ راجع الإحصائيات أو اختار تدريبك من الأيقونات.";
    }
    var trainingBadge=$("trainingPageBadge");
    if(trainingBadge){
      if(s.retired)trainingBadge.textContent="المسيرة انتهت";
      else if(injury>0)trainingBadge.textContent="التدريب متوقف أثناء الإصابة";
      else if(s.playedToday)trainingBadge.textContent="يوم مباراة — لا تدريب";
      else if(s.trainedToday)trainingBadge.textContent="أنهيت حصة اليوم";
      else trainingBadge.textContent="حصة واحدة في اليوم";
    }
    var trustHeader=$("wellnessTrustValue");
    if(trustHeader)trustHeader.title="ثقة فنية مرتبطة بالدور والتقييمات؛ مختلفة عن العلاقة الشخصية بالمدرب.";
    var relationHeader=$("wellnessCoachRelationshipValue");
    if(relationHeader)relationHeader.title="تواصل خارج الملعب؛ لا يضمن وحده المشاركة الأساسية.";
  }
  function scheduleRender(force){
    if(document.hidden)return;
    queuedForce=queuedForce||!!force;
    if(refreshScheduled)return;
    refreshScheduled=true;
    Promise.resolve().then(function(){
      refreshScheduled=false;
      var shouldForce=queuedForce;queuedForce=false;
      if(document.hidden)return;
      render(shouldForce);
    });
  }
  function tick(){if(document.hidden)return;render(false);}
  function refresh(){if(document.hidden)return;render(true);}
  function start(){
    render(true);
    var archiveRoot=$("seasonDevelopmentArchive");
    if(archiveObserver){archiveObserver.disconnect();archiveObserver=null;}
    if(archiveRoot&&typeof window.MutationObserver==="function"){
      archiveObserver=new window.MutationObserver(function(){renderSeasonDevelopmentArchiveBreakdown();});
      archiveObserver.observe(archiveRoot,{childList:true});
    }
    renderSeasonDevelopmentArchiveBreakdown();
    var store=window.LWStateStore;
    if(store&&typeof store.subscribe==="function")store.subscribe(function(){scheduleRender(false);});
    timer=window.setInterval(tick,store&&typeof store.subscribe==="function"?5000:1500);
    window.addEventListener("pageshow",refresh);
    window.addEventListener("storage",refresh);
    document.addEventListener("visibilitychange",function(){if(!document.hidden)refresh();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
(function(){
  "use strict";
  var timer=null,lastSnapshot="",lastRuntime=null;
  var api=function(){return window.LWStoryRuntime||null;};
  var $=function(id){return document.getElementById(id);};
  var clamp=function(v,min,max){return Math.max(min,Math.min(max,Math.round(Number(v)||0)));};
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
    if(Number(s.injuryDays)>0)return {title:"الأولوية للتعافي",text:"عندك إصابة لسه باقي لها "+Number(s.injuryDays)+" يوم. التدريب والمشاركة مقفولين لحد ما مدة الإصابة تخلص؛ يوم الراحة يقللها يومًا."};
    if(energy<30||fatigue>=70)return {title:"خد راحة قبل أي مجهود",text:"طاقتك أو مستوى الإجهاد مش مناسبين لحصة قوية. يوم استشفاء يمرر يومًا في التقويم ويرفع الطاقة ويقلل الإجهاد."};
    if(energy<48||fatigue>=55)return {title:"خفّف الحمل البدني",text:"الأفضل تختار راحة، أو حصة خفيفة لو لسه ما تمرنتش وما لعبتش النهارده. تجنب الشدة المكثفة."};
    if(s.playedToday)return {title:"يوم المباراة خلص",text:"التدريب مقفول في نفس يوم المباراة. راجع نتيجة الماتش وخد راحة أو تقدّم لليوم التالي."};
    if(s.trainedToday)return {title:"أنهيت تدريب اليوم",text:"حصة واحدة كفاية في اليوم. لو محتاج تعافي اختار الراحة؛ أو تقدّم ليوم جديد لاستعادة الطاقة تدريجيًا."};
    if(trust<35)return {title:"ابنِ الثقة في الملعب",text:"ثقة الجهاز الفني منخفضة. التدريب المنتظم يساعد، لكن تقييمات المباريات الجيدة هي العامل الأوضح، وجلسة المدرب لا تضمن مكانًا أساسيًا."};
    if(relation<35)return {title:"حسّن التواصل مع المدرب",text:"العلاقة خارج الملعب محتاجة شغل. اختار جلسة الالتزام بدل الشكوى، وخلي الأداء في الملعب يدعم كلامك."};
    return {title:"جاهز تختار خطوتك",text:"طاقتك وإجهادك في نطاق معقول. اختار تدريبًا يناسب مركزك أو استعد للمباراة حسب جدولك."};
  }
  function stateSignature(s){
    var history=Array.isArray(s.careerMatchHistory)?s.careerMatchHistory:[];
    var historySignature=history.map(function(row){
      return row?[Number(row.minutes)||0,String(row.scope||""),Number(row.goals)||0,Number(row.assists)||0].join(":"):"-";
    }).join(",");
    return JSON.stringify([
      s.careerStarted,s.retired,s.winterBreakPending,s.injuryDays,s.injuryName,
      s.energy,s.morale,s.fatigue,s.trust,s.coachRelationship,s.playedToday,s.trainedToday,
      s.dailyActionUsed,s.dailyActionDay,s.dailyActionType,s.day,s.season,
      s.apps,s.totalCareerAppearances,s.goals,s.assists,s.seasonApps,s.pos,historySignature
    ]);
  }
  function render(force){
    var runtime=api(),s=runtime&&runtime.getState?runtime.getState():null;
    if(!s){lastSnapshot="";lastRuntime=null;return;}
    var signature=stateSignature(s);
    if(!force&&runtime===lastRuntime&&signature===lastSnapshot)return;
    lastRuntime=runtime;lastSnapshot=signature;
    var energy=clamp(s.energy,0,100),morale=clamp(s.morale,0,100),fatigue=clamp(s.fatigue,0,100);
    var trust=clamp(s.trust,0,100),relation=clamp(s.coachRelationship==null?35:s.coachRelationship,0,100),injury=Math.max(0,Number(s.injuryDays)||0);
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
    text("wellnessDayStatus","اليوم "+(Number(s.day)||1)+" · الموسم "+(Number(s.season)||1));
    var today=Number(s.day)||1;
    var used=!!s.dailyActionUsed&&Number(s.dailyActionDay)===today;
    var daily=$("wellnessDailyActionLabel");
    if(daily)daily.textContent=used?"استخدمت نشاطك الجانبي اليوم: "+(s.dailyActionType||"نشاط يومي"):"النشاط الجانبي متاح النهارده";
    document.querySelectorAll('#page-wellness [data-action="coach"]').forEach(function(button){button.disabled=!!s.retired||used;});
    var careerRows=(Array.isArray(s.careerMatchHistory)?s.careerMatchHistory:[]).filter(function(row){return row&&Number(row.minutes)>0&&row.scope!=="international";});
    var careerMinutes=careerRows.reduce(function(total,row){return total+Math.max(0,Number(row.minutes)||0);},0);
    var loggedGoals=careerRows.reduce(function(total,row){return total+Math.max(0,Number(row.goals)||0);},0);
    var loggedAssists=careerRows.reduce(function(total,row){return total+Math.max(0,Number(row.assists)||0);},0);
    var roleLabel=({"حارس مرمى":"حارس مرمى","قلب دفاع":"قلب دفاع","ظهير":"ظهير","وسط دفاعي":"وسط دفاعي","وسط مهاجم":"وسط مهاجم","جناح":"جناح","مهاجم":"مهاجم متحرك","رأس حربة":"رأس حربة"})[String(s.pos||"")]||String(s.pos||"غير محدد");
    var roleAdvice=({"حارس مرمى":"قيّم الحارس بالتصديات والتقييمات والثبات؛ الأهداف ليست معيار مركزه.","قلب دفاع":"راقب الالتحامات والاعتراضات والتمريرات والتقييم، مش الأهداف بس.","ظهير":"السرعة واللياقة والمساهمات الهجومية مع الواجب الدفاعي أهم من عدد الأهداف وحده.","وسط دفاعي":"قيّم قطع الكرات وجودة التمرير والاستحواذ تحت الضغط بجانب التقييم.","وسط مهاجم":"الرؤية وصناعة الفرص والتمريرات الحاسمة مؤشرات أساسية بجانب التسجيل.","جناح":"تابع المراوغة والسرعة والتسديد وصناعة الفرص؛ مساهماتك التهديفية هي المقياس الهجومي الأوضح.","مهاجم":"دورك ربط الوسط بالهجوم وصناعة الفرص والتحرك بين الخطوط؛ قِس الأهداف والصناعة معًا.","رأس حربة":"دورك إنهاء الهجمة داخل المنطقة؛ تابع الأهداف والتسديدات ومعدل التسجيل لكل 90 دقيقة."})[String(s.pos||"")]||"الأداء يتقاس حسب مركز اللاعب ومساهمته في نتيجة الفريق.";
    text("statsCareerApps",Math.max(Number(s.apps)||0,Number(s.totalCareerAppearances)||0));
    text("statsCareerGoals",Number(s.goals)||0);text("statsCareerAssists",Number(s.assists)||0);text("statsSeasonApps",Number(s.seasonApps)||0);
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
  function tick(){if(document.hidden)return;render(false);}
  function refresh(){render(true);}
  function start(){
    render(true);
    timer=window.setInterval(tick,1500);
    window.addEventListener("pageshow",refresh);
    window.addEventListener("storage",refresh);
    document.addEventListener("visibilitychange",function(){if(!document.hidden)refresh();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
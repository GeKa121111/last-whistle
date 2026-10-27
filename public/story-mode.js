(function(){
"use strict";
var API = function(){return window.LWStoryRuntime||null;};
var stateRef = null;
var previousSnapshot = "";
var lastRenderedStoryPanelSignature = "";
var lastPending = "";
var eventDefs = [
  {
    id:"family-pressure",chapter:"01 / THE BEGINNING",title:"مكالمة آخر الليل",tag:"أول قرار في المسيرة",
    body:"بعد أول تدريب، موبايلك رنّ. والدك مش بيضغط عليك عشان يكسّر حلمك؛ هو خايف تشيل المسؤولية لوحدك. قدامك موسم طويل، والقرار الأول هيحدد إزاي هتوازن بين حلمك وحياتك.",
    consequence:"القرار ده هيأثر على الانضباط، المعنويات، والطاقة من أول أسبوع.",
    when:function(s){return !!s.careerStarted;},
    choices:[
      {label:"أوعدهم بخطة واضحة",detail:"انضباط أعلى وثقة أكبر، من غير مكسب سريع.",effects:{professionalism:5,morale:3,coachRelationship:2},outcome:"عملت جدول للتدريب والراحة واطمنت أهلك إنك واخد الطريق بجدية."},
      {label:"أقبل شغل إضافي جنب التدريب",detail:"فلوس أكتر دلوقتي مقابل طاقة أقل.",effects:{money:180,energy:-12,professionalism:-1},outcome:"دخلت فلوس زيادة للبيت، لكن يومك بقى أصعب والتعافي بقى أبطأ."},
      {label:"أقفل الموبايل وأركز لوحدي",detail:"تحافظ على وقتك، لكن المعنويات تتأثر.",effects:{energy:5,morale:-5,teamChemistry:-2},outcome:"وفرت وقت لنفسك، لكن فضلت شايل القلق من غير ما تتكلم مع حد."}
    ]
  },
  {
    id:"debut",chapter:"02 / FIRST WHISTLE",title:"أول ظهور — مين أنت قدام الناس؟",tag:"اختبار الشخصية",
    body:"صافرة النهاية جت بعد أول مشاركة ليك. الكابتن شريف قالك إنك لسه في بداية الطريق، وفي صحفي صغير مستني كلمة منك. تقدر تكسب ثقة النادي أو تخطف عناوين الصحف؛ بس مش دايمًا الاتنين بيمشوا مع بعض.",
    consequence:"التأثير: علاقة المدرب، ثقة التشكيل، والسمعة الإعلامية.",
    when:function(s){return Number(s.apps||0)>=1;},
    choices:[
      {label:"أنسب الفضل للفريق",detail:"ثقة المدرب والاحترافية ترتفعان.",effects:{professionalism:4,coachRelationship:4,trust:3,teamChemistry:2,mediaReputation:1},outcome:"تصريحك كان هادي ومحترم. الكابتن شريف لاحظ إنك فاهم إن المسيرة مش لاعب واحد."},
      {label:"أقول إني أستحق مكان أساسي",detail:"شهرة أسرع، لكن المدرب هيحاسبك على كلامك.",effects:{followers:35,mediaReputation:7,morale:2,coachRelationship:-4,professionalism:-2},outcome:"العناوين بدأت تذكر اسمك، لكن المدرب طلب منك تثبت الكلام في الملعب."}
    ]
  },
  {
    id:"first-goal",chapter:"03 / THE FIRST GOAL",title:"أول هدف — تهديه لمين؟",tag:"لحظة بتفضل في الذاكرة",
    body:"أول كرة دخلت الشباك باسمك. الجمهور بيهتف، وزمايلك بيجروا عليك. في لحظة زي دي، تصرفك ممكن يقوّي علاقتك بالفريق أو يفتح باب جديد للضوء والشهرة.",
    consequence:"التأثير: الانسجام، السمعة، المتابعون، وعلاقة المدرب.",
    when:function(s){return Number(s.goals||0)>=1 && Number(s.apps||0)>=1;},
    choices:[
      {label:"أجري أحتفل مع زملائي",detail:"تكسب غرفة الملابس قبل ما تكسب العناوين.",effects:{teamChemistry:6,coachRelationship:2,trust:2,professionalism:2},outcome:"احتفلت مع الفريق. المهاجم المخضرم قالك: الهدف بتاعك، لكن اللي صنعه الفريق كله."},
      {label:"أطلب من وكيل يراقب فرصي",detail:"اهتمام أكبر، مع توتر بسيط داخل النادي.",effects:{followers:55,mediaReputation:5,coachRelationship:-3,professionalism:-1},outcome:"اسمك بدأ ينتشر برا النادي. الفرص ممكن تيجي، لكن لازم علاقتك بالمدرب تفضل تحت السيطرة."}
    ]
  },
  {
    id:"coach-call",chapter:"04 / THE MANAGER",title:"جلسة مغلقة مع المدرب",tag:"مكانك مش مضمون",
    body:function(s){return Number(s.trust||0)>=50?"المدرب قفل باب مكتبه وقالك إنك قريب من التشكيل الأساسي، لكنه عايز يشوف التزام مش لقطة واحدة.":"المدرب قالك بصراحة إن فرصك مش كفاية، وإن لاعب تاني ممكن ياخد مكانك في أي لحظة. عندك اختيار: تصبر وتشتغل، أو تطلب فرصة بصوت عالي."},
    consequence:"التأثير: ثقة المدرب والطاقة والاحترافية.",
    when:function(s){return Number(s.apps||0)>=2;},
    choices:[
      {label:"أطلب خطة تطوير محددة",detail:"فرصة أهدى لبناء الثقة على المدى الطويل.",effects:{trust:5,coachRelationship:5,professionalism:4,energy:-5},outcome:"اتفقتم على نقاط واضحة للتطوير. مفيش وعد بمكان أساسي، لكن بقى عندك طريق تقيس نفسك عليه."},
      {label:"أضغط عشان ألعب أساسي",detail:"المعنويات ترتفع، لكن العلاقة ممكن تتوتر.",effects:{morale:4,trust:-5,coachRelationship:-4,mediaReputation:2},outcome:"وصلت رسالتك، لكن المدرب وضح إن المشاركة هتتحدد بالأداء مش بالطلبات."},
      {label:"أقبل دور البديل وأستعد",detail:"انضباط واستشفاء أفضل، لكن انتظار أطول.",effects:{professionalism:5,teamChemistry:3,energy:8,morale:-2},outcome:"قبلت إن الفرصة ممكن تيجي من الدكة. ركزت على الإحماء والاستعداد بدل الاعتراض."}
    ]
  },
  {
    id:"agent-offer",chapter:"05 / OFF THE PITCH",title:"وكيل أعمال عند باب النادي",tag:"فرصة ولا استعجال؟",
    body:"وكيل أعمال قال إنه شايف إمكانياتك، وعرض يساعدك في الظهور الإعلامي ومتابعة العروض. مفيش انتقال مضمون، والكلام مش عقد رسمي مع أي نادي؛ دي خطوة في إدارة مسيرتك.",
    consequence:"التأثير: المتابعون والسمعة والالتزام وعلاقتك بالنادي.",
    when:function(s){return !s.agent && !s.agentProfile && Number(s.apps||0)>=4 && Number(s.playerPotential||0)>=65;},
    choices:[
      {label:"أفتح باب التمثيل وأقابل الوكلاء",detail:"أدخل سوق الوكلاء وأختار شخصية تناسب خطتي بدل ما أوقّع من غير مقارنة.",effects:{followers:70,mediaReputation:7,professionalism:2},set:{agentLead:true},outcome:"قررت تبدأ مفاوضات مع وكلاء مختلفين. لسه موقّعتش مع حد؛ افتح صفحة العقد والانتقالات واسمع قصص الوكلاء وشروطهم."},
      {label:"أأجل القرار لحد نهاية الموسم",detail:"تركيز أعلى على الملعب وعلاقة مستقرة مع المدرب.",effects:{professionalism:4,coachRelationship:3,trust:2},outcome:"طلبت تأجيل النقاش. الوكيل احترم قرارك، وبقيت مركز على إثبات نفسك."}
    ]
  },
  {
    id:"injury-choice",chapter:"06 / THE BODY",title:"الفحوصات مش مطمّنة",tag:"قرار له تمن",
    body:function(s){return "الفريق الطبي قال إن عندك "+(s.injuryName||"إصابة")+". تقدر تكون صريح مع الجهاز الفني وتلتزم بالتأهيل، أو تخبي الألم عشان ما تخسرش مكانك. مفيش مباراة تستاهل إنك تتجاهل جسمك."},
    consequence:"التأثير: الانضباط والطاقة وعلاقة المدرب، وإخفاء الإصابة يزود مدة الغياب.",
    when:function(s){return Number(s.injuryDays||0)>0;},
    choices:[
      {label:"أبلغ الجهاز الطبي وألتزم بالتأهيل",detail:"تضحية بالاستعجال مقابل إدارة احترافية.",effects:{professionalism:5,coachRelationship:4,morale:2,energy:5},outcome:"اعترفت بالإصابة واتبعت خطة الفريق الطبي. مدة الغياب هتفضل مرتبطة بنظام الإصابة، مش بقرار عاطفي."},
      {label:"أخبي الألم وأضغط على نفسي",detail:"تبدو جاهزًا قدام الناس، لكن الغياب يطول.",effects:{injuryDays:2,professionalism:-6,coachRelationship:-5,morale:3},outcome:"حاولت تخبي الألم، لكن الإصابة زادت يومين. الجهاز الفني هيحتاج وقت عشان يرجع يثق في تقديرك للمخاطر."}
    ]
  },
  {
    id:"media-storm",chapter:"07 / HEADLINES",title:"تصريحك بقى تريند",tag:"الشهرة ليها تمن",
    body:"مقطع من مقابلة ليك انتشر على السوشيال ميديا. ناس شايفة إنك واثق، وناس بتتهمك بالغرور. عندك فرصة توضّح موقفك، أو تزود الضجة وتكسب متابعين على حساب علاقتك بالفريق.",
    consequence:"التأثير: السمعة والمتابعون وعلاقة المدرب.",
    when:function(s){return Number(s.mediaReputation||0)>=28 && Number(s.apps||0)>=2;},
    choices:[
      {label:"أوضح إن قصدي كان احترام الفريق",detail:"تصلح جزء من الصورة المهنية.",effects:{professionalism:4,coachRelationship:4,teamChemistry:2,mediaReputation:-1},outcome:"طلعت بتوضيح هادي واعتذرت عن سوء الفهم. مش كل النقد اختفى، لكن كلامك بقى أوضح."},
      {label:"أستغل الضجة وأزود التصريحات",detail:"متابعون أكتر ومخاطرة أكبر في غرفة الملابس.",effects:{followers:95,mediaReputation:8,coachRelationship:-6,trust:-3,professionalism:-4},outcome:"الانتشار زاد، لكن المدرب طلب اجتماعًا قبل المباراة القادمة."}
    ]
  },
  {
    id:"national-call",chapter:"08 / THE BADGE",title:"المكالمة اللي كنت مستنيها",tag:"قميص المنتخب",
    body:"وصلك خبر إن اسمك دخل حسابات المنتخب. تمثيل البلد مسؤولية، مش مجرد صورة. محتاج توازن بين الحماس، الجاهزية، والتواصل مع مدرب ناديك.",
    consequence:"التأثير: المعنويات والثقة والاحترافية والطاقة.",
    when:function(s){return !!s.nationalCalled || Number(s.nationalCaps||0)>0;},
    choices:[
      {label:"أقبل التحدي وألتزم بالبرنامج",detail:"حماس وثقة، مع استهلاك أكبر للطاقة.",effects:{morale:6,trust:3,professionalism:3,energy:-7},outcome:"استقبلت الفرصة بجدية ونسقت مع الجهازين. لازم تتابع التعافي عشان ضغط المباريات ما يتراكمش."},
      {label:"أطلب تقييم جاهزيتي قبل السفر",detail:"قرار هادي يحافظ على الاحترافية والطاقة.",effects:{professionalism:5,coachRelationship:2,energy:4,morale:-1},outcome:"طلبت تقييمًا طبيًا وفنيًا بدل الموافقة العمياء. القرار مش انسحاب؛ ده إدارة للمسؤولية."}
    ]
  },
  {
    id:"contract-pressure",chapter:"09 / THE CONTRACT",title:"آخر موسم في العقد",tag:"قرار يحدد الخطوة الجاية",
    body:"العقد قرب يخلص، والإدارة مستنية تعرف إذا كنت هتكمل أو هتفتح باب خيارات جديدة. مش مطلوب منك تستعجل؛ لكن تجاهل الملف ممكن يخليك تدخل الصيف من غير خطة واضحة.",
    consequence:"التأثير: ثقة المدرب والسمعة والاحترافية. تفاوض العقد الحقيقي يفضل من شاشة العقود.",
    when:function(s){return Number(s.apps||0)>=3 && (Number(s.contractSeasons||0)<=1 || !!s.freeAgent);},
    choices:[
      {label:"أطلب جلسة تفاوض خاصة",detail:"إدارة مباشرة للملف من غير تصعيد إعلامي.",effects:{professionalism:4,coachRelationship:3,trust:2},outcome:"طلبت جلسة تفاوض داخل النادي. القرار لا يغيّر العقد تلقائيًا؛ تابع شاشة العقود عشان تشوف الخيارات الفعلية."},
      {label:"أعلن إن مستقبلي مفتوح",detail:"الاهتمام الإعلامي يزيد، لكن التوتر كمان.",effects:{followers:45,mediaReputation:6,coachRelationship:-3,professionalism:-1},outcome:"التصريح فتح باب التكهنات. راقب حالة العقد والعروض من لوحة الانتقالات."},
      {label:"أثبت نفسي لآخر جولة",detail:"علاقة أفضل مع الفريق على حساب الراحة.",effects:{trust:4,teamChemistry:4,energy:-5,professionalism:3},outcome:"قررت تسيب الملعب يتكلم. نهاية الموسم هتوضح إذا كان القرار ده كفاية."}
    ]
  },
  {
    id:"season-review",chapter:"10 / THE TURNING POINT",title:"الموسم خلص… والمستقبل مفتوح",tag:"نهاية فصل وبداية فصل",
    body:function(s){return Number(s.trophies||0)>0?"رفعتوا الكأس بعد موسم كبير. دلوقتي كل خطوة هتتراقب: هل هتبني على النجاح ولا هتستعجل القفزة التالية؟":"آخر مباراة في الموسم انتهت. فيه حاجات نجحت، وحاجات لازم تتغير. القرار اللي هتاخده دلوقتي هيحدد الأولوية في الفترة الجاية."},
    consequence:"التأثير: الانضباط والانسجام أو الشهرة وضغط الانتقالات.",
    when:function(s){return !!s.seasonFinished;},
    choices:[
      {label:"أثبت مع الفريق وأبني على الموسم",detail:"انسجام واستقرار وفرصة تطوير هادية.",effects:{professionalism:4,teamChemistry:5,coachRelationship:3,trust:2},outcome:"اخترت الاستقرار. هتبدأ الموسم الجديد بعلاقة أقوى مع المجموعة."},
      {label:"أطلب تحدي أكبر في الموسم الجاي",detail:"شهرة وطموح أعلى، مع ضغط على العلاقة الحالية.",effects:{followers:60,mediaReputation:5,trust:-2,coachRelationship:-2,morale:3},outcome:"قررت ترفع سقف طموحك. افتح شاشة الانتقالات وتابع الخيارات المتاحة فعلًا."}
    ]
  },
  {
    id:"legacy",chapter:"11 / LEGACY",title:"اسمك بدأ يبقى له وزن",tag:"المسيرة بتتكوّن",
    body:"بعد سلسلة مشاركات وقرارات، بقى عندك تاريخ مش مجرد رقم في التقييم. في لحظة زي دي، تقدر تركز على الأرقام الفردية أو تستثمر خبرتك في الفريق اللي بيديك الفرصة.",
    consequence:"التأثير: الانضباط والانسجام وثقة المدرب.",
    when:function(s){return Number(s.apps||0)>=8 && Number(s.trust||0)>=60;},
    choices:[
      {label:"أساعد لاعب أصغر مني",detail:"تأثير إيجابي داخل غرفة الملابس.",effects:{teamChemistry:6,professionalism:4,coachRelationship:2,energy:-3},outcome:"خصصت وقت للاعب أصغر وشاركته خبرتك. الكابتن بدأ يشوف فيك شخصية يعتمد عليها."},
      {label:"أطلب مسؤولية أكبر",detail:"ثقة أعلى وفرصة قيادة مع ضغط إضافي.",effects:{trust:4,morale:4,professionalism:2,energy:-4},outcome:"طلبت دورًا أكبر في المجموعة. المسؤولية الجديدة هتحتاج منك ثباتًا في الأداء."}
    ]
  },
  {
    id:"academy-foundation",chapter:"YOUTH ACADEMY",title:"اختبار الأكاديمية — اتعلم قبل ما تستعجل",tag:"مرحلة الناشئين",
    body:"إنت لسه بين 12 و15 سنة. مدرب الأكاديمية وضّح إن الهدف دلوقتي هو بناء الأساسيات واتخاذ القرار، مش مطاردة الشهرة أو الضغط على نفسك عشان تلعب كل دقيقة.",
    consequence:"التأثير: الانضباط وثقة الجهاز الفني والطاقة.",
    when:function(s){return Number(s.age)>=12&&Number(s.age)<=15&&(!!s.academyCareer||!!s.academyReserve||Number(s.academyStartAge)>0||/ناشئ|أكاديمية|academy|youth/i.test(String(s.role||"")));},
    choices:[
      {label:"أركز على الأساسيات وأسمع للمدرب",detail:"تطوير وانضباط أفضل على المدى الطويل.",effects:{professionalism:5,coachRelationship:4,trust:3,energy:-2},outcome:"اتفقتم على خطة مناسبة لسنك. الأولوية بقت إتقان الأساسيات وقراءة اللعب قبل الاستعجال على الفريق الأول."},
      {label:"أطلب تحديًا أصعب مع الحفاظ على الراحة",detail:"معنويات وطموح أعلى مع ضغط بسيط.",effects:{morale:4,energy:-3,professionalism:2},outcome:"المدرب وافق على تحدٍ إضافي بشرط الالتزام بالراحة والتعلم. الطريق للفريق الأول بقى هدفًا بخطوات محسوبة."}
    ]
  },
  {
    id:"role-goalkeeper",chapter:"THE LAST LINE",title:"الحارس — قيادة الخط الأخير",tag:"قرار خاص بمركزك",
    body:"مدرب الحراس طلب منك تراجع تمركز خط الدفاع وتختار طريقة التعامل مع الكرات العرضية. الحارس مش مجرد تصديات؛ تواصلك وقرارك قبل وصول الكرة ممكن يمنعوا الخطر من الأساس.",
    consequence:"التأثير: ثقة المدرب والاحترافية والانسجام الدفاعي.",
    when:function(s){return s.pos==="حارس مرمى"&&Number(s.apps||0)>=1;},
    choices:[
      {label:"أنظم الدفاع وأتواصل قبل العرضية",detail:"انسجام دفاعي وثقة الجهاز الفني.",effects:{teamChemistry:5,coachRelationship:3,professionalism:3,trust:2},outcome:"بدأت تنادي على المدافعين وتحدد المسؤوليات قبل لعب العرضية. الجهاز الفني قيّم القيادة بنفس أهمية التصدي."},
      {label:"أركز على رد الفعل والتصدي أولًا",detail:"تطوير فردي مع فرصة أقل لتنظيم الخط.",effects:{coachRelationship:1,morale:2,energy:-2},outcome:"اشتغلت على توقيت الانقضاض ورد الفعل. المدرب طلب منك توازن بين مهارة التصدي وقيادة المنطقة."}
    ]
  },
  {
    id:"role-defender",chapter:"DEFENSIVE READ",title:"قلب الدفاع — الخطوة قبل المهاجم",tag:"قرار خاص بمركزك",
    body:"المهاجم الخصم بدأ يتحرك خلف خطك. لازم تختار بين التقدم لكسر التسلل أو تغطية المساحة خلف الظهير؛ القرار السليم يوقف الهجمة، والخطأ يفتح انفرادًا.",
    consequence:"التأثير: الانضباط والانسجام وثقة المدرب.",
    when:function(s){return (s.pos==="قلب دفاع"||s.pos==="ظهير")&&Number(s.apps||0)>=2;},
    choices:[
      {label:"أغطي المساحة وأقرأ حركة المهاجم",detail:"انضباط دفاعي واستقرار أكبر.",effects:{professionalism:4,teamChemistry:4,coachRelationship:2,trust:2},outcome:"اخترت التغطية بزاوية تسمح لك باعتراض التمريرة بدل مطاردة الكرة. التحرك الجماعي قلل المساحة خلف الخط."},
      {label:"أتقدم لكسر التسلل وأرفع الخط",detail:"جرأة أعلى لكن تحتاج تنسيقًا ممتازًا.",effects:{trust:3,morale:2,teamChemistry:-1,energy:-2},outcome:"رفعت الخط وطلبت من زملائك يتحركوا معاك في نفس اللحظة. المدرب شدد على التوقيت والتواصل."}
    ]
  },
  {
    id:"role-midfielder",chapter:"MIDFIELD CONTROL",title:"لاعب الوسط — ابدأ الهجمة من القرار",tag:"قرار خاص بمركزك",
    body:"الفريق افتك الكرة في مساحة مزدحمة. قدامك تمريرة آمنة تحفظ الاستحواذ، أو تمريرة تقدمية تكسر خطين وتفتح هجمة خطيرة. قيمة لاعب الوسط في اختيار القرار، مش عدد اللمسات.",
    consequence:"التأثير: ثقة المدرب والرؤية والانسجام.",
    when:function(s){return (s.pos==="وسط دفاعي"||s.pos==="وسط مهاجم")&&Number(s.apps||0)>=2;},
    choices:[
      {label:"أختار التمريرة التقدمية بعد مسح الملعب",detail:"رؤية واحترافية أعلى مع مخاطرة محسوبة.",effects:{professionalism:4,trust:3,coachRelationship:2,teamChemistry:2},outcome:"بصيت قبل استلام الكرة ومررت بين الخطوط في التوقيت المناسب. الجهاز الفني لاحظ جودة القرار."},
      {label:"أحافظ على الكرة وأعيد تنظيم الفريق",detail:"استحواذ وانضباط أفضل.",effects:{teamChemistry:4,professionalism:3,morale:1},outcome:"أعدت تدوير اللعب لحد ما ظهرت المساحة المناسبة. التمريرة الآمنة ساعدت الفريق يستعيد شكله."}
    ]
  },
  {
    id:"role-attacker",chapter:"FINAL THIRD",title:"المهاجم — أنهِ الهجمة أو اصنعها",tag:"قرار خاص بمركزك",
    body:"وصلت للثلث الأخير والمدافع بيقفل زاوية التسديد. تقدر تنهي الهجمة بنفسك أو تلعب تمريرة لزميل في وضع أفضل. الاختيار مرتبط بمساحة التسديد وجودة الفرصة، مش بمجرد الرغبة في تسجيل هدف.",
    consequence:"التأثير: المعنويات والاحترافية والانسجام.",
    when:function(s){return ["جناح","مهاجم","رأس حربة"].indexOf(s.pos)>=0&&Number(s.apps||0)>=2;},
    choices:[
      {label:"أختار أفضل فرصة للفريق حتى لو مش هسجل",detail:"احترافية وانسجام وثقة أعلى.",effects:{professionalism:4,teamChemistry:4,coachRelationship:2,trust:2},outcome:"اخترت القرار الأنسب للموقف بدل ما تطارد الإحصائيات الشخصية. الفرصة الأفضل أهم من عدد التسديدات."},
      {label:"أهاجم المساحة وأنهي الفرصة بنفسي",detail:"ثقة وطموح أعلى مع ضغط إضافي.",effects:{morale:4,coachRelationship:1,energy:-2,professionalism:1},outcome:"تحركت ناحية المساحة وطلبت الكرة في العمق. الجرأة مهمة للمهاجم، بشرط تقييم الزاوية والتوقيت."}
    ]
  },
  {
    id:"individual-performance-loss",chapter:"AFTER THE WHISTLE",title:"أداء فردي قوي رغم الخسارة",tag:"النتيجة مش كل الحكاية",
    body:"الفريق خسر، لكن تقييمك الفردي كان 7.5/10 أو أعلى وأداؤك داخل الملعب كان إيجابيًا. المدرب والإعلام فصلوا بين نتيجة المجموعة ومستواك الشخصي.",
    consequence:"التأثير: المعنويات وثقة المدرب والاحترافية.",
    when:function(s){var r=s.lastMatchReport||{};return r.outcome==="loss"&&Number(r.minutes)>0&&Number(r.rating)>=7.5;},
    choices:[
      {label:"أراجع أسباب استقبال الفريق للأهداف مع المدرب",detail:"تتعلم من الخسارة من غير جلد الذات.",effects:{professionalism:4,coachRelationship:3,trust:2,teamChemistry:2},outcome:"راجعت أسباب الخسارة مع الجهاز الفني، مع الاعتراف إن مستواك الفردي كان قويًا."},
      {label:"أحافظ على مستواي وأدعم زملائي",detail:"انسجام ومعنويات أفضل بعد نتيجة صعبة.",effects:{teamChemistry:5,morale:3,professionalism:2,coachRelationship:1},outcome:"المدرب والإعلام أشادوا بأدائك رغم الخسارة. دعمت زملاءك وركزت على المباراة القادمة."}
    ]
  },
]; 
function escapeHTML(value){
  return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});
}
function storyFlags(s){if(!s.storyFlags||typeof s.storyFlags!=="object")s.storyFlags={};return s.storyFlags;}
function history(s){if(!Array.isArray(s.storyHistory))s.storyHistory=[];return s.storyHistory;}
function actualEvent(def,s){
  var event={id:def.id,chapter:def.chapter,title:def.title,tag:def.tag,body:typeof def.body==="function"?def.body(s):def.body,consequence:def.consequence,choices:def.choices};
  return event;
}
function eligibleEvents(s){
  var flags=storyFlags(s);
  var list=[];
  eventDefs.forEach(function(def){
    if(def.id==="injury-choice")return;
    if(flags[def.id])return;
    try{if(def.when(s))list.push(actualEvent(def,s));}catch(err){}
  });
  if(Number(s.injuryDays||0)>0){
    var injuryId="injury-"+String(s.injuryName||"unknown").slice(0,40);
    if(!flags[injuryId]){
      var injuryDef=eventDefs.filter(function(d){return d.id==="injury-choice";})[0];
      if(injuryDef){
        var custom=actualEvent(injuryDef,s);custom.id=injuryId;
        list.unshift(custom);
      }
    }
  }
  return list;
}
function normaliseStat(s,key,delta){
  var bounded=["energy","morale","trust","fatigue","professionalism","mediaReputation","teamChemistry","coachRelationship","playerPotential","fitness","confidence"];
  var total=Number(s[key]||0)+Number(delta||0);
  if(bounded.indexOf(key)>=0)s[key]=Math.max(0,Math.min(100,Math.round(total)));
  else if(key==="money"||key==="followers"||key==="injuryDays"||key==="careerXP"||key==="goals"||key==="assists"||key==="apps")s[key]=Math.max(0,Math.round(total));
  else if(key==="contractSeasons")s[key]=Math.max(0,Math.min(5,Math.round(total)));
  else s[key]=total;
}
function getNextFixture(s){
  var schedule=Array.isArray(s.fixtureSchedule)?s.fixtureSchedule:[];
  var idx=Math.max(0,Number(s.leagueRoundIndex)||0);
  var row=schedule[idx];
  var club=String(s.clubName||"");
  if(!Array.isArray(row))return "راجع جدول الموسم";
  var fixture=row.find(function(pair){return Array.isArray(pair)&&pair.indexOf(club)>=0;});
  if(!fixture)return "جولة راحة أو جدول غير متاح";
  return fixture.filter(function(name){return name!==club;})[0]||"منافس غير معروف";
}
function ensureShell(){
  document.body.classList.add("lw-rebuild");
  var app=document.querySelector(".app.hasSidebar");
  if(!app)return;
  var header=app.querySelector(".header");
  if(!header)return;
  if(!document.getElementById("lw-command-center")){
    var shell=document.createElement("section");
    shell.id="lw-command-center";
    shell.setAttribute("aria-labelledby","lw-career-title");
    shell.innerHTML=
      '<div class="lw-console-top"><div class="lw-eyebrow"><span class="eyebrowLive"></span> LAST WHISTLE <span class="lw-eyebrow-divider">/</span> CAREER TERMINAL</div><span class="lw-season-chip">المسيرة <b id="lw-console-season">01</b></span></div>'+
      '<div class="lw-overview-head"><div class="lw-overview-copy"><h1 id="lw-career-title">الطريق <span>للقمة.</span></h1><p id="lw-overview-sub">كل قرار بيصنع فرق. حضّر للمباراة، طوّر مستواك، وابدأ كتابة تاريخك.</p></div><div class="lw-rating"><strong id="lw-overall">—</strong><small>OVERALL</small></div></div>'+
      '<div class="lw-overview-strip">'+
      '<div class="lw-overview-stat"><small>PLAYER / اللاعب</small><strong id="lw-hub-name">لاعب جديد</strong></div>'+
      '<div class="lw-overview-stat"><small>CLUB / النادي</small><strong id="lw-hub-club">—</strong></div>'+
      '<div class="lw-overview-stat"><small>SEASON / المشاركات</small><strong id="lw-hub-progress">0 / 0</strong></div>'+
      '<div class="lw-overview-stat"><small>ENERGY / الطاقة</small><strong class="lw-lime" id="lw-hub-energy">—</strong></div><div class="lw-overview-stat"><small>BALANCE / الرصيد</small><strong id="lw-hub-money">—</strong></div>'+
      '</div>'+
      '<div class="lw-progress-block"><div class="lw-progress-head"><span id="lw-hub-progress-label">مؤشر الموسم</span><b id="lw-hub-progress-value">0%</b></div><div class="lw-progress-line"><i id="lw-hub-progress-bar" style="width:0%"></i></div></div>'+
      '<div class="lw-action-heading"><span>اختار خطوتك الجاية</span><small>QUICK ACTIONS</small></div>'+
      '<div class="lw-overview-actions">'+
      '<button type="button" class="btn primary" id="lw-cta-match"><i>▶</i> استعد للمباراة</button>'+
      '<button type="button" class="btn season" id="lw-cta-season"><i>◷</i> العب الموسم لحد الشتاء</button>'+
      '<button type="button" class="btn" id="lw-cta-training"><i>↗</i> مركز التدريب</button>'+
      '<button type="button" class="btn ghost" id="lw-cta-transfers"><i>⇄</i> سوق الانتقالات</button>'+
      '</div>'+
      '<div class="lw-next-match"><div><small>NEXT FIXTURE <span>•</span> المباراة القادمة</small><strong id="lw-next-opponent">منافسك القادم</strong></div><span class="lw-match-day"><b id="lw-console-round">1</b><small id="lw-next-match-meta">جولة الموسم</small></span></div>';
    header.insertAdjacentElement("afterend",shell);
    var story=document.createElement("section");
    story.id="lw-story-panel";
    story.setAttribute("aria-live","polite");
    story.setAttribute("aria-label","أحداث المسيرة والقرارات المصيرية");
    story.innerHTML='<div class="lw-story-layout"><div><div class="lw-story-top"><span>STORYLINE</span><span class="lw-story-badge" id="lw-story-tag">قرارك يصنع الفارق</span><span class="lw-chapter-count" id="lw-chapter-count">0 فصل محسوم</span></div><h2 class="lw-story-title" id="lw-story-title">الموسم لسه بيكتب أول سطر</h2><p class="lw-story-body" id="lw-story-body">لما تظهر لحظة مصيرية، هتلاقي القرار هنا. كل اختيار له تبعات فعلية بتتسجل في مسيرتك.</p><div class="lw-story-consequence" id="lw-story-consequence">قراراتك هتأثر على المعنويات، ثقة المدرب، السمعة والعلاقات.</div></div><div class="lw-choice-wrap" id="lw-story-choices"><div class="lw-empty-story">ابدأ مسيرتك. أول فصل قصصي هيظهر هنا، وقراراتك هتفضل محفوظة على جهازك.</div></div></div><div style="padding:0 22px 18px"><div class="lw-history" id="lw-story-history"></div></div>';
    var home=document.getElementById("page-home");
    if(home)home.insertAdjacentElement("afterbegin",story);
  }
  var oldHero=app.querySelector(".hero");
  if(oldHero)oldHero.setAttribute("aria-hidden","true");
  if(!document.getElementById("lw-story-events-style")){
    var style=document.createElement("style");
    style.id="lw-story-events-style";
    style.textContent="#lw-story-panel .lw-choice:focus-visible{outline:2px solid #d9ff62;outline-offset:3px}#lw-story-panel .lw-history:empty{display:none}body.lw-rebuild .page:not(.active) #lw-story-panel{display:none}";
    document.head.appendChild(style);
  }
  bindNewControls();
}
function bindNewControls(){
  var mappings=[["lw-cta-match","heroMatch"],["lw-cta-training","heroTrain"],["lw-cta-season","seasonStageAction"],["lw-cta-transfers","seasonTransferAction"]];
  mappings.forEach(function(pair){
    var button=document.getElementById(pair[0]);
    if(!button||button.dataset.lwBound)return;
    button.addEventListener("click",function(){
      var api=API();if(!api)return;
      if(pair[1]){var existing=document.getElementById(pair[1]);if(existing)existing.click();}
      else if(pair[0]==="lw-cta-diary")api.showPage("diary");
    });
    button.dataset.lwBound="1";
  });
  var panel=document.getElementById("lw-story-panel");
  if(panel&&!panel.dataset.lwBound){
    panel.addEventListener("click",function(e){
      var button=e.target.closest("[data-story-choice]");
      if(!button)return;
      var api=API();if(!api)return;
      chooseStory(button.getAttribute("data-story-id"),Number(button.getAttribute("data-story-choice")));
    });
    panel.dataset.lwBound="1";
  }
}
function checkTriggers(s,api){
  if(!s||!s.careerStarted)return;
  storyFlags(s);history(s);
  if(s.storyPendingId){
    var stillValid=eligibleEvents(s).some(function(e){return e.id===s.storyPendingId;});
    if(!stillValid){s.storyPendingId="";}
  }
  if(!s.storyPendingId){
    var candidates=eligibleEvents(s);
    if(candidates.length){
      s.storyPendingId=candidates[0].id;
      if(lastPending!==s.storyPendingId&&api&&api.toast)api.toast("فيه قرار مصيري جديد مستنيك في شاشة المسيرة.");
      lastPending=s.storyPendingId;
      if(api&&api.save)api.save();
    }
  }
}
function renderStoryPanel(s,api){
  var panel=document.getElementById("lw-story-panel");
  if(!panel||!s)return;
  var defs=eligibleEvents(s);
  var flags=storyFlags(s),done=Object.keys(flags).length;
  var pending=null;
  if(s.storyPendingId)pending=defs.find(function(e){return e.id===s.storyPendingId;})||null;
  if(!pending&&!s.storyPendingId){
    var candidates=eligibleEvents(s);
    pending=candidates.length?candidates[0]:null;
  }
  // This panel is polled for state changes, but its interactive buttons must not be
  // destroyed/recreated every 900ms when the story has not changed (which also stole focus).
  var panelHistory=history(s).slice(0,3);
  var storyPanelSignature=[
    String(s.storyPendingId||""),pending?String(pending.id||""):"",done,s.seasonFinished?1:0,
    pending?[pending.tag||"",pending.title||"",pending.body||"",pending.consequence||"",
      (pending.choices||[]).map(function(choice){return [choice.label||"",choice.detail||"",choice.outcome||""].join("\u001e");}).join("\u001f")].join("\u001e"):"",
    panelHistory.map(function(item){return [item.id||"",item.title||"",item.outcome||item.choice||"",item.season||1,item.day||1].join("\u001e");}).join("\u001f")
  ].join("\u001d");
  if(storyPanelSignature===lastRenderedStoryPanelSignature&&panel.dataset.storyPanelSignature===storyPanelSignature)return;
  lastRenderedStoryPanelSignature=storyPanelSignature;
  panel.dataset.storyPanelSignature=storyPanelSignature;
  var tag=document.getElementById("lw-story-tag");
  var title=document.getElementById("lw-story-title");
  var body=document.getElementById("lw-story-body");
  var consequence=document.getElementById("lw-story-consequence");
  var count=document.getElementById("lw-chapter-count");
  var choices=document.getElementById("lw-story-choices");
  if(count)count.textContent=done+" فصل محسوم";
  if(pending){
    if(tag)tag.textContent=pending.tag||"قرار مصيري";
    if(title)title.textContent=pending.title;
    if(body)body.textContent=pending.body;
    if(consequence)consequence.textContent=pending.consequence||"كل اختيار له نتيجة داخل المسيرة.";
    if(choices)choices.innerHTML='<div class="lw-choice-label">اختار طريقك — مفيش اختيار بلا تبعات</div>'+pending.choices.map(function(c,i){
      var detail=c.detail||"قرار هيتسجل في سجل المسيرة";
      return '<button type="button" class="lw-choice" data-story-id="'+escapeHTML(pending.id)+'" data-story-choice="'+i+'"><span><span class="lw-choice-text">'+escapeHTML(c.label)+'</span><span class="lw-choice-detail">'+escapeHTML(detail)+'</span></span><span class="lw-choice-arrow">←</span></button>';
    }).join("");
  }else{
    if(tag)tag.textContent="مفيش قرار معلّق";
    if(title)title.textContent=s.seasonFinished?"الفصل خلص… لكن الحكاية مكملة":"الخطوة الجاية لسه قدامك";
    if(body)body.textContent=s.seasonFinished?"راجع تقرير الموسم من صفحات المسيرة، وجهّز نفسك للمرحلة الجاية. أول ما يتحقق شرط فصل جديد، هيظهر هنا.":"كمّل تدريبك ومبارياتك. الأحداث المهمة هتظهر هنا وقت ما تحصل، ومش هتكون مجرد رسائل عابرة.";
    if(consequence)consequence.textContent="المسيرة بتحتفظ بقراراتك السابقة وتعرض آثارها في الحالة الحالية.";
    if(choices)choices.innerHTML='<div class="lw-empty-story">مفيش قرار قصصي مستنيك حاليًا. ارجع بعد المباراة أو بعد تطور مهم في الموسم.</div>';
  }
  var hist=document.getElementById("lw-story-history");
  if(hist){
    var entries=panelHistory;
    hist.innerHTML=entries.map(function(item){
      return '<div class="lw-history-item"><span class="lw-history-dot"></span><div><strong>'+escapeHTML(item.title||"قرار مسيرة")+'</strong><p>'+escapeHTML(item.outcome||item.choice||"تم حفظ القرار")+' <span style="color:#72846f">• الموسم '+escapeHTML(item.season||1)+' / اليوم '+escapeHTML(item.day||1)+'</span></p></div></div>';
    }).join("");
  }
}
function chooseStory(id,index){
  var api=API();if(!api)return;
  var s=api.getState();if(!s||s.storyPendingId!==id)return;
  var event=eligibleEvents(s).find(function(e){return e.id===id;});
  if(!event)return;
  var choice=event.choices[index];if(!choice)return;
  Object.keys(choice.effects||{}).forEach(function(key){normaliseStat(s,key,choice.effects[key]);});
  Object.keys(choice.set||{}).forEach(function(key){s[key]=choice.set[key];});
  s.storyFlags[id]=true;
  s.storyPendingId="";
  var entry={id:id,title:event.title,choice:choice.label,outcome:choice.outcome,season:Number(s.season)||1,day:Number(s.day)||1};
  s.storyHistory.unshift(entry);s.storyHistory=s.storyHistory.slice(0,40);
  s.storyTitle=event.title;
  s.storyText=choice.outcome+" القرار اتحفظ في سجل مسيرتك، وتأثيره اتطبق على حالتك الحالية.";
  if(Array.isArray(s.diary)){
    s.diary.unshift({season:Number(s.season)||1,day:Number(s.day)||1,type:"قرار قصصي",text:event.title+" — "+choice.label+". "+choice.outcome});
    s.diary=s.diary.slice(0,40);
  }
  if(api.log)api.log("قرار مصيري — "+event.title+": "+choice.label+". "+choice.outcome);
  if(api.save)api.save();
  if(api.render)api.render();
  if(api.toast)api.toast("اتسجل قرارك واتطبقت نتائجه على المسيرة.");
  syncMatchContext(s);
  checkTriggers(s,api);
  renderOverview(s);
  renderStoryPanel(s,api);
}
function renderOverview(s){
  var api=API();if(!s)return;
  var overview=document.getElementById("lw-command-center");var appRoot=document.querySelector(".app.hasSidebar");var activePage=appRoot&&appRoot.getAttribute("data-active-page");if(!activePage)activePage=s.currentPage||"home";if(overview)overview.style.display=activePage==="home"?"":"none";
  var set=function(id,value){var el=document.getElementById(id);if(el)el.textContent=value==null?"—":String(value);};
  var val=api&&typeof api.overall==="function"?api.overall():(typeof s.overall==="number"?s.overall:null);
  if(val==null){
    var keys=["shooting","dribbling","passing","speed","fitness","composure","defending","goalkeeping","vision"];
    var sum=keys.reduce(function(acc,k){return acc+(Number(s[k])||0);},0);
    val=Math.round(sum/keys.length);
  }
  set("lw-overall",val);
  set("lw-console-season",String(Math.max(1,Number(s.season)||1)).padStart(2,"0"));
  set("lw-hub-name",(s.name||"لاعب جديد")+" • "+(s.pos||"مركز اللاعب"));
  set("lw-hub-club",s.clubName||"اختار نادي البداية");
  var current=Number(s.seasonApps)||0;
  var total=Number(s.seasonAppsTarget)||38;
  if(total<=0)total=38;
  var pct=Math.max(0,Math.min(100,Math.round(current/total*100)));
  set("lw-hub-progress",current+" / "+total);
  set("lw-hub-energy",Math.max(0,Math.min(100,Number(s.energy)||0))+"%");
  set("lw-hub-progress-label","الموسم "+(s.season||1)+" • المباريات");
  set("lw-hub-progress-value",pct+"%");
  var bar=document.getElementById("lw-hub-progress-bar");if(bar)bar.style.width=pct+"%";
  set("lw-next-opponent",getNextFixture(s));
  var calendarDay=Math.max(1,Number(s.calendarDay)||Number(s.day)||1);
  var lastMatchDay=Math.max(0,Number(s.lastLeagueMatchCalendarDay)||0);
  var waitDays=window.LWCareer&&typeof window.LWCareer.leagueMatchDaysRemaining==="function"
    ? window.LWCareer.leagueMatchDaysRemaining(lastMatchDay,calendarDay,5) : 0;
  set("lw-console-round",waitDays===0?"النهارده":waitDays===1?"بعد يوم":"بعد "+waitDays+" أيام");
  set("lw-next-match-meta","الجولة "+((Number(s.leagueRoundIndex)||0)+1)+" من "+total);
  var currency=api&&typeof api.currency==="function"?api.currency():"";
  set("lw-hub-money",Number(s.money||0).toLocaleString("en-US")+(currency?" "+currency:""));
  var desc=" "+(s.age||17)+" سنة • "+(s.leagueCountry||"مصر")+" • "+(s.role||"بديل");
  set("lw-overview-sub","مسيرة "+(s.name||"لاعب جديد")+" — "+(s.clubName||"ناديك")+" / "+desc+". كل قرار بيغير طريقك.");
  var cta=document.getElementById("lw-cta-match");if(cta)cta.disabled=!!s.retired;
  var train=document.getElementById("lw-cta-training");if(train)train.disabled=!!s.retired;
  var seasonSource=document.getElementById("seasonStageAction"),seasonCta=document.getElementById("lw-cta-season");
  if(seasonSource&&seasonCta){seasonCta.textContent=seasonSource.textContent;seasonCta.disabled=seasonSource.disabled;}
  var transferSource=document.getElementById("seasonTransferAction"),transferCta=document.getElementById("lw-cta-transfers");
  if(transferSource&&transferCta){transferCta.textContent=transferSource.textContent;transferCta.disabled=transferSource.disabled;transferCta.hidden=!!transferSource.hidden;transferCta.style.display=transferSource.hidden?"none":"";}
}

function finiteNumber(v){var n=Number(v);return Number.isFinite(n)?n:0;}
function matchNarrativeSummary(report){
  report=report||{};var score=report.score||{};
  var gf=finiteNumber(score.for!=null?score.for:report.goalsFor);
  var ga=finiteNumber(score.against!=null?score.against:report.goalsAgainst);
  var p=report.player||report.playerStats||{};
  var minutes=finiteNumber(p.minutes),rating=finiteNumber(p.rating!=null?p.rating:p.averageRating);
  var goals=finiteNumber(p.goals),assists=finiteNumber(p.assists);
  var tackles=finiteNumber(p.tackles),interceptions=finiteNumber(p.interceptions),saves=finiteNumber(p.saves),cleanSheet=p.cleanSheet===true;
  var outcome=gf>ga?"win":gf<ga?"loss":"draw";
  var performance=rating>=7.5?"excellent":rating>0&&rating<6.2?"poor":"steady";
  return {outcome:outcome,score:{for:gf,against:ga},minutes:minutes,rating:rating,goals:goals,assists:assists,tackles:tackles,interceptions:interceptions,saves:saves,cleanSheet:cleanSheet,performance:performance,
    key:[Number(report.season)||0,Number(report.week||report.day)||0,gf,ga,minutes,rating,goals,assists,tackles,interceptions,saves,cleanSheet?1:0].join(":")};
}
function acceptMatchReport(report){
  var api=API(),s=api&&api.getState?api.getState():null;if(!s||!report)return {ok:false,reason:"career-state-unavailable"};
  var summary=matchNarrativeSummary(report);
  if(s.lastStoryMatchKey===summary.key)return {ok:true,duplicate:true,summary:summary};
  s.lastStoryMatchKey=summary.key;s.lastMatchReport=summary;
  if(!Array.isArray(s.matchNarrativeLedger))s.matchNarrativeLedger=[];
  s.matchNarrativeLedger.unshift({key:summary.key,season:Number(s.season)||1,day:Number(s.day)||1,summary:summary});
  s.matchNarrativeLedger=s.matchNarrativeLedger.slice(0,40);
  var strongIndividualLoss=summary.outcome==="loss"&&summary.minutes>0&&summary.rating>=7.5;
  var title=strongIndividualLoss?"أداء فردي قوي رغم الخسارة":summary.outcome==="win"?"انتصار جديد":summary.outcome==="loss"?"مراجعة بعد الخسارة":"نقطة من المباراة";
  var body=summary.outcome==="win"?"فريقك فاز "+summary.score.for+"-"+summary.score.against+". ":summary.outcome==="loss"?"الفريق خسر "+summary.score.for+"-"+summary.score.against+". ":"المباراة انتهت "+summary.score.for+"-"+summary.score.against+". ";
  body+=summary.minutes>0?"شاركت "+summary.minutes+" دقيقة":"لم تشارك في المباراة";
  if(summary.goals)body+=" وسجلت "+summary.goals+" هدف";
  if(summary.assists)body+=" وصنعت "+summary.assists+" هدف";
  if(summary.rating>0)body+="، وتقييمك "+summary.rating.toFixed(1);
  if(summary.cleanSheet)body+=" وحافظت على شباك نظيفة.";
  if(summary.tackles)body+=" ونجحت في "+summary.tackles+" افتكاك.";
  if(summary.interceptions)body+=" وقطعت "+summary.interceptions+" تمريرة للمنافس.";
  if(summary.saves)body+=" وتصديت لـ"+summary.saves+" تسديدة.";
  if(strongIndividualLoss)body+=" رغم الخسارة، أداؤك الفردي كان قويًا.";
  else if(summary.outcome==="win"&&summary.rating>0&&summary.rating<6.2)body+=" النتيجة إيجابية، لكن أداءك الفردي محتاج يتحسن.";
  if(!Array.isArray(s.inbox))s.inbox=[];
  s.inbox.unshift({id:"match-report-"+summary.key,title:title,body:body,category:"match",day:Number(s.day)||1,season:Number(s.season)||1,read:false});
  s.inbox=s.inbox.slice(0,80);
  if(api.save)api.save();return {ok:true,summary:summary};
}
function syncMatchContext(s){
  if(!s)return;
  var report=s.lastMatchReportRaw||s.matchResult||s.lastMatch;
  if(report&&report!==s.lastMatchReportRaw&&report!==s.lastMatchReport&&report.score)acceptMatchReport(report);
}
function tick(){
  var api=API();if(!api)return;
  var s=api.getState();if(!s)return;
  if(!stateRef){stateRef=s;}
  ensureShell();
  checkTriggers(s,api);
  renderOverview(s);
  renderStoryPanel(s,api);
  var snapshot=[s.careerStarted,s.apps,s.goals,s.assists,s.nationalCalled,s.nationalCaps,s.injuryDays,s.injuryName,s.contractSeasons,s.freeAgent,s.seasonFinished,s.trophies,s.trust,s.mediaReputation,s.professionalism,s.seasonApps,s.day].join("|");
  if(snapshot!==previousSnapshot){previousSnapshot=snapshot;}
  if(lastPending!==s.storyPendingId)lastPending=s.storyPendingId||"";
}
function start(){
  ensureShell();tick();
  document.addEventListener("click",function(e){
    var target=e.target.closest("[data-action],#heroMatch,#heroTrain,#heroStory,#createCareerBtn,#continueSavedBtn");
    if(target){window.setTimeout(tick,250);window.setTimeout(tick,850);}
  },true);
  window.setInterval(tick,900);
  window.addEventListener("pageshow",tick);
  window.addEventListener("storage",tick);
}
window.LWStoryContext={acceptMatchReport:acceptMatchReport,matchNarrativeSummary:matchNarrativeSummary};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
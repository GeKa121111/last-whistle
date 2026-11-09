(function () {
  "use strict";
  var API = function(){return window.LWStoryRuntime||null;};
  var panel=null, overlay=null, selectedAgentId="", quotedFeeRate=null, lastSnapshot="", panelWasRendered=false;
  var tickScheduled=false,tickForceQueued=false;

  var AGENTS = [
    {
      id:"hossam",name:"حسام الجندي",title:"وكيل ابن النادي",mark:"LOCAL",style:"هادئ وصبور",
      voice:"بيتكلم على مهله، وبيسألك عن دورك قبل ما يسألك عن المرتب.",
      origin:"كان مهاجمًا في أكاديمية صغيرة. إصابة مبكرة أنهت حلمه كلاعب، وبعدها اشتغل مع ناشئين وشاف مواهب تضيع بسبب انتقالات مستعجلة. قرر يبقى الوكيل اللي كان نفسه يقابله وهو صغير.",
      pitch:"أنا مش هدورلك على أكبر اسم في أسرع وقت. هدورلك على المكان اللي هتلعب فيه وتكبر.",
      strength:"الاستقرار، ثقة المدرب، وفرص البداية المحلية.",weakness:"شبكته الدولية أهدى ومش بيجري ورا كل عرض كبير.",
      feeRate:.05,exitFeeWeeks:.22,contractMultiplier:1.045,negotiationBonus:0,negotiationRaiseBonus:.01,offerChanceBonus:-.035,transferWageMultiplier:.99,sponsorshipBonus:.04,matchPayBonus:.02,counterDifficulty:.38,strategy:"local",
      chapters:[
        {title:"عرض من خارج البلد",body:"حسام جالك بعد التدريب ومعاه رسالة من نادٍ خارج بلدك. العرض ممكن يفتح باب جديد، لكن حسام شايف إنك محتاج دقائق لعب ثابتة. قالك: «الانتقال الصح مش اللي يلمع؛ اللي يديك فرصة تثبت نفسك».",options:[
          {label:"أثبت نفسي هنا موسم كمان",detail:"استقرار وثقة أعلى، لكن الطريق الدولي هيستنى.",relationship:7,strategy:"local",effects:{trust:4,coachRelationship:4,professionalism:3,morale:1},outcome:"اتفقت مع حسام إن التطور المنتظم أهم من القفزة السريعة. هيقدّم العروض المحلية المناسبة الأول."},
          {label:"خلينا نفتح باب الخارج",detail:"توسيع الشبكة مقابل مخاطرة أكبر.",relationship:-1,strategy:"stepping",effects:{mediaReputation:3,followers:35,professionalism:1},outcome:"طلبت من حسام يوسّع البحث خارج بلدك. وافق، لكنه هيدور على محطة انتقال منطقية بدل قفزة عشوائية."}
        ]},
        {title:"النادي القديم طالبك ترجع",body:"مدربك الأول اتصل بحسام وقال إن النادي محتاج لاعب يعرف روح المكان. في نفس الأسبوع ظهر اهتمام من نادٍ أقوى. حسام مش هياخد القرار مكانك؛ هو عايز يعرف إيه اللي يهمك فعلًا.",options:[
          {label:"الأولوية لدقائق اللعب",detail:"دور واضح حتى لو اسم النادي أصغر.",relationship:5,strategy:"local",effects:{teamChemistry:5,coachRelationship:3,professionalism:2},outcome:"حسام أعاد ترتيب الأولويات على أساس فرصة المشاركة والاستقرار، مش اسم النادي فقط."},
          {label:"أختبر نفسي في مستوى أعلى",detail:"طموح أكبر مع منافسة أقوى.",relationship:1,strategy:"ambitious",effects:{morale:4,mediaReputation:2,energy:-3},outcome:"حسام وافق يدور على تحدٍ أعلى، واتفق معاك إنك لازم تقبل المنافسة على مكانك."}
        ]}
      ]
    },
    {
      id:"nadine",name:"نادين فريد",title:"صانعة الصورة",mark:"MEDIA",style:"ذكية وسريعة البديهة",
      voice:"بتسمع التصريح للآخر، وبعدها تسألك: عايز الناس تفتكرك بإيه؟",
      origin:"بدأت في الصحافة الرياضية وكانت بتغطي اللاعبين الصاعدين. بعد ما شافت إشاعة واحدة تضيّع موسم لاعب، انتقلت لإدارة السمعة والعلاقات الإعلامية. بالنسبة لها صورتك العامة ممكن تحميك أو تضغط عليك.",
      pitch:"موهبتك بتخلّيك لاعب. إدارتك للشهرة بتحدد إذا كنت هتفضل اسم عابر ولا تبني علامة تخصك.",
      strength:"الصورة الإعلامية والمتابعون والرعاة وإدارة الأزمات.",weakness:"أتعابها أعلى، وأحيانًا بتطلب حضورًا إعلاميًا وقت ما تحتاج تركز في الملعب.",
      feeRate:.085,exitFeeWeeks:.38,contractMultiplier:1.055,negotiationBonus:1,negotiationRaiseBonus:.015,offerChanceBonus:.055,transferWageMultiplier:1.025,sponsorshipBonus:.31,matchPayBonus:.04,counterDifficulty:.48,strategy:"brand",
      chapters:[
        {title:"مقطع خرج من سياقه",body:"جزء من مقابلة قديمة اتنشر من غير السؤال اللي قبله. نادين شايفة إنك قدام اختيارين: توضيح قصير يحافظ على هدوء غرفة الملابس، أو رد قوي يجيب تفاعل لكنه ممكن يكبّر الموضوع.",options:[
          {label:"أوضح بهدوء وأتكلم عن الفريق",detail:"إصلاح الصورة المهنية قبل ما الأزمة تكبر.",relationship:5,strategy:"brand",effects:{professionalism:4,coachRelationship:3,teamChemistry:3,mediaReputation:2},outcome:"نادين صاغت معاك رسالة واضحة من غير هجوم على حد. التفاعل أهدى وموقفك بقى مفهومًا أكتر."},
          {label:"أرد بقوة وأستفيد من الضجة",detail:"شهرة أسرع مع احتمال توتر العلاقة بالنادي.",relationship:2,strategy:"brand",effects:{followers:120,mediaReputation:8,coachRelationship:-4,teamChemistry:-2,morale:2},outcome:"الرد انتشر بسرعة، ونادين رفعت وصول حساباتك. بالمقابل النادي طلب منك تقلل التصريحات قبل المباراة."}
        ]},
        {title:"أول عرض رعاية كبير",body:"شركة افتراضية عرضت عليك حملة مدفوعة، لكن التصوير هيكون في أسبوع مليان مباريات. نادين شايفة إنها فرصة لبناء اسمك؛ وإنت قلقان من تأثيرها على تركيزك.",options:[
          {label:"أقبل الحملة بجدول محدود",detail:"عائد وظهور إضافي مع الحفاظ على التدريب.",relationship:6,strategy:"brand",effects:{money:120,followers:90,mediaReputation:4,energy:-3,professionalism:2},outcome:"نادين رتبت ظهورًا مختصرًا ووضحت مواعيدك للنادي. كسبت عائدًا افتراضيًا من غير ما تلغي التزاماتك."},
          {label:"أرفض وأركز على الملعب",detail:"شهرة أقل دلوقتي وتركيز أفضل.",relationship:2,strategy:"ambitious",effects:{energy:5,professionalism:4,coachRelationship:2,morale:1},outcome:"نادين احترمت قرارك، وبدأت تختار فرصًا إعلامية أقل وقتًا وأكثر ارتباطًا بأدائك."}
        ]}
      ]
    },
    {
      id:"seif",name:"سيف مراد",title:"صيّاد الفرص",mark:"SCOUT",style:"طموح وعملي",
      voice:"دايمًا معاه خريطة أندية وبيسألك عن الخطوة اللي بعدها، مش بس العرض اللي قدامك.",
      origin:"اشتغل مع شبكة كشّافين في درجات أدنى، واتعلم إن اللاعب الممتاز مش دايمًا بياخد فرصة في المكان الصحيح. خسر موهبة بسبب انتقال أكبر من استعدادها، ومن وقتها بيدوّر على طريق يجمع بين الطموح والتدرّج.",
      pitch:"لو النادي الكبير مش مناسب دلوقتي، هنختار محطة تخلّيه يراقبك وإنت بتلعب أساسي.",
      strength:"فرص انتقال أوسع وأندية خارج بلدك ومحطات انتقال تدريجية.",weakness:"عمولته مرتفعة وممكن يضغط عليك تقبل منافسة أقوى من جاهزيتك.",
      feeRate:.09,exitFeeWeeks:.42,contractMultiplier:1.07,negotiationBonus:3,negotiationRaiseBonus:.055,offerChanceBonus:.16,transferWageMultiplier:1.055,sponsorshipBonus:.08,matchPayBonus:.035,counterDifficulty:.54,strategy:"stepping",
      chapters:[
        {title:"الكشاف اللي تابعك من بعيد",body:"سيف قالك إن كشافًا تابع آخر مبارياتك، وإن ناديًا أعلى مستوى مهتم لكنه مش ضامن لك مكان أساسي. في نفس الوقت فيه نادٍ متوسط يقدر يديك دقائق لعب أكتر ويخليك تحت المراقبة.",options:[
          {label:"أختار محطة انتقال وسيطة",detail:"فرصة لعب أوضح وطريق متدرج للنادي الأكبر.",relationship:7,strategy:"stepping",effects:{trust:4,professionalism:3,morale:2},outcome:"سيف بدأ يعطي أولوية للأندية اللي ممكن تديك دقائق لعب وتخلي مستواك واضحًا للكشافين."},
          {label:"خلينا نستهدف النادي الكبير",detail:"هدف أعلى، لكن فرص اللعب الأولية أقل.",relationship:2,strategy:"ambitious",effects:{mediaReputation:4,morale:4,energy:-2},outcome:"سيف سجل النادي الكبير كاتجاه طموح. هيرتب العروض الأقرب للمستوى الأعلى، لكنه حذرك من المنافسة على التشكيل."}
        ]},
        {title:"العرض اللي لازم يتقاس",body:"ظهر اهتمام من نادٍ أقوى من ناديك الحالي. سيف جهز تقييمًا للخطوة: فرصة المشاركة، قوة الفريق، والراتب المتوقع. هو عايز يعرف هل هتختار التطور الهادئ ولا أكبر تحدٍ متاح.",options:[
          {label:"الأولوية للمشاركة والتطور",detail:"توازن بين قوة النادي وفرصة اللعب.",relationship:5,strategy:"stepping",effects:{professionalism:4,coachRelationship:2,teamChemistry:2},outcome:"سيف ركز توصياته على الأندية اللي تطور مستواك من غير ما تحبسك على الدكة."},
          {label:"الأولوية لأكبر تحدٍ",detail:"تستهدف مستوى أعلى مع مخاطرة أكبر.",relationship:3,strategy:"ambitious",effects:{morale:4,mediaReputation:3,professionalism:1},outcome:"سيف حول خطتك إلى مسار طموح. العروض هتميل لأندية أقوى، لكن قرار التعاقد النهائي يفضل بإيدك."}
        ]}
      ]
    },
    {
      id:"karim",name:"كريم منصور",title:"المفاوض الصلب",mark:"DEALS",style:"دقيق ومباشر",
      voice:"ما بيحبش الوعود الشفهية؛ كل رقم عنده له سبب وبديل.",
      origin:"اشتغل في مراجعة العقود والوساطة الرياضية قبل ما يبقى وكيلًا مستقلًا. اتعلم إن اللاعب ممكن يخسر سنين بسبب بند ما قراهوش، فبقى يراجع التفاصيل مرتين حتى لو ده بيبطّأ الصفقة.",
      pitch:"مش هقولك إن كل نادي هيوافق على طلبك. هقولك إيه اللي يستاهل تطلبه، وإمتى تسيب الطاولة.",
      strength:"التجديدات والمرتب ووضوح الشروط والتفاوض في الوقت المناسب.",weakness:"مش بيحب التسرع، وممكن يأخر الاتفاق لو شروطك بعيدة عن الواقع.",
      feeRate:.075,exitFeeWeeks:.34,contractMultiplier:1.13,negotiationBonus:8,negotiationRaiseBonus:.12,offerChanceBonus:.025,transferWageMultiplier:1.10,sponsorshipBonus:.04,matchPayBonus:.02,counterDifficulty:.66,strategy:"salary",
      chapters:[
        {title:"الإدارة فتحت ملف التجديد",body:"كريم استلم مسودة تجديد العقد، ولقى إن النادي مستعد يرفع المرتب لكن من غير ما يوضح دورك في الفريق. هو شايف إن المرتب مهم، بس العقد الطويل من غير فرصة لعب ممكن يوقف مسيرتك.",options:[
          {label:"أطلب تحسين الراتب والشروط",detail:"مكسب مالي أكبر مع احتمال مفاوضات أصعب.",relationship:5,strategy:"salary",effects:{professionalism:3,morale:3},negotiationRaiseBonusDelta:.035,outcome:"كريم جهز طلبًا ماليًا أقوى وربطه بأدائك. المفاوضات هتحتاج إثبات قيمتك في الملعب."},
          {label:"الأولوية لدور واضح في الفريق",detail:"مكسب مالي أقل مقابل وضوح المسار.",relationship:7,strategy:"role",effects:{trust:4,coachRelationship:3,teamChemistry:2},negotiationRaiseBonusDelta:-.015,outcome:"كريم قبل يقلل التركيز على أكبر رقم، وبدأ يتعامل مع دورك وفرصك كجزء أساسي من قيمة العقد."}
        ]},
        {title:"البند اللي محدش خد باله منه",body:"كريم لاحظ إن عرضًا جديدًا فيه مكسب مالي قصير المدى لكن مدة التعاقد أطول من اللي كنت متوقعه. قالك: «إمّا نعرف إحنا ملتزمين بإيه، يا إما ما نمضيش دلوقتي».",options:[
          {label:"أطلب نسخة واضحة وأفاوض على المدة",detail:"حماية أفضل للخطوة التالية.",relationship:6,strategy:"salary",effects:{professionalism:4,coachRelationship:1},contractMultiplierDelta:.025,outcome:"كريم طلب شروطًا واضحة قبل الالتزام. ما ضمنش قبول النادي، لكنه منعك من اتخاذ قرار على معلومات ناقصة."},
          {label:"أقبل العرض عشان ما أخسرش الفرصة",detail:"سرعة أكبر مع مرونة أقل بعد التوقيع.",relationship:-2,strategy:"rapid",effects:{morale:3,followers:35,professionalism:-2},contractMultiplierDelta:-.02,outcome:"قبلت المخاطرة عشان ما تضيعش الفرصة. كريم نفذ اختيارك، لكنه نصحك تراجع الشروط بدقة في المرات الجاية."}
        ]}
      ]
    },
    {
      id:"rami",name:"رامي رأفت",title:"الوكيل السريع",mark:"FAST",style:"سريع ومندفع",
      voice:"بيرن عليك في أوقات غريبة ومعاه أخبار كتير؛ لازم تسأله عن التفاصيل قبل ما توافق.",
      origin:"بدأ كمساعد في مكتب انتقالات صغير، وكان مسؤولًا عن متابعة عشرات المكالمات في نفس اليوم. بيعرف يوصل للطرف المناسب بسرعة، لكنه اتعلم متأخرًا إن إنهاء الصفقة مش دايمًا معناه إنها الصفقة الصح.",
      pitch:"الفرصة ما بتستناش. أنا هفتح الأبواب بسرعة، وإنت قرر إذا كانت الخطوة تستاهل.",
      strength:"زيادة فرص وصول عروض وسرعة تحريك سوق الانتقالات.",weakness:"عمولته أعلى وأحيانًا بيضغط لقبول عرض قبل وضوح كل البدائل.",
      feeRate:.10,exitFeeWeeks:.48,contractMultiplier:1.025,negotiationBonus:0,negotiationRaiseBonus:-.045,offerChanceBonus:.19,transferWageMultiplier:.955,sponsorshipBonus:.07,matchPayBonus:.025,counterDifficulty:.62,strategy:"rapid",
      chapters:[
        {title:"العرض اللي مدته يوم واحد",body:"رامي بعتلك عرضًا افتراضيًا وقال إن النادي عايز ردًا سريعًا. مفيش ضمان إنه عرضك الوحيد، لكنه مقتنع إن التأخير ممكن يضيّع فرصة. لازم توازن بين السرعة ومعلوماتك عن الدور والراتب.",options:[
          {label:"أطلب تفاصيل الدور قبل الرد",detail:"تقلل المخاطرة حتى لو التفاوض أبطأ.",relationship:5,strategy:"stepping",effects:{professionalism:3,trust:2},outcome:"رامي وافق يراجع الدور والمدة قبل الموافقة. السرعة هتفضل أسلوبه، بس مش على حساب كل التفاصيل."},
          {label:"خلينا نتحرك بسرعة",detail:"فرص أسرع مع مخاطرة قرار متسرع.",relationship:3,strategy:"rapid",effects:{morale:4,followers:45,energy:-2},outcome:"رامي فتح الاتصالات بسرعة. هيزيد احتمال سماعك بعروض، لكن لازم تراجع الشروط بنفسك قبل أي انتقال فعلي."}
        ]},
        {title:"كثرة العروض بدأت تلخبطك",body:"رامي بقى بيبعتلك أخبار كتير، لكن بعضها مش مناسب لدورك. لأول مرة قرر يسألك إذا كنت عايز تقلل الخيارات وتختار بدقة، ولا تفضل فاتح كل الأبواب.",options:[
          {label:"فلتر العروض على فرصة اللعب",detail:"خيارات أقل لكن أكثر ملاءمة.",relationship:6,strategy:"stepping",effects:{professionalism:4,coachRelationship:2,morale:1},outcome:"رامي بدأ يفلتر القائمة على فرصة اللعب وواقعية الراتب بدل إرسال كل اهتمام يوصل له."},
          {label:"سيب كل الخيارات مفتوحة",detail:"فرص أكثر لكن ضغط قرار أكبر.",relationship:1,strategy:"rapid",effects:{mediaReputation:3,morale:3,energy:-3},outcome:"رامي فضّل يفتح كل الأبواب. هتسمع بعروض أكثر، لكن مسؤولية المقارنة والاختيار هتكون أكبر عليك."}
        ]}
      ]
    },
    {
      id:"salim",name:"سليم فوزي",title:"مستشار المسيرة",mark:"LONG GAME",style:"متزن وصريح",
      voice:"يسألك عن نومك وتعافيك زي ما بيسألك عن مستواك.",
      origin:"كان قائدًا في فريق درجات أدنى، ورجع بدري من إصابة وخسر ثقة نفسه. بعد الاعتزال درس إدارة المسيرة واشتغل مع لاعبين عايزين يحافظوا على مستواهم سنين، مش شهور.",
      pitch:"مش هأوعدك بالقفزة الأسرع. هدفي تبقى قادر تكمل وتختار من موقف قوي.",
      strength:"خطة طويلة المدى والعلاقة مع المدرب والتعافي.",weakness:"أقل اندفاعًا في الانتقالات ومش دايمًا هيجيب أعلى زيادة مالية.",
      feeRate:.055,exitFeeWeeks:.24,contractMultiplier:1.06,negotiationBonus:3,negotiationRaiseBonus:.02,offerChanceBonus:-.005,transferWageMultiplier:1.015,sponsorshipBonus:.06,matchPayBonus:.025,counterDifficulty:.32,strategy:"long-term",
      chapters:[
        {title:"الجسم بيبعت إشارة",body:"سليم لاحظ إنك بتكمّل التدريب وإنت مرهق، وقالك إن تجاهل الإشارات الصغيرة ممكن يخليك تخسر وقتًا أكبر. القرار مش بين الشجاعة والضعف؛ بين إدارة حملك والاستعجال.",options:[
          {label:"ألتزم بالتعافي وخطة التدريب",detail:"تعافٍ أفضل وثقة أعلى على المدى الطويل.",relationship:7,strategy:"long-term",effects:{professionalism:5,coachRelationship:3,energy:5,fatigue:-4},setPerk:"recovery",outcome:"سليم سجل خطة تعافٍ منتظمة. هتستفيد من تعافٍ إضافي بسيط مع مرور أيام اللعبة."},
          {label:"أضغط على نفسي عشان أثبت جاهزيتي",detail:"اندفاع أعلى مع تعب إضافي.",relationship:-3,strategy:"ambitious",effects:{morale:3,energy:-5,fatigue:4,professionalism:-2},outcome:"سليم احترم رغبتك في إثبات نفسك، لكنه وضح إن ضغط التدريب مش بديل عن الجاهزية."}
        ]},
        {title:"لاعب أصغر محتاج نصيحة",body:"لاعب ناشئ اتصل بسليم لأنه خايف يفقد مكانه، وسليم سألك إذا كنت مستعد تخصص له وقتًا. هو شايف إن مشاركة خبرتك ممكن تقوّي مكانك في غرفة الملابس.",options:[
          {label:"أساعده وأشاركه تجربتي",detail:"قيادة وانسجام أعلى داخل الفريق.",relationship:6,strategy:"long-term",effects:{teamChemistry:6,professionalism:4,coachRelationship:2,energy:-2},outcome:"سليم شجعك على مشاركة خبرتك. بدأت تبني صورة لاعب يعتمد عليه زملاؤه، مش مجرد لاعب بيجمع أرقام."},
          {label:"أركز على هدفي الشخصي حاليًا",detail:"وقت وطاقة أكثر لنفسك.",relationship:2,strategy:"salary",effects:{energy:4,morale:2,professionalism:1},outcome:"سليم احترم تركيزك على مستقبلك، واتفق معاك إنك ترجع للمبادرة لما ضغط الموسم يقل."}
        ]}
      ]
    }
  ];

  var LEGACY_AGENT = {
    id:"legacy",name:"مروان الشامي",title:"الوكيل القديم",mark:"LEGACY",style:"متوازن",
    voice:"بيحاول يحافظ على الاتفاق القديم من غير تغييرات مفاجئة.",
    origin:"ده ملف توافق للمسيرات القديمة اللي كان فيها تمثيل وكيل قبل إضافة نظام اختيار الوكلاء.",
    pitch:"هنكمل الاتفاق الحالي، وتقدر تغيّره لما تقرر بنفسك.",
    strength:"استمرار التعاقد القديم بلا فقدان الحفظ.",weakness:"مميزاته متوازنة ومش متخصصة زي الوكلاء الجدد.",
    feeRate:.06,exitFeeWeeks:.2,contractMultiplier:1.08,negotiationBonus:1,negotiationRaiseBonus:.02,offerChanceBonus:.015,transferWageMultiplier:1.02,sponsorshipBonus:.10,matchPayBonus:.08,counterDifficulty:.4,strategy:"balanced",
    chapters:[
      {title:"إعادة ترتيب الاتفاق",body:"اتفاقك القديم مع مروان دخل مرحلة جديدة. هو عايز يعرف إذا كنت هتفضل الخطة المتوازنة ولا تركز على المال أو الانتقالات.",options:[
        {label:"نركز على الاستقرار",detail:"ثقة واستمرارية.",relationship:5,strategy:"local",effects:{professionalism:2,coachRelationship:2},outcome:"اتفقتم تركزوا على الاستقرار لحد ما تتضح الخطوة الجاية."},
        {label:"نفتح خيارات جديدة",detail:"فرص أوسع مع قدر من المخاطرة.",relationship:2,strategy:"stepping",effects:{followers:25,mediaReputation:2},outcome:"مروان بدأ يراجع احتمالات انتقال جديدة داخل مسيرتك."}
      ]},
      {title:"إعادة تقييم المسيرة",body:"مروان طلب منك مراجعة ما نجح وما لم ينجح في الاتفاق السابق.",options:[
        {label:"نحافظ على التوازن",detail:"استقرار طويل المدى.",relationship:4,strategy:"balanced",effects:{professionalism:2,morale:2},outcome:"اخترت تكمل بخطة متوازنة."},
        {label:"نغيّر الأولويات",detail:"تحديد مسار جديد.",relationship:1,strategy:"ambitious",effects:{morale:3,mediaReputation:2},outcome:"اتفقتم على مسار أكثر طموحًا."}
      ]}
    ]
  };

  var ALL_AGENTS=AGENTS.concat([LEGACY_AGENT]),BY_ID={};
  ALL_AGENTS.forEach(function(a){BY_ID[a.id]=a;});

  // Saved JSON is user-controlled data: never coerce an object with String().
  // A plain JSON object may own a non-callable "toString" field and throw during coercion.
  function safeAgentText(value,fallback){
    if(typeof value==="string")return value;
    if(typeof value==="number"&&Number.isFinite(value))return String(value);
    if(typeof value==="boolean")return value?"true":"false";
    return typeof fallback==="string"?fallback:"";
  }
  function safeAgentId(value,fallback){
    var id=safeAgentText(value,"").trim();
    return id||(typeof fallback==="string"?fallback:"");
  }
  function safeAgentField(record,key){
    try{return record&&(typeof record==="object"||typeof record==="function")?record[key]:undefined;}
    catch(_){return undefined;}
  }
  function isPlainAgentRecord(value){
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    try{
      var prototype=Object.getPrototypeOf(value);
      if(prototype===null)return true;
      return Object.getPrototypeOf(prototype)===null
        &&Object.prototype.hasOwnProperty.call(prototype,"constructor")
        &&typeof prototype.constructor==="function"
        &&prototype.constructor.name==="Object";
    }catch(_){return false;}
  }
  function isSafeAgentPerkKey(key){
    return typeof key==="string"&&/^[a-z][a-z0-9_-]{0,39}$/i.test(key)
      &&key!=="constructor"&&key!=="prototype"&&key!=="__proto__";
  }
  function normalizeAgentPerks(value){
    if(!value||typeof value!=="object")return {};
    var keys=[];
    try{keys=Object.getOwnPropertyNames(value);}catch(_){return {};}
    var validRecord=isPlainAgentRecord(value),allValid=validRecord;
    keys.forEach(function(key){
      if(!isSafeAgentPerkKey(key)){allValid=false;return;}
      var descriptor=null;
      try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch(_){}
      if(!descriptor||!descriptor.enumerable||!Object.prototype.hasOwnProperty.call(descriptor,"value")
        ||typeof descriptor.value!=="boolean")allValid=false;
    });
    if(allValid)return value;
    var normalized={};
    keys.forEach(function(key){
      if(!isSafeAgentPerkKey(key))return;
      var descriptor=null;
      try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch(_){}
      if(descriptor&&Object.prototype.hasOwnProperty.call(descriptor,"value")&&typeof descriptor.value==="boolean")
        Object.defineProperty(normalized,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});
    });
    return normalized;
  }
  function normalizeAgentProfile(value){
    if(!value||typeof value!=="object")return null;
    if(isPlainAgentRecord(value)){
      var currentPerks=safeAgentField(value,"perks");
      var normalizedPerks=normalizeAgentPerks(currentPerks);
      if(currentPerks===normalizedPerks)return value;
      try{
        value.perks=normalizedPerks;
        if(safeAgentField(value,"perks")===normalizedPerks)return value;
      }catch(_){}
    }
    var normalized={};
    var fields=["id","name","title","mark","feeRate","customFeeRate","relationship","contractMode","expiresSeason",
      "signedApps","lastChapterApps","lastChapterSeason","lastPerformanceMilestone","hiredSeason","signedDay",
      "storyStage","strategyOverride","feeDebt","legacyMigrated","contractMultiplierDelta","negotiationRaiseBonusDelta"];
    fields.forEach(function(key){
      var field=safeAgentField(value,key);
      if(field===undefined)return;
      if(field===null||typeof field==="string"||typeof field==="boolean"
        ||(typeof field==="number"&&Number.isFinite(field))){
        Object.defineProperty(normalized,key,{value:field,enumerable:true,writable:true,configurable:true});
      }
    });
    normalized.perks=normalizeAgentPerks(safeAgentField(value,"perks"));
    return Object.keys(normalized).length?normalized:null;
  }
  function isNormalizedAgentHistoryEntry(value,normalized){
    if(!isPlainAgentRecord(value))return false;
    var keys=[];
    try{keys=Object.getOwnPropertyNames(value);}catch(_){return false;}
    var expected=["season","day","title","text"];
    if(keys.length!==expected.length||!expected.every(function(key){return keys.indexOf(key)>=0;}))return false;
    return expected.every(function(key){
      var descriptor=null;
      try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch(_){}
      return !!descriptor&&descriptor.enumerable&&Object.prototype.hasOwnProperty.call(descriptor,"value")
        &&descriptor.value===normalized[key];
    });
  }
  function normalizeAgentHistoryEntry(value){
    if(!value||typeof value!=="object")return null;
    var title=safeAgentText(safeAgentField(value,"title"),"");
    var text=safeAgentText(safeAgentField(value,"text"),"");
    if(!text)text=safeAgentText(safeAgentField(value,"description"),"");
    if(!title&&!text)return null;
    var normalized={
      season:safeWholeAmount(safeAgentField(value,"season"))||1,
      day:safeWholeAmount(safeAgentField(value,"day"))||1,
      title:title||"حدث مع الوكيل",
      text:text
    };
    return isNormalizedAgentHistoryEntry(value,normalized)?value:normalized;
  }
  function normalizeAgentHistory(value){
    var isArray=false;
    try{isArray=Array.isArray(value);}catch(_){}
    if(!isArray)return [];
    var names=[],lengthDescriptor=null;
    try{
      names=Object.getOwnPropertyNames(value);
      lengthDescriptor=Object.getOwnPropertyDescriptor(value,"length");
    }catch(_){return [];}
    if(!lengthDescriptor||!Object.prototype.hasOwnProperty.call(lengthDescriptor,"value")
      ||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0)return [];
    var length=lengthDescriptor.value,indices=[],changed=false;
    names.forEach(function(key){
      if(key==="length")return;
      var index=Number(key);
      if(!Number.isSafeInteger(index)||index<0||index>=4294967295||index>=length||String(index)!==key){
        changed=true;return;
      }
      indices.push(index);
    });
    indices.sort(function(a,b){return a-b;});
    if(indices.length!==length)changed=true;
    var normalized=[];
    indices.forEach(function(index){
      var descriptor=null;
      try{descriptor=Object.getOwnPropertyDescriptor(value,String(index));}catch(_){}
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,"value")){
        changed=true;return;
      }
      if(!descriptor.enumerable)changed=true;
      var entry=normalizeAgentHistoryEntry(descriptor.value);
      if(!entry){changed=true;return;}
      if(entry!==descriptor.value)changed=true;
      normalized.push(entry);
    });
    return changed?normalized:value;
  }
  function normalizeAgentFeeQuote(value,s){
    if(!value||typeof value!=="object")return null;
    var quoteId=safeAgentId(safeAgentField(value,"agentId"),"");
    var agent=agentById(quoteId),rate=finiteAgentNumber(safeAgentField(value,"feeRate"));
    if(!agent||rate===null||rate<.035||rate>Number(agent.feeRate))return null;
    var normalized={
      agentId:quoteId,
      feeRate:Math.round(rate*1000)/1000,
      season:safeAgentNumber(safeAgentField(value,"season"),safeAgentNumber(s&&s.season,1))||1,
      calendarDay:safeAgentNumber(safeAgentField(value,"calendarDay"),safeAgentNumber(s&&s.calendarDay,safeAgentNumber(s&&s.day,1)))||1
    };
    if(isPlainAgentRecord(value)){
      var keys=[];
      try{keys=Object.getOwnPropertyNames(value);}catch(_){}
      var expected=["agentId","feeRate","season","calendarDay"];
      var matches=keys.length===expected.length&&expected.every(function(key){return keys.indexOf(key)>=0;});
      if(matches)matches=expected.every(function(key){
        var descriptor=null;
        try{descriptor=Object.getOwnPropertyDescriptor(value,key);}catch(_){}
        return !!descriptor&&descriptor.enumerable&&Object.prototype.hasOwnProperty.call(descriptor,"value")
          &&descriptor.value===normalized[key];
      });
      if(matches)return value;
    }
    return normalized;
  }
  function agentById(value){
    var id=safeAgentId(value,"");
    return id&&Object.prototype.hasOwnProperty.call(BY_ID,id)?BY_ID[id]:null;
  }
  function esc(v){return safeAgentText(v,"").replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
  function cap(v,min,max){return Math.max(min,Math.min(max,Math.round(safeAgentNumber(v,0))));}
  function agentConfig(s){var p=safeAgentField(s,"agentProfile");return p?agentById(safeAgentField(p,"id")):null;}
  function randomUnit(s){
    var x=(safeAgentNumber(s&&s.randomSeed,0)>>>0)||0x6d2b79f5;x=(x+0x6d2b79f5)>>>0;s.randomSeed=x;
    var t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  function boundedStat(s,key,delta){
    var bounded=["energy","morale","trust","fatigue","professionalism","mediaReputation","teamChemistry","coachRelationship","playerPotential","fitness","confidence"];
    var next=safeAgentNumber(s[key],0)+safeAgentNumber(delta,0);
    if(bounded.indexOf(key)>=0)s[key]=cap(next,0,100);
    else if(key==="money"||key==="followers"||key==="injuryDays")s[key]=Math.max(0,Math.round(next));
    else s[key]=next;
  }
  function ensureProfileShape(p,s){
    p.relationship=cap(p.relationship==null?52:p.relationship,0,100);
    var profileFeeRate=finiteAgentNumber(p.feeRate);
    p.feeRate=Math.max(.02,Math.min(.14,profileFeeRate===null||profileFeeRate===0?.06:profileFeeRate));
    var customFeeRate=p.customFeeRate==null?null:finiteAgentNumber(p.customFeeRate);
    p.customFeeRate=customFeeRate===null?null:Math.max(.02,Math.min(.14,customFeeRate));
    p.storyStage=cap(p.storyStage||0,0,2);
    p.hiredSeason=Math.max(1,safeAgentNumber(p.hiredSeason,safeAgentNumber(s.season,1)));
    // Migrate old fixed-term saves to an open-ended representation contract.
    p.contractMode="open-ended";
    p.expiresSeason=null;
    p.signedApps=Math.max(0,safeAgentNumber(p.signedApps,0));
    p.lastChapterApps=Math.max(p.signedApps,safeAgentNumber(p.lastChapterApps,p.signedApps));
    p.lastChapterSeason=Math.max(p.hiredSeason,safeAgentNumber(p.lastChapterSeason,p.hiredSeason));
    p.lastPerformanceMilestone=Math.max(0,safeAgentNumber(p.lastPerformanceMilestone,Math.floor(safeAgentNumber(s.apps,0)/5)));
    p.strategyOverride=safeAgentText(p.strategyOverride,"");
    p.perks=normalizeAgentPerks(safeAgentField(p,"perks"));
    p.feeDebt=safeWholeAmount(p.feeDebt);
    return p;
  }
  function finiteAgentNumber(value){
    if(typeof value!=="number"&&typeof value!=="string")return null;
    if(typeof value==="string"&&!value.trim())return null;
    var n=Number(value);
    return Number.isFinite(n)?n:null;
  }
  function safeAgentNumber(value,fallback){
    var parsed=finiteAgentNumber(value);
    return parsed===null?fallback:parsed;
  }
  function safeWholeAmount(value){
    var n=finiteAgentNumber(value);
    return n===null?0:Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n)));
  }
  // Arrays restored from JSON can own non-callable forEach/reduce properties.
  // Read only canonical numeric data properties; never invoke an overridable array method
  // or an accessor-backed row while hydrating financial records.
  function inspectAgentArrayData(value){
    try{
      if(!Array.isArray(value))return null;
      var names=Object.getOwnPropertyNames(value);
      var lengthDescriptor=Object.getOwnPropertyDescriptor(value,"length");
      if(!lengthDescriptor||!Object.prototype.hasOwnProperty.call(lengthDescriptor,"value"))return null;
      var length=lengthDescriptor.value;
      if(!Number.isSafeInteger(length)||length<0||length>4294967295)return null;
      var entries=[],changed=false;
      for(var i=0;i<names.length;i++){
        var key=names[i];
        if(key==="length")continue;
        var index=Number(key);
        if(!Number.isInteger(index)||index<0||index>=4294967295||String(index)!==key){
          changed=true;
          continue;
        }
        var descriptor;
        try{descriptor=Object.getOwnPropertyDescriptor(value,key);}
        catch(_){changed=true;continue;}
        if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,"value")){
          changed=true;
          continue;
        }
        entries.push({index:index,value:descriptor.value});
      }
      // Proxy ownKeys traps may return numeric keys in a non-array order.
      // Keep the ledger's FIFO semantics by sorting the extracted indices explicitly.
      for(var sortIndex=1;sortIndex<entries.length;sortIndex++){
        var currentEntry=entries[sortIndex],insertAt=sortIndex-1;
        while(insertAt>=0&&entries[insertAt].index>currentEntry.index){
          entries[insertAt+1]=entries[insertAt];
          insertAt--;
        }
        entries[insertAt+1]=currentEntry;
      }
      if(entries.length!==length)changed=true;
      var values=[];
      for(var rowIndex=0;rowIndex<entries.length;rowIndex++)values.push(entries[rowIndex].value);
      return {values:values,changed:changed};
    }catch(_){return null;}
  }
  function safeAgentHistoryRows(value){
    var inspected=inspectAgentArrayData(value);
    if(!inspected)return [];
    var rows=[];
    for(var i=0;i<inspected.values.length;i++){
      var raw=inspected.values[i];
      if(!raw||typeof raw!=="object")continue;
      var title=safeAgentText(safeAgentField(raw,"title"),"");
      var text=safeAgentText(safeAgentField(raw,"text"),"");
      if(!text)text=safeAgentText(safeAgentField(raw,"description"),"");
      if(!title&&!text)continue;
      rows.push({
        season:safeWholeAmount(safeAgentField(raw,"season"))||1,
        day:safeWholeAmount(safeAgentField(raw,"day"))||1,
        title:title||"حدث مع الوكيل",
        text:text
      });
    }
    return rows;
  }
  function agentFeeDebtLedgerSnapshot(s){
    var inspected=inspectAgentArrayData(safeAgentField(s,"agentFeeDebtLedger"));
    if(!inspected)return "invalid";
    var rows=inspected.values,parts=[];
    for(var i=0;i<rows.length;i++){
      var entry=rows[i];
      if(!entry||typeof entry!=="object"){parts.push("invalid");continue;}
      parts.push([
        safeAgentText(safeAgentField(entry,"id"),""),
        safeAgentText(safeAgentField(entry,"agentId"),""),
        safeAgentText(safeAgentField(entry,"agentName"),""),
        safeAgentText(safeAgentField(entry,"reason"),""),
        safeAgentText(safeAgentField(entry,"amount"),""),
        safeAgentText(safeAgentField(entry,"paid"),""),
        safeAgentText(safeAgentField(entry,"outstanding"),""),
        safeAgentText(safeAgentField(entry,"createdSeason"),""),
        safeAgentText(safeAgentField(entry,"createdDay"),"")
      ].join(":"));
    }
    return parts.join("|");
  }
  function outstandingFeeDebt(s,agentId){
    var inspected=inspectAgentArrayData(safeAgentField(s,"agentFeeDebtLedger"));
    var ledger=inspected?inspected.values:[];
    var target=agentId==null?null:safeAgentId(agentId,"legacy"),total=0;
    for(var i=0;i<ledger.length;i++){
      var entry=ledger[i];
      if(!entry||typeof entry!=="object")continue;
      if(target!==null&&safeAgentId(safeAgentField(entry,"agentId"),"legacy")!==target)continue;
      var rawOutstanding=safeAgentField(entry,"outstanding");
      var outstanding=rawOutstanding==null
        ?Math.max(0,safeWholeAmount(safeAgentField(entry,"amount"))-safeWholeAmount(safeAgentField(entry,"paid")))
        :safeWholeAmount(rawOutstanding);
      total=Math.min(Number.MAX_SAFE_INTEGER,total+outstanding);
    }
    return total;
  }
  function syncCurrentAgentDebt(s){
    var profile=safeAgentField(s,"agentProfile");
    if(isPlainAgentRecord(profile))
      profile.feeDebt=outstandingFeeDebt(s,safeAgentField(profile,"id"));
  }
  function appendFeeDebt(s,amount,reason){
    var value=safeWholeAmount(amount);
    if(!s||!value)return null;
    var inspected=inspectAgentArrayData(safeAgentField(s,"agentFeeDebtLedger"));
    s.agentFeeDebtLedger=inspected?inspected.values:[];
    s.agentFeeDebtSequence=safeWholeAmount(s.agentFeeDebtSequence)+1;
    var p=safeAgentField(s,"agentProfile")||{},cfg=agentConfig(s)||LEGACY_AGENT;
    var entry={
      id:"agent-fee-debt-"+(safeWholeAmount(s.season)||1)+"-"+(safeWholeAmount(s.day)||1)+"-"+s.agentFeeDebtSequence,
      agentId:safeAgentId(safeAgentField(p,"id"),"legacy"),agentName:safeAgentText(safeAgentField(p,"name"),safeAgentText(cfg.name,"وكيل سابق")),
      reason:safeAgentText(reason,"أتعاب وكالة غير مسددة"),amount:value,paid:0,outstanding:value,
      createdSeason:safeWholeAmount(s.season)||1,createdDay:safeWholeAmount(s.day)||1
    };
    s.agentFeeDebtLedger.push(entry);
    syncCurrentAgentDebt(s);
    return entry;
  }
  function ensureFeeDebtLedger(s){
    if(!s||typeof s!=="object")return false;
    var changed=false;
    var inspected=inspectAgentArrayData(safeAgentField(s,"agentFeeDebtLedger"));
    if(!inspected){inspected={values:[],changed:true};}
    if(inspected.changed)changed=true;
    var rawLedger=inspected.values;
    s.agentFeeDebtLedger=rawLedger;
    var sequence=safeWholeAmount(s.agentFeeDebtSequence),normalized=[];
    for(var rowIndex=0;rowIndex<rawLedger.length;rowIndex++){
      var raw=rawLedger[rowIndex];
      if(!raw||typeof raw!=="object"){changed=true;continue;}
      var rawId=safeAgentField(raw,"id"),rawAgentId=safeAgentField(raw,"agentId");
      var rawAgentName=safeAgentField(raw,"agentName"),rawReason=safeAgentField(raw,"reason");
      var persistedIdMatch=safeAgentText(rawId,"").match(/^agent-fee-debt-\d+-\d+-(\d+)$/);
      if(persistedIdMatch){
        var persistedSequence=Number(persistedIdMatch[1]);
        if(Number.isSafeInteger(persistedSequence)&&persistedSequence>sequence)sequence=persistedSequence;
      }
      var rawAmount=safeAgentField(raw,"amount"),rawPaid=safeAgentField(raw,"paid");
      var rawOutstanding=safeAgentField(raw,"outstanding");
      var rawSeason=safeAgentField(raw,"createdSeason"),rawDay=safeAgentField(raw,"createdDay");
      var amount=safeWholeAmount(rawAmount),paid=safeWholeAmount(rawPaid);
      if(!amount&&rawOutstanding!=null)amount=Math.min(Number.MAX_SAFE_INTEGER,safeWholeAmount(rawOutstanding)+paid);
      paid=Math.min(amount,paid);
      var entry={
        id:safeAgentId(rawId,""),agentId:safeAgentId(rawAgentId,"legacy"),
        agentName:safeAgentText(rawAgentName,"وكيل سابق"),reason:safeAgentText(rawReason,"أتعاب وكالة غير مسددة"),
        amount:amount,paid:paid,outstanding:Math.max(0,amount-paid),
        createdSeason:safeWholeAmount(rawSeason)||1,createdDay:safeWholeAmount(rawDay)||1
      };
      if(!entry.id){sequence++;entry.id="agent-fee-debt-"+entry.createdSeason+"-"+entry.createdDay+"-"+sequence;}
      if(entry.id!==rawId||entry.agentId!==rawAgentId||entry.agentName!==rawAgentName
        ||entry.reason!==rawReason||entry.amount!==rawAmount||entry.paid!==rawPaid
        ||entry.outstanding!==rawOutstanding||entry.createdSeason!==rawSeason
        ||entry.createdDay!==rawDay)changed=true;
      normalized.push(entry);
    }
    if(normalized.length!==rawLedger.length)changed=true;
    s.agentFeeDebtLedger=normalized;
    if(sequence!==s.agentFeeDebtSequence){s.agentFeeDebtSequence=sequence;changed=true;}
    var paidTotal=safeWholeAmount(s.agentDebtPaid);
    if(paidTotal!==s.agentDebtPaid){s.agentDebtPaid=paidTotal;changed=true;}
    var lastPayrollDay=safeWholeAmount(s.agentDebtLastPayrollDay);
    if(lastPayrollDay!==s.agentDebtLastPayrollDay){s.agentDebtLastPayrollDay=lastPayrollDay;changed=true;}
    var profile=safeAgentField(s,"agentProfile");
    if(isPlainAgentRecord(profile)){
      var profileDebt=safeWholeAmount(safeAgentField(profile,"feeDebt"));
      var profileId=safeAgentField(profile,"id");
      var tracked=outstandingFeeDebt(s,profileId);
      if(profileDebt>tracked){
        var migratedDebt=appendFeeDebt(s,profileDebt-tracked,"رصيد مديونية محفوظ من إصدار سابق");
        // appendFeeDebt advances the persisted sequence; keep the local migration
        // counter in sync so the final normalization cannot roll it back.
        sequence=safeWholeAmount(s.agentFeeDebtSequence);
        if(migratedDebt){tracked=outstandingFeeDebt(s,profileId);changed=true;}
      }
      if(profileDebt!==tracked){profile.feeDebt=tracked;changed=true;}
    }
    return changed;
  }
  function collectDebtFromPayroll(s,available,payrollDay){
    if(!s||typeof s!=="object")return {paid:0,netPay:safeWholeAmount(available),remaining:0};
    ensureFeeDebtLedger(s);
    var netPay=safeWholeAmount(available),day=safeWholeAmount(payrollDay==null?(s.calendarDay||s.day):payrollDay);
    if(!netPay)return {paid:0,netPay:0,remaining:outstandingFeeDebt(s)};
    if(day>0&&safeWholeAmount(s.agentDebtLastPayrollDay)===day)
      return {paid:0,netPay:netPay,remaining:outstandingFeeDebt(s),duplicate:true};
    if(day>0)s.agentDebtLastPayrollDay=day;
    var remainingPay=netPay,paid=0,paidAgents=[];
    var ledger=safeAgentField(s,"agentFeeDebtLedger");
    if(!Array.isArray(ledger))ledger=[];
    for(var i=0;i<ledger.length;i++){
      if(remainingPay<=0)break;
      var entry=ledger[i];
      if(!entry||typeof entry!=="object")continue;
      var outstanding=safeWholeAmount(entry.outstanding);if(!outstanding)continue;
      var portion=Math.min(outstanding,remainingPay);
      entry.paid=Math.min(entry.amount,safeWholeAmount(entry.paid)+portion);
      entry.outstanding=Math.max(0,entry.amount-entry.paid);
      remainingPay-=portion;paid+=portion;paidAgents.push(entry.agentName+" ("+portion+")");
    }
    if(paid>0){
      s.agentDebtPaid=Math.min(Number.MAX_SAFE_INTEGER,safeWholeAmount(s.agentDebtPaid)+paid);
      syncCurrentAgentDebt(s);
      var left=outstandingFeeDebt(s);
      record(s,"سداد مديونية الوكيل","تم سداد "+paid+" جنيه من المرتب مقابل أتعاب "+paidAgents.join("، ")+". "+(left?"المتبقي على المسيرة "+left+" جنيه.":"تم إغلاق كل المديونيات المستحقة."));
    }
    return {paid:paid,netPay:remainingPay,remaining:outstandingFeeDebt(s),duplicate:false};
  }
  function makeProfile(id,s,legacy){
    var a=agentById(id)||LEGACY_AGENT;
    return ensureProfileShape({id:a.id,name:a.name,title:a.title,mark:a.mark,feeRate:a.feeRate,customFeeRate:null,relationship:52,
      contractMode:"open-ended",hiredSeason:safeAgentNumber(s.season,1)||1,expiresSeason:null,signedDay:safeAgentNumber(s.day,1)||1,signedApps:safeAgentNumber(s.apps,0),
      lastChapterApps:safeAgentNumber(s.apps,0),lastChapterSeason:safeAgentNumber(s.season,1)||1,lastPerformanceMilestone:Math.floor(safeAgentNumber(s.apps,0)/5),
      storyStage:0,strategyOverride:"",perks:{},feeDebt:0,legacyMigrated:!!legacy,contractMultiplierDelta:0,negotiationRaiseBonusDelta:0},s);
  }
  function current(s){var profile=safeAgentField(s,"agentProfile");return s&&s.agent?agentById(safeAgentField(profile,"id")):null;}
function availableAgentBalance(s){
    var value=finiteAgentNumber(s&&s.money);
    return value===null?0:Math.max(0,value);
  }
  function pendingAgentFeeQuote(s,id){
    var quote=safeAgentField(s,"agentNegotiationQuote"),agent=agentById(id),targetId=safeAgentId(id,"");
    var quoteId=safeAgentId(safeAgentField(quote,"agentId"),"");
    if(!quote||!agent||!targetId||quoteId!==targetId)return null;
    var rate=finiteAgentNumber(safeAgentField(quote,"feeRate"));
    if(rate===null||rate<.035||rate>Number(agent.feeRate))return null;
    return Math.round(rate*1000)/1000;
  }
    function ensureState(s){
    if(!s||typeof s!=="object")return false;
    var changed=false;
    var originalProfile=safeAgentField(s,"agentProfile");
    var originalPerks=safeAgentField(originalProfile,"perks");
    var normalizedProfile=normalizeAgentProfile(originalProfile);
    if(normalizedProfile!==originalProfile)s.agentProfile=normalizedProfile;
    if(normalizedProfile!==originalProfile||safeAgentField(normalizedProfile,"perks")!==originalPerks)changed=true;
    // Normalize the debt ledger after converting exotic profile containers to plain records,
    // so legacy fee debt can be migrated without Date/Map/typed-array serialization loss.
    if(ensureFeeDebtLedger(s))changed=true;
    var originalHistory=safeAgentField(s,"agentHistory");
    var normalizedHistory=normalizeAgentHistory(originalHistory);
    if(normalizedHistory!==originalHistory){s.agentHistory=normalizedHistory;changed=true;}
    var profile=safeAgentField(s,"agentProfile");
    if(s.agent&&(!profile||!agentById(safeAgentField(profile,"id")))){s.agentProfile=makeProfile("legacy",s,true);changed=true;}
    profile=safeAgentField(s,"agentProfile");
    if(profile&&agentById(safeAgentField(profile,"id"))){
      var oldContractMode=safeAgentField(profile,"contractMode"),oldExpiresSeason=safeAgentField(profile,"expiresSeason");
      var oldFeeDebt=safeAgentField(profile,"feeDebt"),oldFeeRate=safeAgentField(profile,"feeRate");
      var oldCustomFeeRate=safeAgentField(profile,"customFeeRate"),oldPerks=safeAgentField(profile,"perks");
      ensureProfileShape(profile,s);
      if(oldPerks!==profile.perks)changed=true;
      if(oldContractMode!=="open-ended"||oldExpiresSeason!=null||oldFeeDebt!==profile.feeDebt||oldFeeRate!==profile.feeRate||oldCustomFeeRate!==profile.customFeeRate)changed=true;
      if(!s.agent){s.agent=true;changed=true;}
    }else if(!s.agent){s.agentProfile=null;}
    if(s.agentNegotiationQuote!=null){
      var rawQuote=safeAgentField(s,"agentNegotiationQuote");
      var normalizedQuote=normalizeAgentFeeQuote(rawQuote,s);
      if(normalizedQuote!==rawQuote){s.agentNegotiationQuote=normalizedQuote;changed=true;}
    }
    if(ensureFeeDebtLedger(s))changed=true;
    return changed;
  }
  function record(s,title,text,silent){
    var history=safeAgentHistoryRows(safeAgentField(s,"agentHistory"));
    var e={season:safeAgentNumber(s.season,1)||1,day:safeAgentNumber(s.day,1)||1,title:safeAgentText(title,"حدث مع الوكيل"),text:safeAgentText(text,"")};
    history.unshift(e);s.agentHistory=history.slice(0,40);
    if(!silent){var api=API();if(api&&api.log)api.log(e.title+": "+e.text);}
  }
  function save(s,message){
    var api=API();if(api&&api.save)api.save();if(api&&api.render)api.render();renderPanel(s);
    if(message&&api&&api.toast)api.toast(message);
  }
  function rel(s){return s&&s.agentProfile?cap(s.agentProfile.relationship,0,100):50;}
  function canUseAgent(s){return !!(s&&s.careerStarted&&!s.retired);}
  function currentChapter(s){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p||p.storyStage>=cfg.chapters.length)return null;
    var stage=safeAgentNumber(p.storyStage,0),apps=safeAgentNumber(s.apps,0);
    var ready=stage===0?(apps-safeAgentNumber(p.signedApps,0)>=3||!!s.seasonFinished):(apps-safeAgentNumber(p.lastChapterApps,0)>=4||safeAgentNumber(s.season,1)>safeAgentNumber(p.lastChapterSeason,0));
    return ready?cfg.chapters[stage]:null;
  }
  function progress(s){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return {stage:0,total:2,ready:false,remaining:0,complete:false};
    var stage=Math.min(cfg.chapters.length,safeAgentNumber(p.storyStage,0)),apps=safeAgentNumber(s.apps,0);
    var need=stage===0?Math.max(0,3-(apps-safeAgentNumber(p.signedApps,0))):stage===1?Math.max(0,4-(apps-safeAgentNumber(p.lastChapterApps,0))):0;
    return {stage:stage,total:cfg.chapters.length,ready:!!currentChapter(s),remaining:need,complete:stage>=cfg.chapters.length};
  }
  function addTrust(s,delta){if(s.agentProfile)s.agentProfile.relationship=cap(safeAgentNumber(s.agentProfile.relationship,0)+safeAgentNumber(delta,0),0,100);}

  function ensurePanel(){
    panel=document.getElementById("lwa-agent-system");if(panel)return true;
    var grid=document.querySelector("#page-contract .grid");if(!grid)return false;
    panel=document.createElement("section");panel.id="lwa-agent-system";panel.className="lwa-agent-panel";panel.setAttribute("aria-labelledby","lwa-title");
    panel.innerHTML=
      '<div class="lwa-header"><div><div class="lwa-eyebrow"><span class="lwa-dot"></span> REPRESENTATION / PLAYER CAREER</div><h2 id="lwa-title">وكلاء أعمالك… كل واحد بطريقته</h2><p>اختار الشخصية اللي تناسب طموحك. قصته مش ديكور؛ أسلوبه هيأثر على التفاوض، نوعية عروض الانتقال، الرعاية، وتكاليف قراراتك.</p></div><div class="lwa-header-mark">AGENT<br>NETWORK</div></div>'+
      '<div id="lwa-current-summary" class="lwa-current-summary"></div>'+
      '<div id="lwa-agent-debt" hidden style="margin:-5px 0 16px;padding:11px 13px;border:1px solid #69533a;border-radius:12px;background:#241b10;color:#f1d7a0;font-size:10px;line-height:1.8"></div>'+
      '<div class="lwa-market-head"><div><span class="lwa-market-kicker">THE AGENT MARKET</span><h3>قابل الوكلاء واسمع قصصهم</h3></div><span id="lwa-agent-count" class="lwa-count">6 شخصيات</span></div>'+
      '<div id="lwa-agent-cards" class="lwa-agent-grid"></div>'+
      '<div class="lwa-history-wrap"><div class="lwa-history-head"><strong>سجل علاقتك بالوكلاء</strong><span id="lwa-history-count">0 حدث</span></div><div id="lwa-agent-history" class="lwa-agent-history"></div></div>'+
      '<div class="lwa-agent-disclaimer">كل الأسماء والقصص شخصيات خيالية داخل Last Whistle. الأتعاب محسوبة من مكافآت اللعبة وخدمات التفاوض فقط، والانتقال النهائي يظل بقرارك من سوق الانتقالات. أي أتعاب غير مسددة تظل محفوظة وتُحصّل تدريجيًا من المرتبات القادمة.</div>';
    grid.insertAdjacentElement("afterbegin",panel);return true;
  }
  function renderCard(a,activeId){
    var active=a.id===activeId;
    return '<article class="lwa-agent-card '+(active?"is-current":"")+'"><div class="lwa-agent-card-top"><div class="lwa-agent-monogram">'+esc(a.mark)+'</div><div class="lwa-agent-name-wrap"><span class="lwa-agent-kicker">'+esc(a.title)+'</span><h3>'+esc(a.name)+'</h3><p>'+esc(a.style)+'</p></div>'+(active?'<span class="lwa-agent-active-badge">وكيلك الحالي</span>':'<span class="lwa-agent-fee">'+Math.round(a.feeRate*100)+'% عمولة</span>')+'</div>'+
      '<p class="lwa-agent-origin">'+esc(a.origin)+'</p><div class="lwa-agent-quote">«'+esc(a.pitch)+'»</div>'+
      '<div class="lwa-agent-tradeoffs"><div><small>نقطة القوة</small><p>'+esc(a.strength)+'</p></div><div><small>المقابل</small><p>'+esc(a.weakness)+'</p></div></div>'+
      '<div class="lwa-agent-tags"><span>'+esc(a.style)+'</span><span>اتفاق مفتوح المدة</span><span>أتعاب عند الصفقة أو التفاوض</span></div>'+
      '<button type="button" class="lwa-agent-action" data-lwag-action="'+(active?"agent-active":"agent-meet")+'" data-agent-id="'+esc(a.id)+'">'+(active?"افتح قصتنا معًا":activeId?"تفاوض على التغيير":"قابل الوكيل")+' <b aria-hidden="true">←</b></button></article>';
  }
  function renderPanel(s){
    if(!s||!ensurePanel())return;
    var cfg=agentConfig(s),p=s.agentProfile,pr=p?progress(s):null,hasLead=!!safeAgentField(s,"agentLead"),summary=document.getElementById("lwa-current-summary"),cards=document.getElementById("lwa-agent-cards");
    if(summary){
      if(cfg&&p){
        var r=rel(s),label=r>=75?"ثقة قوية":r>=50?"علاقة مستقرة":r>=30?"علاقة متوترة":"علاقة على المحك";
        summary.innerHTML='<div class="lwa-current-left"><div class="lwa-current-label">CURRENT REPRESENTATIVE</div><h3>'+esc(cfg.name)+' <span>· '+esc(cfg.title)+'</span></h3><p>'+esc(cfg.voice)+'</p>'+
          '<div class="lwa-rel-row"><span>'+label+'</span><b>'+r+'/100</b></div><div class="lwa-rel-bar"><i style="width:'+r+'%"></i></div>'+
          '<div class="lwa-current-meta"><span>مستمر حتى فسخك له</span><span>'+Math.round(safeAgentNumber(p.customFeeRate==null?p.feeRate:p.customFeeRate,0)*100)+'% أتعاب</span><span>تقدر تنهيه أو تغيّره وقت ما تحب</span></div></div>'+
          '<div class="lwa-current-right"><div class="lwa-arc-mark">'+(pr.complete?"✓":(pr.stage+1)+"/"+pr.total)+'</div><strong>'+(pr.complete?"قصة مكتملة":pr.ready?"فصل جديد جاهز":"القصة مستمرة")+'</strong><p>'+(pr.complete?"خلصت الفصول الأساسية مع الوكيل.":pr.ready?"فيه موقف جديد مستني قرارك.":"العب "+pr.remaining+" مشاركة إضافية عشان تفتح الفصل التالي.")+'</p><button type="button" class="lwa-agent-action lwa-agent-action-light" data-lwag-action="agent-story">'+(pr.ready?"افتح الفصل الجديد":"راجع قصتنا")+' <b aria-hidden="true">←</b></button></div>';
      }else{
        summary.innerHTML='<div class="lwa-current-left"><div class="lwa-current-label">NO ACTIVE REPRESENTATIVE</div><h3>'+(hasLead?"وصلت لمرحلة اختيار الوكيل":"مسيرتك لسه من غير وكيل أعمال")+'</h3><p>'+(hasLead?"قابل الوكلاء، اسمع طريقتهم وشروطهم، واختار اللي يخدم خطتك. فتح باب التمثيل مش معناه إنك مضطر توقّع.":"مش لازم توقّع من أول يوم. تقدر تبدأ من غير وكيل، وبعدها تختار شخصًا مناسبًا لما تكون مستعدًا.")+'</p></div><div class="lwa-current-right"><div class="lwa-arc-mark">06</div><strong>ست طرق مختلفة</strong><p>الاستقرار، الشهرة، الانتقالات، التفاوض، السرعة، أو الخطة الطويلة.</p></div>';
      }
    }
    var debtBox=document.getElementById("lwa-agent-debt"),debtTotal=outstandingFeeDebt(s),debtPaid=safeWholeAmount(s.agentDebtPaid);
    if(debtBox){
      debtBox.hidden=debtTotal<=0;
      debtBox.innerHTML=debtTotal>0
        ?'<strong>مديونية الوكلاء المستحقة: '+debtTotal+' جنيه</strong><span>التحصيل بيتم تدريجيًا من المرتبات القادمة، والرصيد يفضل محفوظًا حتى بعد تغيير الوكيل أو إنهاء الاتفاق.'+(debtPaid?' إجمالي ما تم سداده: '+debtPaid+' جنيه.':'')+'</span>'
        :"";
    }
    if(cards)cards.innerHTML=AGENTS.map(function(a){return renderCard(a,p&&s.agent?p.id:"");}).join("");
    var historyRows=safeAgentHistoryRows(safeAgentField(s,"agentHistory"));
    var rows=historyRows.slice(0,4),hist=document.getElementById("lwa-agent-history"),count=document.getElementById("lwa-history-count");
    if(count)count.textContent=historyRows.length+" حدث";
    if(hist)hist.innerHTML=rows.length?rows.map(function(e){return '<div class="lwa-history-item"><span class="lwa-history-marker"></span><div><strong>'+esc(e.title)+'</strong><p>'+esc(e.text)+' <small>· الموسم '+esc(e.season)+' / اليوم '+esc(e.day)+'</small></p></div></div>';}).join(""):'<p class="lwa-empty-history">مفيش أحداث مسجلة لسه. أول مقابلة أو قرار مع وكيلك هتلاقيه هنا.</p>';
    var n=document.getElementById("lwa-agent-count");if(n)n.textContent=AGENTS.length+" شخصيات";
  }
  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement("div");overlay.id="lwa-agent-overlay";overlay.className="lwa-agent-overlay";overlay.hidden=true;
    overlay.addEventListener("click",function(e){if(e.target===overlay)closeDialog();});document.body.appendChild(overlay);return overlay;
  }
  function closeDialog(){if(overlay){overlay.hidden=true;overlay.innerHTML="";}selectedAgentId="";quotedFeeRate=null;}
  function frame(title,kicker,body,note){
    var host=ensureOverlay();host.hidden=false;host.innerHTML='<div class="lwa-dialog" role="dialog" aria-modal="true" aria-labelledby="lwa-dialog-title" dir="rtl"><div class="lwa-dialog-top"><div><span class="lwa-market-kicker">'+esc(kicker||"AGENT MEETING")+'</span><h2 id="lwa-dialog-title">'+esc(title)+'</h2></div><button type="button" class="lwa-dialog-close" data-lwag-action="close" aria-label="إغلاق">×</button></div><div class="lwa-dialog-body">'+body+'</div>'+(note?'<div class="lwa-dialog-note">'+esc(note)+'</div>':'')+'</div>';
    var x=host.querySelector(".lwa-dialog-close");if(x)x.focus();
  }
  function option(action,title,detail,attrs){return '<button type="button" class="lwa-option" data-lwag-action="'+esc(action)+'"'+(attrs||"")+'><span><strong>'+esc(title)+'</strong>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</span><b aria-hidden="true">←</b></button>';}
  function candidate(id){var agent=agentById(id);return agent&&agent.id!=="legacy"?agent:null;}
  function meetingBody(a,s,fee){
    var rate=fee==null?a.feeRate:fee;
    return '<div class="lwa-meeting-card"><div class="lwa-meeting-card-top"><span class="lwa-agent-monogram">'+esc(a.mark)+'</span><div><span class="lwa-market-kicker">'+esc(a.title)+'</span><h3>'+esc(a.name)+'</h3><p>'+esc(a.style)+'</p></div></div><div class="lwa-meeting-quote">«'+esc(a.pitch)+'»</div><p class="lwa-meeting-story">'+esc(a.origin)+'</p><div class="lwa-meeting-terms"><div><small>عمولة الوكيل</small><strong>'+Math.round(rate*100)+'%</strong><span>من مكافأة الانتقال أو خدمة تفاوض داخل اللعبة</span></div><div><small>مدة التمثيل</small><strong>مفتوح</strong><span>يستمر لحد ما تختار تنهي الاتفاق</span></div></div><div class="lwa-agent-tradeoffs"><div><small>نقطة القوة</small><p>'+esc(a.strength)+'</p></div><div><small>المقابل</small><p>'+esc(a.weakness)+'</p></div></div></div>';
  }
  function openMeeting(id){
    var s=API().getState();if(!canUseAgent(s)){API().toast(s&&s.retired?"المسيرة انتهت بالاعتزال.":"ابدأ مسيرتك الأول علشان تقابل الوكلاء.");return;}
    var a=candidate(id);if(!a)return;
    if(s.agent&&s.agentProfile&&safeAgentId(s.agentProfile.id,"")===safeAgentId(id,"")){openActive();return;}
    selectedAgentId=id;
    var savedQuote=pendingAgentFeeQuote(s,id);
    quotedFeeRate=savedQuote==null?a.feeRate:savedQuote;
    if(s.agent&&s.agentProfile){
      var old=agentConfig(s)||LEGACY_AGENT,exitFee=Math.max(20,Math.round((safeAgentNumber(s.weeklyWage,250)||250)*safeAgentNumber(old.exitFeeWeeks,.25)));
      frame("قبل ما تغيّر وكيلك","CHANGE REPRESENTATIVE",meetingBody(a,s,quotedFeeRate)+'<div class="lwa-change-notice"><strong>إنهاء الاتفاق الحالي</strong><p>هتدفع '+exitFee+' جنيه داخل اللعبة كشرط خروج من '+esc(old.name)+'. بعدها يبدأ اتفاق جديد مفتوح المدة مع '+esc(a.name)+'.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-switch-sign" data-agent-id="'+esc(id)+'"'+(availableAgentBalance(s)<exitFee?" disabled":"")+'>'+ (availableAgentBalance(s)<exitFee?"رصيدك غير كافٍ":"أدفع شرط الخروج وأوقّع") +'</button><button type="button" class="lwa-button" data-lwag-action="close">أرجع</button></div>',"تغيير الوكيل قرار داخل المسيرة. راجع العمولة والأسلوب قبل ما تلتزم.");
    }else{
      frame("مقابلة أولى مع "+a.name,"FIRST MEETING",meetingBody(a,s,quotedFeeRate)+'<p class="lwa-intro">اسمع عرضه، وبعدها اختار بين قبول الشروط أو التفاوض على عمولته. نجاح التفاوض مش مضمون.</p><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أوقّع الاتفاق</button><button type="button" class="lwa-button" data-lwag-action="agent-counter" data-agent-id="'+esc(id)+'">أفاوض على العمولة</button><button type="button" class="lwa-button" data-lwag-action="close">أفكر شوية</button></div>',"اتفاق التمثيل مستمر لحد ما تختار تنهيه. العمولة تُخصم من مكافآت اللعبة فقط، ولا يوجد دفع بفلوس حقيقية.");
    }
  }
  async function negotiateFee(id){
    var api=API(),s=api&&api.getState(),a=candidate(id);if(!a||!canUseAgent(s))return {ok:false,reason:"التفاوض غير متاح حاليًا."};
    var skill=safeAgentNumber(s.professionalism,0),rating=api.overall?safeAgentNumber(api.overall(),0):50;
    var chance=cap(54+(skill-50)*.28+(rating-60)*.22-a.counterDifficulty*12,18,86),won=randomUnit(s)*100<chance;
    if(won){
      var nextRate=Math.max(.035,Math.round((a.feeRate-.015)*1000)/1000);
      var success=await runAgentContractMutation(s,function(){
        s.agentNegotiationQuote={agentId:id,feeRate:nextRate,season:safeAgentNumber(s.season,1)||1,calendarDay:safeAgentNumber(s.calendarDay,safeAgentNumber(s.day,1))||1};
        record(s,"تفاوض أولي مع "+a.name,"نجحت في تخفيض العمولة المبدئية إلى "+Math.round(nextRate*100)+"%.");
        return {agentId:id,feeRate:nextRate};
      },"تم حفظ عرض العمولة المخفّضة. تقدر توقّع عليه حتى بعد إعادة فتح اللعبة.");
      if(!success.ok)return success;
      quotedFeeRate=nextRate;selectedAgentId=id;
      frame("المفاوضات جابت نتيجة","FEE NEGOTIATION",meetingBody(a,s,quotedFeeRate)+'<div class="lwa-result lwa-result-good"><strong>اتفقتم على عمولة أقل</strong><p>نزلت العمولة من '+Math.round(a.feeRate*100)+'% إلى '+Math.round(quotedFeeRate*100)+'%. العرض محفوظ في مسيرتك لحد ما توقّع أو تفاوض على وكيل آخر.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أوقّع على الشروط الجديدة</button><button type="button" class="lwa-button" data-lwag-action="close">مش دلوقتي</button></div>');
      return success;
    }
    var existingQuote=pendingAgentFeeQuote(s,id),availableRate=existingQuote==null?a.feeRate:existingQuote;
    var rejected=await runAgentContractMutation(s,function(){
      record(s,"تفاوض أولي مع "+a.name,"الوكيل رفض تخفيض العمولة المقترح. العرض المتاح حاليًا "+Math.round(availableRate*100)+"%.");
      return {agentId:id,negotiated:false};
    },"تم حفظ نتيجة التفاوض.");
    if(!rejected.ok)return rejected;
    quotedFeeRate=availableRate;selectedAgentId=id;
    frame("الوكيل متمسك بشروطه","FEE NEGOTIATION",'<div class="lwa-result lwa-result-neutral"><strong>'+esc(a.name)+' رفض تخفيضًا إضافيًا</strong><p>'+esc(a.voice)+'</p><p>العمولة المتاحة حاليًا '+Math.round(availableRate*100)+'%. تقدر تقبل العرض الحالي أو تبحث عن وكيل آخر.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أقبل العمولة المعروضة</button><button type="button" class="lwa-button" data-lwag-action="close">أنهي المقابلة</button></div>');
    return rejected;
  }
  function applyAgentSigning(s,id,a,newFee){
    var p=makeProfile(id,s,false),rate=finiteAgentNumber(newFee);
    if(rate===null||rate<=0)rate=a.feeRate;
    p.customFeeRate=Math.max(.035,Math.min(.14,rate));p.feeRate=a.feeRate;p.relationship=55;
    p.signedApps=safeAgentNumber(s.apps,0);p.lastChapterApps=safeAgentNumber(s.apps,0);p.lastChapterSeason=safeAgentNumber(s.season,1)||1;p.lastPerformanceMilestone=Math.floor(safeAgentNumber(s.apps,0)/5);
    p.contractMultiplierDelta=0;p.negotiationRaiseBonusDelta=0;p.strategyOverride="";
    s.agentProfile=p;s.agent=true;s.agentLead=false;s.storyFlags=s.storyFlags&&typeof s.storyFlags==="object"?s.storyFlags:{};
    s.storyFlags["agent-offer"]=true;s.agentNegotiationQuote=null;quotedFeeRate=null;selectedAgentId=id;
    record(s,"توقيع اتفاق تمثيل مع "+a.name,"وقعت اتفاق تمثيل مفتوح المدة بعمولة "+Math.round(p.customFeeRate*100)+"%. "+a.pitch);
    if(API().setStory)API().setStory("بدأ فصل جديد: "+a.name,"وكيل أعمالك الجديد هو "+a.name+". أسلوبه: "+a.style+". اختياراتك في قصته هتأثر على خطتك ومميزات التفاوض والانتقالات.");
    return p;
  }
  async function signAgent(id,newFee,exitPaid){
    var api=API(),s=api&&api.getState(),a=candidate(id);
    if(!a||!canUseAgent(s))return {ok:false,reason:"اتفاق الوكالة غير متاح حاليًا."};
    if(s.agent&&s.agentProfile&&safeAgentId(s.agentProfile.id,"")===safeAgentId(id,"")){
      if(api.toast)api.toast("أنت متعاقد بالفعل مع الوكيل ده.");
      return {ok:false,reason:"already-signed"};
    }
    if(s.agent&&s.agentProfile&&s.agentProfile.id!==id&&!exitPaid){openMeeting(id);return {ok:false,reason:"switch-required"};}
    var savedQuote=pendingAgentFeeQuote(s,id),feeRate=savedQuote==null?newFee:savedQuote;
    var result=await runAgentContractMutation(s,function(){
      applyAgentSigning(s,id,a,feeRate);
      return {agentId:id,feeRate:safeAgentNumber(s.agentProfile.customFeeRate,0)};
    },"تم توقيع اتفاق الوكالة. قصة "+a.name+" هتتفتح مع تقدم المسيرة.");
    if(result.ok)closeDialog();
    return result;
  }
  function openActive(){
    var s=API().getState(),cfg=agentConfig(s),p=s.agentProfile;
    if(!cfg||!p){frame("مفيش وكيل حالي","AGENT MARKET",'<p class="lwa-intro">اختار وكيلًا من السوق لبدء اتفاق تمثيل.</p><div class="lwa-dialog-actions"><button type="button" class="lwa-button" data-lwag-action="close">تمام</button></div>');return;}
    selectedAgentId=p.id;var pr=progress(s),chapter=currentChapter(s);
    var body=meetingBody(cfg,s,p.customFeeRate==null?p.feeRate:p.customFeeRate)+'<div class="lwa-current-story-status"><div><small>مرحلة القصة</small><strong>'+(pr.complete?"2 من 2 — مكتملة":(pr.stage+1)+" من "+pr.total)+'</strong></div><div><small>علاقة الوكيل</small><strong>'+rel(s)+'/100</strong></div></div>';
    if(chapter){
      body+='<div class="lwa-current-chapter"><span class="lwa-market-kicker">NEW CHAPTER</span><h3>'+esc(chapter.title)+'</h3><p>'+esc(chapter.body)+'</p><div class="lwa-options">'+chapter.options.map(function(c,i){return '<button type="button" class="lwa-option" data-lwag-action="agent-story-choice" data-choice-index="'+i+'"><span><strong>'+esc(c.label)+'</strong><small>'+esc(c.detail)+'</small></span><b aria-hidden="true">←</b></button>';}).join("")+'</div></div>';
    }else if(!pr.complete){
      body+='<div class="lwa-change-notice"><strong>الفصل التالي لسه مقفول</strong><p>كمّل '+pr.remaining+' مشاركة إضافية أو انتقل للموسم التالي؛ بعدها هيظهر موقف جديد خاص بشخصية '+esc(cfg.name)+'.</p></div>';
    }else{
      body+='<div class="lwa-result lwa-result-good"><strong>خلصت الفصول الأساسية</strong><p>قصتك مع '+esc(cfg.name)+' محفوظة، ومميزاته تفضل شغالة لحد ما تختار تنهي الاتفاق.</p></div>';
    }
    body+='<div class="lwa-dialog-actions"><button type="button" class="lwa-button" data-lwag-action="close">رجوع</button><button type="button" class="lwa-button" data-lwag-action="agent-end-current">إنهاء التعاقد</button></div>';
    frame("ملف الوكيل: "+cfg.name,"YOUR REPRESENTATIVE",body,"العلاقة المرتفعة تقوّي مزايا الوكيل. قراراتك في الفصول قد تغيّر تخصصه وطريقة بحثه.");
  }
  async function finishStory(index){
    var api=API(),s=api&&api.getState(),cfg=agentConfig(s),p=s&&s.agentProfile,chapter=currentChapter(s);
    if(!cfg||!p||!chapter||!chapter.options[index])return {ok:false,reason:"اختيار قصة الوكيل غير متاح."};
    var c=chapter.options[index];
    var result=await runAgentContractMutation(s,function(){
      Object.keys(c.effects||{}).forEach(function(k){if(["trust","morale","energy","fatigue","professionalism","mediaReputation","teamChemistry","coachRelationship","money","followers"].indexOf(k)>=0)boundedStat(s,k,c.effects[k]);});
      if(c.strategy)p.strategyOverride=c.strategy;
      if(c.contractMultiplierDelta)p.contractMultiplierDelta=Math.max(-.06,Math.min(.06,safeAgentNumber(p.contractMultiplierDelta,0)+c.contractMultiplierDelta));
      if(c.negotiationRaiseBonusDelta)p.negotiationRaiseBonusDelta=Math.max(-.1,Math.min(.15,safeAgentNumber(p.negotiationRaiseBonusDelta,0)+c.negotiationRaiseBonusDelta));
      if(c.setPerk)p.perks[c.setPerk]=true;
      addTrust(s,c.relationship);p.storyStage=cap(safeAgentNumber(p.storyStage,0)+1,0,cfg.chapters.length);
      p.lastChapterApps=safeAgentNumber(s.apps,0);p.lastChapterSeason=safeAgentNumber(s.season,1)||1;
      record(s,cfg.name+" — "+chapter.title,c.outcome+" (العلاقة: "+rel(s)+"/100)");
      if(api.setStory)api.setStory(chapter.title,c.outcome);
      return {chapterTitle:chapter.title};
    },"القرار اتسجل في قصة الوكيل واتطبقت نتائجه.");
    if(result.ok)openActive();
    return result;
  }
  function endCurrent(){
    var api=API(),s=api&&api.getState(),p=s&&s.agentProfile;
    if(!canUseAgent(s)||!s.agent||!p){
      if(api&&api.toast)api.toast(s&&s.retired?"المسيرة انتهت بالاعتزال؛ لا يمكن تغيير اتفاق الوكالة.":"لا يوجد اتفاق وكالة نشط.");
      closeDialog();return;
    }
    var cfg=agentConfig(s)||LEGACY_AGENT,fee=Math.max(20,Math.round((safeAgentNumber(s.weeklyWage,250)||250)*safeAgentNumber(cfg.exitFeeWeeks,.25)));
    var balance=availableAgentBalance(s);
    frame("إنهاء اتفاق التمثيل","END REPRESENTATION",'<div class="lwa-change-notice"><strong>شرط الخروج: '+fee+' جنيه</strong><p>لو أنهيت الاتفاق، هتدفع الشرط من رصيد اللعبة، وبعدها تقدر تختار وكيلًا آخر أو تكمل من غير وكيل.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-confirm-end"'+(balance<fee?" disabled":"")+'>'+(balance<fee?"رصيدك غير كافٍ":"أدفع وأنهي الاتفاق")+'</button><button type="button" class="lwa-button" data-lwag-action="close">أكمل معاه</button></div>');
  }
  async function confirmEnd(){
    var api=API(),s=api&&api.getState(),p=s&&s.agentProfile;
    if(!canUseAgent(s)||!s.agent||!p){
      if(api&&api.toast)api.toast(s&&s.retired?"المسيرة انتهت بالاعتزال؛ لا يمكن إنهاء اتفاق الوكالة.":"لا يوجد اتفاق وكالة نشط.");
      closeDialog();return {ok:false,reason:"no-active-agent"};
    }
    var cfg=agentConfig(s)||LEGACY_AGENT;
    var fee=Math.max(20,Math.round((safeAgentNumber(s.weeklyWage,250)||250)*safeAgentNumber(cfg.exitFeeWeeks,.25))),balance=availableAgentBalance(s);
    if(balance<fee){if(api.toast)api.toast("رصيدك مش كفاية لشرط الخروج. تقدر تكمّل الاتفاق لحد ما تقدر تغيّره.");return {ok:false,reason:"insufficient-exit-fee"};}
    var result=await runAgentContractMutation(s,function(){
      s.money=balance-fee;
      record(s,"إنهاء اتفاق الوكالة","أنهيت اتفاق التمثيل مع "+cfg.name+" ودفعت "+fee+" جنيه داخل اللعبة.");
      s.agent=false;s.agentProfile=null;
      return {fee:fee};
    },"انتهى اتفاق الوكالة. السوق متاح لاختيار وكيل جديد.");
    if(result.ok)closeDialog();
    return result;
  }
  async function switchAgent(id){
    var api=API(),s=api&&api.getState(),old=s&&(agentConfig(s)||LEGACY_AGENT),p=s&&s.agentProfile,a=candidate(id);
    if(!a||!p||!s.agent||!canUseAgent(s))return {ok:false,reason:"تغيير الوكيل غير متاح حاليًا."};
    if(safeAgentId(p.id,"")===safeAgentId(id,"")){
      if(api.toast)api.toast("ده وكيلك الحالي بالفعل.");
      return {ok:false,reason:"already-current-agent"};
    }
    var fee=Math.max(20,Math.round((safeAgentNumber(s.weeklyWage,250)||250)*safeAgentNumber(old.exitFeeWeeks,.25))),balance=availableAgentBalance(s);
    if(balance<fee){if(api.toast)api.toast("رصيدك مش كفاية لشرط الخروج من الوكيل الحالي.");return {ok:false,reason:"insufficient-exit-fee"};}
    var savedQuote=pendingAgentFeeQuote(s,id);
    var result=await runAgentContractMutation(s,function(){
      s.money=balance-fee;
      record(s,"تغيير الوكيل","أنهيت اتفاق "+old.name+" ودفعت "+fee+" جنيه داخل اللعبة لاختيار "+a.name+".");
      s.agent=false;s.agentProfile=null;
      applyAgentSigning(s,id,a,savedQuote);
      return {exitFee:fee,agentId:id,feeRate:safeAgentNumber(s.agentProfile.customFeeRate,0)};
    },"تم تغيير الوكيل وحفظ الاتفاق الجديد.");
    if(result.ok)closeDialog();
    return result;
  }

  function profileValue(s,key,fallback){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return fallback;
    var base=safeAgentNumber(cfg[key],fallback),r=rel(s);
    if(key==="contractMultiplier")return Math.max(.96,Math.min(1.18,(Number.isFinite(base)?base:1.08)+(r-50)*.00035+safeAgentNumber(p.contractMultiplierDelta,0)));
    if(key==="negotiationRaiseBonus")return Math.max(-.08,Math.min(.15,(Number.isFinite(base)?base:0)+safeAgentNumber(p.negotiationRaiseBonusDelta,0)));
    return Number.isFinite(base)?base:fallback;
  }
  function contractTerms(s){if(!s||!s.agent||!s.agentProfile)return false;return {contractMultiplier:profileValue(s,"contractMultiplier",1.08)};}
  function negotiationChanceBonus(s){if(!s||!s.agent||!s.agentProfile)return 0;return Math.round(profileValue(s,"negotiationBonus",0)+(rel(s)-50)*.08);}
  function transferOfferChance(s,base){if(!s||!s.agent||!s.agentProfile)return base;return Math.max(.12,Math.min(.82,safeAgentNumber(base,0)+profileValue(s,"offerChanceBonus",0)+(rel(s)-50)*.001));}
  function prioritizeTargets(s,targets){
    if(!Array.isArray(targets)||!targets.length)return targets||[];
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return targets;
    var strategy=p.strategyOverride||cfg.strategy,currentPower=safeAgentNumber(s.clubPower,50)||50,currentCountry=safeAgentText(s.leagueCountry,"");
    var scored=targets.map(function(t,i){
      var power=safeAgentNumber(t&&t.power,50)||50,d=power-currentPower,score=0;
      if(strategy==="local"){score+=safeAgentText(t.country,"")===currentCountry?45:-5;score+=d>=-8&&d<=16?18:-Math.abs(d-3)*.35;}
      else if(strategy==="ambitious"){score+=d>0?25+Math.min(15,d):-18;score+=safeAgentText(t.country,"")!==currentCountry?6:0;}
      else if(strategy==="brand"){score+=power*.38+(safeAgentText(t.country,"")!==currentCountry?12:0);}
      else if(strategy==="salary"){score+=power*.22+Math.min(18,Math.max(-18,d));}
      else if(strategy==="rapid"){score+=24-Math.abs(d)*.7+(safeAgentText(t.country,"")===currentCountry?8:0);}
      else if(strategy==="role"||strategy==="long-term"){score+=d>=-8&&d<=12?26:-Math.abs(d)*.5;score+=safeAgentText(t.country,"")===currentCountry?6:0;}
      else{score+=d>=-5&&d<=15?25:-Math.abs(d)*.4;score+=safeAgentText(t.country,"")!==currentCountry?4:0;}
      return {target:t,score:score,index:i};
    });
    scored.sort(function(a,b){return b.score-a.score||a.index-b.index;});
    return scored.slice(0,Math.min(5,scored.length)).map(function(x){return x.target;});
  }
  function adjustTransferWage(s,wage){
    if(!s||!s.agent||!s.agentProfile)return wage;
    var cfg=agentConfig(s);if(!cfg)return wage;
    var factor=(safeAgentNumber(cfg.transferWageMultiplier,1)||1)+(rel(s)-50)*.00025;
    return Math.max(0,Math.round((safeAgentNumber(wage,0))*Math.max(.9,Math.min(1.16,factor))));
  }
  function feeRate(s){
    if(!s||!s.agent||!s.agentProfile)return 0;var cfg=agentConfig(s);if(!cfg)return 0;
    var savedRate=finiteAgentNumber(s.agentProfile.customFeeRate==null?cfg.feeRate:s.agentProfile.customFeeRate);
    if(savedRate===null||savedRate===0)savedRate=cfg.feeRate;
    return Math.max(.02,Math.min(.14,savedRate));
  }
  function chargeFee(s,reason,gross){
    if(!s||!s.agent||!s.agentProfile)return 0;
    ensureFeeDebtLedger(s);
    var base=safeWholeAmount(gross);if(!base)return 0;
    var requested=Math.max(1,Math.round(base*feeRate(s))),available=safeWholeAmount(s.money),paid=Math.min(available,requested);
    s.money=available-paid;
    if(paid<requested){appendFeeDebt(s,requested-paid,reason);addTrust(s,-2);}else addTrust(s,1);
    var cfg=agentConfig(s)||LEGACY_AGENT;
    record(s,"أتعاب "+cfg.name,"دفع الوكيل مقابل خدمة "+safeAgentText(reason,"تمثيل")+" أتعابًا قدرها "+paid+" جنيه داخل اللعبة"+(paid<requested?"، والمتبقي المسجل "+(requested-paid)+" جنيه.":"."));
    return paid;
  }
  function afterNegotiation(s,result){
    if(!s||!s.agent||!s.agentProfile||!result)return {fee:0,wage:safeAgentNumber(s&&s.weeklyWage,0)};
    if(result.status!=="success"){addTrust(s,-3);return {fee:0,wage:safeAgentNumber(s.weeklyWage,0)};}
    var old=Math.max(0,safeAgentNumber(result.oldWage,0)),raw=Math.max(old,safeAgentNumber(result.wage,safeAgentNumber(s.weeklyWage,old))||old),gain=Math.max(0,raw-old),bonus=profileValue(s,"negotiationRaiseBonus",0);
    var wage=Math.max(old,Math.round(raw+gain*bonus));s.weeklyWage=wage;result.wage=wage;addTrust(s,5);
    var fee=chargeFee(s,"مفاوضات المرتب",Math.max(0,wage-old)*5);
    return {fee:fee,wage:wage,bonus:bonus};
  }
  function onContractRenewal(s,offer){
    if(!s||!s.agent||!s.agentProfile)return 0;addTrust(s,4);
    return chargeFee(s,"تجديد العقد",Math.max(0,safeAgentNumber(offer&&offer.wage,safeAgentNumber(s.weeklyWage,0))));
  }
  function sponsorshipMultiplier(s){if(!s||!s.agent||!s.agentProfile)return 1;return Math.max(1,Math.min(1.45,1+profileValue(s,"sponsorshipBonus",.1)+(rel(s)-50)*.001));}
  function matchPayMultiplier(s){if(!s||!s.agent||!s.agentProfile)return 1;return Math.max(1,Math.min(1.15,1+profileValue(s,"matchPayBonus",.02)));}
  function dailyRecoveryBonus(s){return s&&s.agent&&s.agentProfile&&s.agentProfile.perks&&s.agentProfile.perks.recovery?3:0;}
  function renewRelationship(s,silent){
    if(!s||!s.agent||!s.agentProfile)return false;var cfg=agentConfig(s);if(!cfg)return false;
    var p=s.agentProfile,milestone=Math.floor(safeAgentNumber(s.apps,0)/5);if(milestone<=safeAgentNumber(p.lastPerformanceMilestone,0))return false;
    p.lastPerformanceMilestone=milestone;var rating=safeAgentNumber(s.lastRating,0),delta=rating>=7.5?3:rating>=6.5?1:rating>0?-2:0;
    if(delta)addTrust(s,delta);
    if(delta>=3)record(s,"ثقة الوكيل زادت","أداؤك الأخير خلّى "+cfg.name+" أكثر ثقة في خطتك.",silent);
    else if(delta<0)record(s,"الوكيل قلق من الأداء",cfg.name+" طلب منك تراجع مستواك وتحدد الخطوة الجاية.",silent);
    return true;
  }
  function currentAgentData(){return AGENTS.map(function(a){return {id:a.id,name:a.name,title:a.title,style:a.style,feeRate:a.feeRate,strength:a.strength,weakness:a.weakness};});}
  function handleAction(action,element){
    var api=API(),s=api&&api.getState();if(!s)return;ensureState(s);
    var id=element&&element.getAttribute("data-agent-id")||selectedAgentId;
    if(action==="close"){closeDialog();return;}
    if(action==="agent-meet"){openMeeting(id);return;}
    if(action==="agent-active"){openActive();return;}
    if(action==="agent-counter"){return negotiateFee(id);}
    if(action==="agent-sign"){return signAgent(id,quotedFeeRate,false);}
    if(action==="agent-switch-sign"){return switchAgent(id);}
    if(action==="agent-story"){openActive();return;}
    if(action==="agent-story-choice"){return finishStory(safeAgentNumber(element.getAttribute("data-choice-index"),-1));}
    if(action==="agent-end-current"){endCurrent();return;}
    if(action==="agent-confirm-end"){return confirmEnd();}
  }
  function cloneAgentMaintenancePreview(state){
    if(!state||typeof state!=="object")return null;
    var keys=[];
    try{keys=Object.keys(state);}catch(_){return null;}
    var preview={};
    for(var i=0;i<keys.length;i++){
      var key=keys[i],value=safeAgentField(state,key);
      // Display-only lead and descriptor-normalized history/debt containers stay by reference
      // until ensureState can sanitize them without cloning hostile proxies or accessors.
      if(key==="agentLead"||key==="agentHistory"||key==="agentFeeDebtLedger"||!value||typeof value!=="object"||key.indexOf("agent")!==0){
        Object.defineProperty(preview,key,{value:value,enumerable:true,writable:true,configurable:true});
        continue;
      }
      var cloned=clonePostRetirementMutationState(value);
      if(!cloned)return null;
      Object.defineProperty(preview,key,{value:cloned,enumerable:true,writable:true,configurable:true});
    }
    return preview;
  }
  function tick(force){
    var api=API();if(!api)return;var s=api.getState();if(!s)return;
    if(agentContractMutationPending||postRetirementMutationPending)return;
    var rawDebtLedger=safeAgentField(s,"agentFeeDebtLedger");
    var debtLedgerInspection=inspectAgentArrayData(rawDebtLedger);
    var hasDebtLedger=rawDebtLedger!=null&&(!debtLedgerInspection
      ||debtLedgerInspection.changed||debtLedgerInspection.values.length>0);
    var rawHistory=safeAgentField(s,"agentHistory");
    var historyInspection=inspectAgentArrayData(rawHistory);
    var hasHistory=rawHistory!=null&&(!historyInspection
      ||historyInspection.changed||historyInspection.values.length>0);
    var hasAgentState=!!s.agent||!!(s.agentProfile&&typeof s.agentProfile==="object")
      ||hasHistory||hasDebtLedger||!!s.agentNegotiationQuote
      ||safeAgentNumber(s.agentFeeDebtSequence,0)>0||safeAgentNumber(s.agentDebtPaid,0)>0
      ||safeAgentNumber(s.agentCommissionPaid,0)>0;
    if(hasAgentState){
      var preview=cloneAgentMaintenancePreview(s);if(!preview)return;
      var changed=ensureState(preview);
      if(preview.agent&&renewRelationship(preview,true))changed=true;
      if(changed){
        return runAgentContractMutation(s,function(){
          ensureState(s);
          if(s.agent)renewRelationship(s,false);
          return true;
        },null,{renderOnSuccess:false,renderOnFailure:true}).then(function(result){
          if(result.ok)scheduleTick(force);
          return result;
        });
      }
    }
    var p=s.agentProfile||null,history=safeAgentHistoryRows(rawHistory),latest=history.length?history[history.length-1]:null;
    var lead=!!safeAgentField(s,"agentLead");
    var perks=p&&p.perks&&typeof p.perks==="object"?Object.keys(p.perks).sort().map(function(key){return key+":"+safeAgentText(p.perks[key],"");}).join(","):"";
    var snapshot=[
      s.careerStarted,s.agent,lead,s.retired,
      p&&p.id,p&&p.relationship,p&&p.storyStage,p&&p.customFeeRate,p&&p.strategyOverride,
      p&&p.contractMultiplierDelta,p&&p.negotiationRaiseBonusDelta,p&&p.feeDebt,
      agentFeeDebtLedgerSnapshot(s),s.agentDebtPaid,s.agentDebtLastPayrollDay,perks,
      s.agentNegotiationQuote&&JSON.stringify(s.agentNegotiationQuote),
      s.apps,s.season,s.seasonFinished,s.money,s.weeklyWage,
      history.length,latest&&latest.title,latest&&latest.day,latest&&latest.season
    ].map(function(value){return safeAgentText(value,"");}).join("|");
    var ready=ensurePanel();
    if(ready&&(force||snapshot!==lastSnapshot||!panelWasRendered)){
      if(!document.hidden){renderPanel(s);panelWasRendered=true;}
      else panelWasRendered=false;
    }else if(!ready){
      panelWasRendered=false;
    }
    lastSnapshot=snapshot;
  }
  function scheduleTick(force){
    tickForceQueued=tickForceQueued||!!force;
    if(tickScheduled)return;
    tickScheduled=true;
    Promise.resolve().then(function(){
      tickScheduled=false;
      var shouldForce=tickForceQueued;tickForceQueued=false;
      tick(shouldForce);
    });
  }
  document.addEventListener("click",function(event){
    var b=event.target&&event.target.closest?event.target.closest("[data-lwag-action]"):null;
    if(!b||b.disabled)return;event.preventDefault();return handleAction(b.getAttribute("data-lwag-action")||"",b);
  });
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&overlay&&!overlay.hidden)closeDialog();});
  function start(){
    tick(true);
    var store=window.LWStateStore;
    if(store&&typeof store.subscribe==="function"){
      store.subscribe(function(){scheduleTick(false);});
      window.setInterval(function(){tick(false);},5000);
    }else{
      window.setInterval(function(){tick(false);},2500);
    }
    window.addEventListener("pageshow",function(){tick(true);});
    window.addEventListener("storage",function(){tick(true);});
    document.addEventListener("visibilitychange",function(){if(!document.hidden)tick(true);});
  }

  // Stage 2: post-retirement career paths. Actions are deterministic and persist in the career state.
  function postRetirementOptions(s){
    if(!s||!s.retired)return {available:false,reason:"لازم تعتزل الأول."};
    var wealth=safeWholeAmount(s.money),fame=Math.max(0,safeAgentNumber(s.mediaReputation,0));
    return {
      available:true,
      agent:{available:wealth>=250000,minimumCapital:250000,networkScore:Math.round(Math.min(100,fame*.55+wealth/500000))},
      clubOwner:{available:wealth>=5000000,minimumCapital:5000000,requiredShare:51,academyBudget:Math.round(wealth*.08)}
    };
  }
  var postRetirementMutationPending = false;

  function acquireSharedMutationLock(owner) {
    var coordinator = window.__LW_DURABLE_MUTATION_LOCK__;
    if (!coordinator || typeof coordinator !== "object") {
      coordinator = { owner: "", queue: [] };
      window.__LW_DURABLE_MUTATION_LOCK__ = coordinator;
    }
    if (!Array.isArray(coordinator.queue)) coordinator.queue = [];
    owner = safeAgentText(owner,"");
    if (!owner) return false;
    if (!coordinator.owner) {
      coordinator.owner = owner;
      return true;
    }
    return new Promise(function(resolve) { coordinator.queue.push({ owner: owner, resolve: resolve }); });
  }
  function releaseSharedMutationLock(owner) {
    var coordinator = window.__LW_DURABLE_MUTATION_LOCK__;
    if (!coordinator || coordinator.owner !== owner) return;
    var next = Array.isArray(coordinator.queue) ? coordinator.queue.shift() : null;
    if (next && next.owner) {
      coordinator.owner = next.owner;
      next.resolve(true);
    } else {
      coordinator.owner = "";
    }
  }
  function clonePostRetirementMutationState(state){
    if(!state||typeof state!=="object")return null;
    try{if(typeof window.structuredClone==="function")return window.structuredClone(state);}catch(error){}
    try{return JSON.parse(JSON.stringify(state));}catch(error){return null;}
  }
  function safeAgentLedgerSnapshotScalar(value,fallback){
    if(value===null||typeof value==="string"||typeof value==="boolean"
      ||(typeof value==="number"&&Number.isFinite(value)))return value;
    return fallback;
  }
  function cloneAgentDebtLedgerForSnapshot(value){
    var inspected=inspectAgentArrayData(value);
    if(!inspected)return [];
    var rows=[];
    for(var i=0;i<inspected.values.length;i++){
      var raw=inspected.values[i];
      if(!raw||typeof raw!=="object")continue;
      var rawId=safeAgentField(raw,"id"),rawAgentId=safeAgentField(raw,"agentId");
      var rawAgentName=safeAgentField(raw,"agentName"),rawReason=safeAgentField(raw,"reason");
      var rawAmount=safeAgentField(raw,"amount"),rawPaid=safeAgentField(raw,"paid");
      var rawOutstanding=safeAgentField(raw,"outstanding");
      var rawSeason=safeAgentField(raw,"createdSeason"),rawDay=safeAgentField(raw,"createdDay");
      if(rawId===undefined&&rawAgentId===undefined&&rawAgentName===undefined&&rawReason===undefined
        &&rawAmount===undefined&&rawPaid===undefined&&rawOutstanding===undefined
        &&rawSeason===undefined&&rawDay===undefined)continue;
      var agentId=safeAgentText(rawAgentId,"legacy");
      rows.push({
        id:safeAgentText(rawId,""),
        agentId:agentId||"legacy",
        agentName:safeAgentText(rawAgentName,"وكيل سابق"),
        reason:safeAgentText(rawReason,"أتعاب وكالة غير مسددة"),
        amount:safeAgentLedgerSnapshotScalar(rawAmount,0),
        paid:safeAgentLedgerSnapshotScalar(rawPaid,0),
        outstanding:rawOutstanding==null?null:safeAgentLedgerSnapshotScalar(rawOutstanding,0),
        createdSeason:safeAgentLedgerSnapshotScalar(rawSeason,1),
        createdDay:safeAgentLedgerSnapshotScalar(rawDay,1)
      });
    }
    return rows;
  }
  function cloneAgentContractMutationSnapshot(state){
    var preview=cloneAgentMaintenancePreview(state);
    if(!preview)return null;
    var hasLead=Object.prototype.hasOwnProperty.call(preview,"agentLead");
    var leadValue=safeAgentField(preview,"agentLead");
    if(hasLead)delete preview.agentLead;
    var rawHistory=safeAgentField(preview,"agentHistory");
    if(rawHistory!=null)preview.agentHistory=safeAgentHistoryRows(rawHistory);
    var rawLedger=safeAgentField(preview,"agentFeeDebtLedger");
    if(rawLedger!=null)preview.agentFeeDebtLedger=cloneAgentDebtLedgerForSnapshot(rawLedger);
    var snapshot=clonePostRetirementMutationState(preview);
    if(!snapshot)return null;
    if(hasLead)Object.defineProperty(snapshot,"agentLead",{value:leadValue,enumerable:true,writable:true,configurable:true});
    return snapshot;
  }
  function restorePostRetirementMutationState(target,snapshot){
    if(!target||!snapshot||typeof snapshot!=="object")throw new Error("invalid-retirement-snapshot");
    Object.keys(target).forEach(function(key){if(!Object.prototype.hasOwnProperty.call(snapshot,key))delete target[key];});
    Object.keys(snapshot).forEach(function(key){target[key]=snapshot[key];});
  }
  async function flushPostRetirementMutation(api,state){
    var queued=api.save();
    if(queued&&typeof queued.then==="function")queued=await queued;
    if(queued===false)return false;
    var pending;
    if(typeof window.flushQueuedSave==="function")pending=window.flushQueuedSave({backupFirst:true});
    else if(window.LWStateStore&&typeof window.LWStateStore.flush==="function")pending=window.LWStateStore.flush(state);
    else return false;
    return await Promise.resolve(pending)===true;
  }
  var agentContractMutationPending = false;
  async function runAgentContractMutation(state,operation,successMessage,options){
    options=options||{};
    var renderOnSuccess=options.renderOnSuccess!==false;
    var renderOnFailure=options.renderOnFailure!==false;
    var api=API();
    if(agentContractMutationPending||postRetirementMutationPending){
      if(api&&api.toast)api.toast("فيه تغيير تاني بيتحفظ دلوقتي. استنى تأكيد الحفظ.");
      return {ok:false,reason:"agent-mutation-pending"};
    }
    if(!state||typeof operation!=="function"||!api||typeof api.save!=="function")
      return {ok:false,reason:"agent-mutation-unavailable"};
    agentContractMutationPending=true;
    var mutationLock = acquireSharedMutationLock("agent-system");
    if (mutationLock && typeof mutationLock.then === "function") await mutationLock;
    var snapshot=cloneAgentContractMutationSnapshot(state);
    if(!snapshot){
      agentContractMutationPending=false;
      releaseSharedMutationLock("agent-system");
      return {ok:false,reason:"تعذر تأمين بيانات الاتفاق قبل التغيير."};
    }
    var payload=null;
    try{
      payload=operation();
      if(payload===false||payload==null)throw new Error("agent contract mutation rejected");
      if(!(await flushPostRetirementMutation(api,state)))throw new Error("agent contract save not confirmed");
    }catch(error){
      try{restorePostRetirementMutationState(state,snapshot);}
      catch(restoreError){
        try{if(api.toast)api.toast("تعذر استعادة اتفاق الوكيل. أوقف اللعب وصدّر نسخة احتياطية قبل المتابعة.");}catch(toastError){}
        if(renderOnFailure){
          try{if(api.render)api.render();}catch(renderError){}
          try{if(typeof renderPanel==="function")renderPanel(state);}catch(panelError){}
        }
        return {ok:false,reason:"agent-rollback-restore-failed",rollbackPersisted:false};
      }
      var rollbackPersisted=false;
      try{rollbackPersisted=await flushPostRetirementMutation(api,state)===true;}
      catch(rollbackError){if(window.console&&window.console.warn)window.console.warn("Agent contract rollback persistence failed",rollbackError);}
      if(renderOnFailure){
        try{if(api.render)api.render();}catch(renderError){}
        try{if(typeof renderPanel==="function")renderPanel(state);}catch(panelError){}
      }
      var message=rollbackPersisted
        ?"تعذر حفظ تغيير الوكيل؛ تمت استعادة الاتفاق السابق وحفظه. تقدر تحاول مرة تانية."
        :"تمت استعادة الاتفاق داخل اللعبة، لكن تعذر تأكيد حفظ النسخة السابقة. صدّر نسخة احتياطية قبل المتابعة.";
      try{if(api.toast)api.toast(message);}catch(toastError){}
      if(window.console&&window.console.warn)window.console.warn("Agent contract mutation rolled back",error);
      return {ok:false,reason:message,rollbackPersisted:rollbackPersisted};
    }finally{
      agentContractMutationPending=false;
      releaseSharedMutationLock("agent-system");
    }
    if(renderOnSuccess){
      try{if(api.render)api.render();}catch(renderError){}
      try{if(typeof renderPanel==="function")renderPanel(state);}catch(panelError){}
    }
    try{if(successMessage&&api.toast)api.toast(successMessage);}catch(toastError){}
    return Object.assign({ok:true},payload&&typeof payload==="object"?payload:{});
  }
  async function runPostRetirementMutation(state,operation){
    if(postRetirementMutationPending||agentContractMutationPending)return {ok:false,reason:"فيه عملية وكيل تانية بيتحفظ بالفعل. استنى تأكيد الحفظ."};
    if(!state||typeof operation!=="function")return {ok:false,reason:"بيانات مسار ما بعد الاعتزال غير متاحة."};
    var api=API();
    if(!api||typeof api.save!=="function")return {ok:false,reason:"الحفظ غير متاح؛ لم يتم تنفيذ العملية."};
    postRetirementMutationPending=true;
    var mutationLock = acquireSharedMutationLock("agent-system");
    if (mutationLock && typeof mutationLock.then === "function") await mutationLock;
    var snapshot=clonePostRetirementMutationState(state);
    if(!snapshot){
      postRetirementMutationPending=false;
      releaseSharedMutationLock("agent-system");
      return {ok:false,reason:"تعذر تأمين بيانات المسيرة قبل العملية؛ لم يتم خصم أي أموال."};
    }
    var payload=null;
    try{
      payload=operation();
      if(payload===false||payload==null)throw new Error("retirement mutation rejected");
      if(!(await flushPostRetirementMutation(api,state)))throw new Error("durable save not confirmed");
    }catch(error){
      try{restorePostRetirementMutationState(state,snapshot);}
      catch(restoreError){
        try{if(api.toast)api.toast("تعذر استعادة بيانات ما بعد الاعتزال. أوقف اللعب وصدّر نسخة احتياطية قبل المتابعة.");}catch(toastError){}
        try{if(api.render)api.render();}catch(renderError){}
        return {ok:false,reason:"تعذر استعادة بيانات المسيرة.",rollbackPersisted:false};
      }
      var rollbackPersisted=false;
      try{rollbackPersisted=await flushPostRetirementMutation(api,state)===true;}
      catch(rollbackError){if(window.console&&window.console.warn)window.console.warn("Post-retirement rollback persistence failed",rollbackError);}
      try{if(api.render)api.render();}catch(renderError){if(window.console&&window.console.warn)window.console.warn("Post-retirement rollback render failed",renderError);}
      var message=rollbackPersisted
        ?"تعذر حفظ العملية؛ تمت استعادة بيانات المسيرة وحفظ النسخة السابقة. تقدر تحاول مرة تانية."
        :"تمت استعادة بيانات المسيرة داخل اللعبة، لكن تعذر تأكيد حفظ النسخة. صدّر نسخة احتياطية قبل المتابعة.";
      try{if(api.toast)api.toast(message);}catch(toastError){}
      if(window.console&&window.console.warn)window.console.warn("Post-retirement mutation rolled back",error);
      return {ok:false,reason:message,rollbackPersisted:rollbackPersisted};
    }finally{
      postRetirementMutationPending=false;
      releaseSharedMutationLock("agent-system");
    }
    try{if(api.render)api.render();}
    catch(renderError){try{if(api.toast)api.toast("تم حفظ العملية، لكن تعذر تحديث الواجهة. افتح المسار مرة أخرى.");}catch(toastError){}}
    return Object.assign({ok:true},payload&&typeof payload==="object"?payload:{});
  }
  async function startPostRetirementAgency(s,capital){
    if(!s||!s.retired)return {ok:false,reason:"لازم تعتزل الأول."};
    if(s.retirementCareer)return {ok:false,reason:"مسار ما بعد الاعتزال بدأ بالفعل؛ لا يمكن استبداله وفقدان سجله."};
    var options=postRetirementOptions(s),rawAmount=capital==null?250000:finiteAgentNumber(capital);
    if(rawAmount===0)rawAmount=250000;
    if(!Number.isFinite(rawAmount))return {ok:false,reason:"قيمة رأس المال غير صالحة."};
    var amount=Math.round(rawAmount),available=safeWholeAmount(s.money);
    if(!options.available||!options.agent.available||!Number.isSafeInteger(amount)||amount<250000||amount>available)return {ok:false,reason:"رأس المال غير كافٍ أو المسيرة لم تنتهِ."};
    return runPostRetirementMutation(s,function(){
      s.money=available-amount;
      s.retirementCareer={type:"agency",capital:amount,players:[],reputation:Math.round(Math.min(100,safeAgentNumber(s.mediaReputation,0)*.55+amount/500000)),season:safeAgentNumber(s.season,1)||1,history:[]};
      s.retirementCareer.history.push({type:"founded",season:s.retirementCareer.season,capital:amount});
      return {career:s.retirementCareer};
    });
  }
  async function acquireClubControl(s,club,clubValue,share){
    if(!s||!s.retired)return {ok:false,reason:"لازم تعتزل الأول."};
    if(s.retirementCareer)return {ok:false,reason:"مسار ما بعد الاعتزال بدأ بالفعل؛ لا يمكن استبداله وفقدان سجله."};
    var options=postRetirementOptions(s),clubName=safeAgentText(club,"").trim(),rawValue=finiteAgentNumber(clubValue);
    if(!options.available||!options.clubOwner.available||!clubName||!Number.isFinite(rawValue)||rawValue<=0)return {ok:false,reason:"قيمة النادي أو بيانات الملكية غير صالحة."};
    var rawShare=share==null?51:finiteAgentNumber(share);
    if(rawShare===null)return {ok:false,reason:"نسبة الملكية غير صالحة."};
    var value=Math.ceil(rawValue),portion=Math.max(51,Math.min(100,rawShare||51));
    var cost=Math.ceil(value*portion/100),available=safeWholeAmount(s.money);
    if(!Number.isSafeInteger(value)||!Number.isSafeInteger(cost)||cost<=0||cost>available)return {ok:false,reason:"لا يمكن شراء حصة حاكمة بهذه الميزانية."};
    return runPostRetirementMutation(s,function(){
      s.money=available-cost;
      s.retirementCareer={type:"club-owner",club:clubName,share:portion,investment:cost,academyBudget:Math.round(cost*.08),season:safeAgentNumber(s.season,1)||1,history:[{type:"acquisition",club:clubName,share:portion,cost:cost}]};
      return {career:s.retirementCareer};
    });
  }
  async function registerAgencyPlayer(s,player){
    if(!s||!s.retired||!s.retirementCareer||s.retirementCareer.type!=="agency"||!player||player.id==null)return {ok:false,reason:"مسار الوكالة غير متاح أو بيانات اللاعب ناقصة."};
    var playerId=safeAgentId(player.id,"");
    if(!playerId)return {ok:false,reason:"معرّف اللاعب غير صالح."};
    var career=s.retirementCareer,players=Array.isArray(career.players)?career.players:[];
    if(players.some(function(p){return safeAgentId(p&&p.id,"")===playerId;}))return {ok:false,reason:"اللاعب مسجل بالفعل."};
    return runPostRetirementMutation(s,function(){
      var current=s.retirementCareer;
      current.players=Array.isArray(current.players)?current.players:[];
      if(current.players.some(function(p){return safeAgentId(p&&p.id,"")===playerId;}))return false;
      var registered={id:playerId,name:safeAgentText(player.name,"لاعب جديد"),club:safeAgentText(player.club,""),joinedSeason:safeAgentNumber(s.season,1)||1,appearancesAtSigning:Math.max(0,safeAgentNumber(player.appearances,0))};
      current.players.push(registered);
      current.reputation=Math.min(100,safeAgentNumber(current.reputation,0)+1);
      current.history=Array.isArray(current.history)?current.history:[];
      current.history.unshift({type:"player-signed",playerId:playerId,season:safeAgentNumber(s.season,1)||1});
      return {career:current,player:registered};
    });
  }

  window.LWAgentRuntime={getAgents:currentAgentData,ensureState:ensureState,current:current,contractTerms:contractTerms,
    negotiationChanceBonus:negotiationChanceBonus,transferOfferChance:transferOfferChance,prioritizeTargets:prioritizeTargets,
    adjustTransferWage:adjustTransferWage,chargeFee:chargeFee,commissionRate:feeRate,
    outstandingFeeDebt:outstandingFeeDebt,collectDebtFromPayroll:collectDebtFromPayroll,
    afterNegotiation:afterNegotiation,onContractRenewal:onContractRenewal,
    sponsorshipMultiplier:sponsorshipMultiplier,matchPayMultiplier:matchPayMultiplier,dailyRecoveryBonus:dailyRecoveryBonus,
    currentChapter:currentChapter,chapterProgress:progress,
    postRetirementOptions:postRetirementOptions,startPostRetirementAgency:startPostRetirementAgency,
    acquireClubControl:acquireClubControl,registerAgencyPlayer:registerAgencyPlayer};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
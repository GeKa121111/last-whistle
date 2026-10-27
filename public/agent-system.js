(function () {
  "use strict";
  var API = function(){return window.LWStoryRuntime||null;};
  var panel=null, overlay=null, selectedAgentId="", quotedFeeRate=null, lastSnapshot="";

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

  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];});}
  function cap(v,min,max){return Math.max(min,Math.min(max,Math.round(Number(v)||0)));}
  function agentConfig(s){var p=s&&s.agentProfile;return p&&BY_ID[p.id]?BY_ID[p.id]:null;}
  function randomUnit(s){
    var x=(Number(s.randomSeed)>>>0)||0x6d2b79f5;x=(x+0x6d2b79f5)>>>0;s.randomSeed=x;
    var t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  function boundedStat(s,key,delta){
    var bounded=["energy","morale","trust","fatigue","professionalism","mediaReputation","teamChemistry","coachRelationship","playerPotential","fitness","confidence"];
    var next=(Number(s[key])||0)+Number(delta||0);
    if(bounded.indexOf(key)>=0)s[key]=cap(next,0,100);
    else if(key==="money"||key==="followers"||key==="injuryDays")s[key]=Math.max(0,Math.round(next));
    else s[key]=next;
  }
  function ensureProfileShape(p,s){
    p.relationship=cap(p.relationship==null?52:p.relationship,0,100);
    p.feeRate=Math.max(.02,Math.min(.14,Number(p.feeRate)||.06));
    p.customFeeRate=p.customFeeRate==null?null:Math.max(.02,Math.min(.14,Number(p.customFeeRate)));
    p.storyStage=cap(p.storyStage||0,0,2);
    p.hiredSeason=Math.max(1,Number(p.hiredSeason)||Number(s.season)||1);
    // Migrate old fixed-term saves to an open-ended representation contract.
    p.contractMode="open-ended";
    p.expiresSeason=null;
    p.signedApps=Math.max(0,Number(p.signedApps)||0);
    p.lastChapterApps=Math.max(p.signedApps,Number(p.lastChapterApps)||p.signedApps);
    p.lastChapterSeason=Math.max(p.hiredSeason,Number(p.lastChapterSeason)||p.hiredSeason);
    p.lastPerformanceMilestone=Math.max(0,Number(p.lastPerformanceMilestone)||Math.floor((Number(s.apps)||0)/5));
    p.strategyOverride=String(p.strategyOverride||"");
    p.perks=p.perks&&typeof p.perks==="object"?p.perks:{};
    p.feeDebt=Math.max(0,Number(p.feeDebt)||0);
    return p;
  }
  function makeProfile(id,s,legacy){
    var a=BY_ID[id]||LEGACY_AGENT;
    return ensureProfileShape({id:a.id,name:a.name,title:a.title,mark:a.mark,feeRate:a.feeRate,customFeeRate:null,relationship:52,
      contractMode:"open-ended",hiredSeason:Number(s.season)||1,expiresSeason:null,signedDay:Number(s.day)||1,signedApps:Number(s.apps)||0,
      lastChapterApps:Number(s.apps)||0,lastChapterSeason:Number(s.season)||1,lastPerformanceMilestone:Math.floor((Number(s.apps)||0)/5),
      storyStage:0,strategyOverride:"",perks:{},feeDebt:0,legacyMigrated:!!legacy,contractMultiplierDelta:0,negotiationRaiseBonusDelta:0},s);
  }
  function current(s){return s&&s.agent&&s.agentProfile&&BY_ID[s.agentProfile.id]?BY_ID[s.agentProfile.id]:null;}
  function ensureState(s){
    if(!s||typeof s!=="object")return false;
    var changed=false;
    if(!Array.isArray(s.agentHistory)){s.agentHistory=[];changed=true;}
    if(s.agent&&(!s.agentProfile||!BY_ID[s.agentProfile.id])){s.agentProfile=makeProfile("legacy",s,true);changed=true;}
    if(s.agentProfile&&BY_ID[s.agentProfile.id]){
      var oldContractMode=s.agentProfile.contractMode,oldExpiresSeason=s.agentProfile.expiresSeason;
      ensureProfileShape(s.agentProfile,s);
      if(oldContractMode!=="open-ended"||oldExpiresSeason!=null)changed=true;
      if(!s.agent){s.agent=true;changed=true;}
    }else if(!s.agent){s.agentProfile=null;}
    return changed;
  }
  function record(s,title,text){
    if(!Array.isArray(s.agentHistory))s.agentHistory=[];
    var e={season:Number(s.season)||1,day:Number(s.day)||1,title:String(title||"حدث مع الوكيل"),text:String(text||"")};
    s.agentHistory.unshift(e);s.agentHistory=s.agentHistory.slice(0,40);
    var api=API();if(api&&api.log)api.log(e.title+": "+e.text);
  }
  function save(s,message){
    var api=API();if(api&&api.save)api.save();if(api&&api.render)api.render();renderPanel(s);
    if(message&&api&&api.toast)api.toast(message);
  }
  function rel(s){return s&&s.agentProfile?cap(s.agentProfile.relationship,0,100):50;}
  function canUseAgent(s){return !!(s&&s.careerStarted&&!s.retired);}
  function currentChapter(s){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p||p.storyStage>=cfg.chapters.length)return null;
    var stage=Number(p.storyStage)||0,apps=Number(s.apps)||0;
    var ready=stage===0?(apps-Number(p.signedApps||0)>=3||!!s.seasonFinished):(apps-Number(p.lastChapterApps||0)>=4||Number(s.season)>Number(p.lastChapterSeason||0));
    return ready?cfg.chapters[stage]:null;
  }
  function progress(s){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return {stage:0,total:2,ready:false,remaining:0,complete:false};
    var stage=Math.min(cfg.chapters.length,Number(p.storyStage)||0),apps=Number(s.apps)||0;
    var need=stage===0?Math.max(0,3-(apps-Number(p.signedApps||0))):stage===1?Math.max(0,4-(apps-Number(p.lastChapterApps||0))):0;
    return {stage:stage,total:cfg.chapters.length,ready:!!currentChapter(s),remaining:need,complete:stage>=cfg.chapters.length};
  }
  function addTrust(s,delta){if(s.agentProfile)s.agentProfile.relationship=cap(Number(s.agentProfile.relationship||0)+Number(delta||0),0,100);}

  function ensurePanel(){
    panel=document.getElementById("lwa-agent-system");if(panel)return true;
    var grid=document.querySelector("#page-contract .grid");if(!grid)return false;
    panel=document.createElement("section");panel.id="lwa-agent-system";panel.className="lwa-agent-panel";panel.setAttribute("aria-labelledby","lwa-title");
    panel.innerHTML=
      '<div class="lwa-header"><div><div class="lwa-eyebrow"><span class="lwa-dot"></span> REPRESENTATION / PLAYER CAREER</div><h2 id="lwa-title">وكلاء أعمالك… كل واحد بطريقته</h2><p>اختار الشخصية اللي تناسب طموحك. قصته مش ديكور؛ أسلوبه هيأثر على التفاوض، نوعية عروض الانتقال، الرعاية، وتكاليف قراراتك.</p></div><div class="lwa-header-mark">AGENT<br>NETWORK</div></div>'+
      '<div id="lwa-current-summary" class="lwa-current-summary"></div>'+
      '<div class="lwa-market-head"><div><span class="lwa-market-kicker">THE AGENT MARKET</span><h3>قابل الوكلاء واسمع قصصهم</h3></div><span id="lwa-agent-count" class="lwa-count">6 شخصيات</span></div>'+
      '<div id="lwa-agent-cards" class="lwa-agent-grid"></div>'+
      '<div class="lwa-history-wrap"><div class="lwa-history-head"><strong>سجل علاقتك بالوكلاء</strong><span id="lwa-history-count">0 حدث</span></div><div id="lwa-agent-history" class="lwa-agent-history"></div></div>'+
      '<div class="lwa-agent-disclaimer">كل الأسماء والقصص شخصيات خيالية داخل Last Whistle. الأتعاب محسوبة من مكافآت اللعبة وخدمات التفاوض فقط، والانتقال النهائي يظل بقرارك من سوق الانتقالات.</div>';
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
    var cfg=agentConfig(s),p=s.agentProfile,pr=p?progress(s):null,summary=document.getElementById("lwa-current-summary"),cards=document.getElementById("lwa-agent-cards");
    if(summary){
      if(cfg&&p){
        var r=rel(s),label=r>=75?"ثقة قوية":r>=50?"علاقة مستقرة":r>=30?"علاقة متوترة":"علاقة على المحك";
        summary.innerHTML='<div class="lwa-current-left"><div class="lwa-current-label">CURRENT REPRESENTATIVE</div><h3>'+esc(cfg.name)+' <span>· '+esc(cfg.title)+'</span></h3><p>'+esc(cfg.voice)+'</p>'+
          '<div class="lwa-rel-row"><span>'+label+'</span><b>'+r+'/100</b></div><div class="lwa-rel-bar"><i style="width:'+r+'%"></i></div>'+
          '<div class="lwa-current-meta"><span>مستمر حتى فسخك له</span><span>'+Math.round(Number(p.customFeeRate==null?p.feeRate:p.customFeeRate)*100)+'% أتعاب</span><span>تقدر تنهيه أو تغيّره وقت ما تحب</span></div></div>'+
          '<div class="lwa-current-right"><div class="lwa-arc-mark">'+(pr.complete?"✓":(pr.stage+1)+"/"+pr.total)+'</div><strong>'+(pr.complete?"قصة مكتملة":pr.ready?"فصل جديد جاهز":"القصة مستمرة")+'</strong><p>'+(pr.complete?"خلصت الفصول الأساسية مع الوكيل.":pr.ready?"فيه موقف جديد مستني قرارك.":"العب "+pr.remaining+" مشاركة إضافية عشان تفتح الفصل التالي.")+'</p><button type="button" class="lwa-agent-action lwa-agent-action-light" data-lwag-action="agent-story">'+(pr.ready?"افتح الفصل الجديد":"راجع قصتنا")+' <b aria-hidden="true">←</b></button></div>';
      }else{
        summary.innerHTML='<div class="lwa-current-left"><div class="lwa-current-label">NO ACTIVE REPRESENTATIVE</div><h3>'+(s.agentLead?"وصلت لمرحلة اختيار الوكيل":"مسيرتك لسه من غير وكيل أعمال")+'</h3><p>'+(s.agentLead?"قابل الوكلاء، اسمع طريقتهم وشروطهم، واختار اللي يخدم خطتك. فتح باب التمثيل مش معناه إنك مضطر توقّع.":"مش لازم توقّع من أول يوم. تقدر تبدأ من غير وكيل، وبعدها تختار شخصًا مناسبًا لما تكون مستعدًا.")+'</p></div><div class="lwa-current-right"><div class="lwa-arc-mark">06</div><strong>ست طرق مختلفة</strong><p>الاستقرار، الشهرة، الانتقالات، التفاوض، السرعة، أو الخطة الطويلة.</p></div>';
      }
    }
    if(cards)cards.innerHTML=AGENTS.map(function(a){return renderCard(a,p&&s.agent?p.id:"");}).join("");
    var rows=Array.isArray(s.agentHistory)?s.agentHistory.slice(0,4):[],hist=document.getElementById("lwa-agent-history"),count=document.getElementById("lwa-history-count");
    if(count)count.textContent=(Array.isArray(s.agentHistory)?s.agentHistory.length:0)+" حدث";
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
  function candidate(id){return BY_ID[id]&&id!=="legacy"?BY_ID[id]:null;}
  function meetingBody(a,s,fee){
    var rate=fee==null?a.feeRate:fee;
    return '<div class="lwa-meeting-card"><div class="lwa-meeting-card-top"><span class="lwa-agent-monogram">'+esc(a.mark)+'</span><div><span class="lwa-market-kicker">'+esc(a.title)+'</span><h3>'+esc(a.name)+'</h3><p>'+esc(a.style)+'</p></div></div><div class="lwa-meeting-quote">«'+esc(a.pitch)+'»</div><p class="lwa-meeting-story">'+esc(a.origin)+'</p><div class="lwa-meeting-terms"><div><small>عمولة الوكيل</small><strong>'+Math.round(rate*100)+'%</strong><span>من مكافأة الانتقال أو خدمة تفاوض داخل اللعبة</span></div><div><small>مدة التمثيل</small><strong>مفتوح</strong><span>يستمر لحد ما تختار تنهي الاتفاق</span></div></div><div class="lwa-agent-tradeoffs"><div><small>نقطة القوة</small><p>'+esc(a.strength)+'</p></div><div><small>المقابل</small><p>'+esc(a.weakness)+'</p></div></div></div>';
  }
  function openMeeting(id){
    var s=API().getState();if(!canUseAgent(s)){API().toast(s&&s.retired?"المسيرة انتهت بالاعتزال.":"ابدأ مسيرتك الأول علشان تقابل الوكلاء.");return;}
    var a=candidate(id);if(!a)return;
    if(s.agent&&s.agentProfile&&s.agentProfile.id===id){openActive();return;}
    selectedAgentId=id;quotedFeeRate=a.feeRate;
    if(s.agent&&s.agentProfile){
      var old=agentConfig(s)||LEGACY_AGENT,exitFee=Math.max(20,Math.round((Number(s.weeklyWage)||250)*Number(old.exitFeeWeeks||.25)));
      frame("قبل ما تغيّر وكيلك","CHANGE REPRESENTATIVE",meetingBody(a,s,quotedFeeRate)+'<div class="lwa-change-notice"><strong>إنهاء الاتفاق الحالي</strong><p>هتدفع '+exitFee+' جنيه داخل اللعبة كشرط خروج من '+esc(old.name)+'. بعدها يبدأ اتفاق جديد مفتوح المدة مع '+esc(a.name)+'.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-switch-sign" data-agent-id="'+esc(id)+'"'+(Number(s.money)<exitFee?" disabled":"")+'>أدفع شرط الخروج وأوقّع</button><button type="button" class="lwa-button" data-lwag-action="close">أرجع</button></div>',"تغيير الوكيل قرار داخل المسيرة. راجع العمولة والأسلوب قبل ما تلتزم.");
    }else{
      frame("مقابلة أولى مع "+a.name,"FIRST MEETING",meetingBody(a,s,quotedFeeRate)+'<p class="lwa-intro">اسمع عرضه، وبعدها اختار بين قبول الشروط أو التفاوض على عمولته. نجاح التفاوض مش مضمون.</p><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أوقّع الاتفاق</button><button type="button" class="lwa-button" data-lwag-action="agent-counter" data-agent-id="'+esc(id)+'">أفاوض على العمولة</button><button type="button" class="lwa-button" data-lwag-action="close">أفكر شوية</button></div>',"اتفاق التمثيل مستمر لحد ما تختار تنهيه. العمولة تُخصم من مكافآت اللعبة فقط، ولا يوجد دفع بفلوس حقيقية.");
    }
  }
  function negotiateFee(id){
    var s=API().getState(),a=candidate(id);if(!a||!canUseAgent(s))return;
    var skill=Number(s.professionalism)||0,rating=API().overall?Number(API().overall())||0:50;
    var chance=cap(54+(skill-50)*.28+(rating-60)*.22-a.counterDifficulty*12,18,86),won=randomUnit(s)*100<chance;
    if(won){
      quotedFeeRate=Math.max(.035,Math.round((a.feeRate-.015)*1000)/1000);
      record(s,"تفاوض أولي مع "+a.name,"نجحت في تخفيض العمولة المبدئية إلى "+Math.round(quotedFeeRate*100)+"%.");
      save(s);selectedAgentId=id;
      frame("المفاوضات جابت نتيجة","FEE NEGOTIATION",meetingBody(a,s,quotedFeeRate)+'<div class="lwa-result lwa-result-good"><strong>اتفقتم على عمولة أقل</strong><p>نزلت العمولة من '+Math.round(a.feeRate*100)+'% إلى '+Math.round(quotedFeeRate*100)+'%. الخطوة الجاية توقيع الاتفاق أو الرجوع للتفكير.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أوقّع على الشروط الجديدة</button><button type="button" class="lwa-button" data-lwag-action="close">مش دلوقتي</button></div>',"التخفيض ده محفوظ في الاتفاق الحالي لو وافقت على التوقيع.");
    }else{
      record(s,"تفاوض أولي مع "+a.name,"الوكيل رفض تخفيض العمولة المقترح. تقدر تقبل عرضه الأصلي أو تبحث عن وكيل آخر.");
      save(s);
      frame("الوكيل متمسك بشروطه","FEE NEGOTIATION",'<div class="lwa-result lwa-result-neutral"><strong>'+esc(a.name)+' رفض التخفيض</strong><p>'+esc(a.voice)+'</p><p>العمولة المعروضة ما زالت '+Math.round(a.feeRate*100)+'%. تقدر تقبل الاتفاق أو تنهي المقابلة.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-sign" data-agent-id="'+esc(id)+'">أقبل العمولة الأصلية</button><button type="button" class="lwa-button" data-lwag-action="close">أنهي المقابلة</button></div>');
    }
  }
  function signAgent(id,newFee,exitPaid){
    var s=API().getState(),a=candidate(id);if(!a||!canUseAgent(s))return;
    if(s.agent&&s.agentProfile&&s.agentProfile.id!==id&&!exitPaid){openMeeting(id);return;}
    var p=makeProfile(id,s,false);
    p.customFeeRate=Math.max(.035,Math.min(.14,Number(newFee)||a.feeRate));p.feeRate=a.feeRate;p.relationship=55;
    p.signedApps=Number(s.apps)||0;p.lastChapterApps=Number(s.apps)||0;p.lastChapterSeason=Number(s.season)||1;p.lastPerformanceMilestone=Math.floor((Number(s.apps)||0)/5);
    p.contractMultiplierDelta=0;p.negotiationRaiseBonusDelta=0;p.strategyOverride="";
    s.agentProfile=p;s.agent=true;s.agentLead=false;s.storyFlags=s.storyFlags&&typeof s.storyFlags==="object"?s.storyFlags:{};
    s.storyFlags["agent-offer"]=true;
    record(s,"توقيع اتفاق تمثيل مع "+a.name,"وقعت اتفاق تمثيل مفتوح المدة بعمولة "+Math.round(p.customFeeRate*100)+"%. "+a.pitch);
    if(API().setStory)API().setStory("بدأ فصل جديد: "+a.name,"وكيل أعمالك الجديد هو "+a.name+". أسلوبه: "+a.style+". اختياراتك في قصته هتأثر على خطتك ومميزات التفاوض والانتقالات.");
    save(s,"تم توقيع اتفاق الوكالة. قصة "+a.name+" هتتفتح مع تقدم المسيرة.");closeDialog();
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
  function finishStory(index){
    var s=API().getState(),cfg=agentConfig(s),p=s.agentProfile,chapter=currentChapter(s);
    if(!cfg||!p||!chapter||!chapter.options[index])return;
    var c=chapter.options[index];
    Object.keys(c.effects||{}).forEach(function(k){if(["trust","morale","energy","fatigue","professionalism","mediaReputation","teamChemistry","coachRelationship","money","followers"].indexOf(k)>=0)boundedStat(s,k,c.effects[k]);});
    if(c.strategy)p.strategyOverride=c.strategy;
    if(c.contractMultiplierDelta)p.contractMultiplierDelta=Math.max(-.06,Math.min(.06,(Number(p.contractMultiplierDelta)||0)+c.contractMultiplierDelta));
    if(c.negotiationRaiseBonusDelta)p.negotiationRaiseBonusDelta=Math.max(-.1,Math.min(.15,(Number(p.negotiationRaiseBonusDelta)||0)+c.negotiationRaiseBonusDelta));
    if(c.setPerk)p.perks[c.setPerk]=true;
    addTrust(s,c.relationship);p.storyStage=cap(Number(p.storyStage)+1,0,cfg.chapters.length);
    p.lastChapterApps=Number(s.apps)||0;p.lastChapterSeason=Number(s.season)||1;
    record(s,cfg.name+" — "+chapter.title,c.outcome+" (العلاقة: "+rel(s)+"/100)");
    if(API().setStory)API().setStory(chapter.title,c.outcome);
    save(s,"القرار اتسجل في قصة الوكيل واتطبقت نتائجه.");openActive();
  }
  function endCurrent(){
    var s=API().getState(),p=s.agentProfile;if(!s.agent||!p)return;
    var cfg=agentConfig(s)||LEGACY_AGENT,fee=Math.max(20,Math.round((Number(s.weeklyWage)||250)*Number(cfg.exitFeeWeeks||.25)));
    frame("إنهاء اتفاق التمثيل","END REPRESENTATION",'<div class="lwa-change-notice"><strong>شرط الخروج: '+fee+' جنيه</strong><p>لو أنهيت الاتفاق، هتدفع الشرط من رصيد اللعبة، وبعدها تقدر تختار وكيلًا آخر أو تكمل من غير وكيل.</p></div><div class="lwa-dialog-actions"><button type="button" class="lwa-button lwa-button-primary" data-lwag-action="agent-confirm-end"'+(Number(s.money)<fee?" disabled":"")+'>أدفع وأنهي الاتفاق</button><button type="button" class="lwa-button" data-lwag-action="close">أكمل معاه</button></div>');
  }
  function confirmEnd(){
    var s=API().getState(),p=s.agentProfile,cfg=agentConfig(s)||LEGACY_AGENT;if(!p)return;
    var fee=Math.max(20,Math.round((Number(s.weeklyWage)||250)*Number(cfg.exitFeeWeeks||.25)));
    if(Number(s.money)<fee){API().toast("رصيدك مش كفاية لشرط الخروج. تقدر تكمّل الاتفاق لحد ما تقدر تغيّره.");return;}
    s.money-=fee;record(s,"إنهاء اتفاق الوكالة","أنهيت اتفاق التمثيل مع "+cfg.name+" ودفعت "+fee+" جنيه داخل اللعبة.");
    s.agent=false;s.agentProfile=null;save(s,"انتهى اتفاق الوكالة. السوق متاح لاختيار وكيل جديد.");closeDialog();
  }
  function switchAgent(id){
    var s=API().getState(),old=agentConfig(s)||LEGACY_AGENT,p=s.agentProfile,a=candidate(id);
    if(!a||!p||!s.agent||!canUseAgent(s))return;
    var fee=Math.max(20,Math.round((Number(s.weeklyWage)||250)*Number(old.exitFeeWeeks||.25)));
    if(Number(s.money)<fee){API().toast("رصيدك مش كفاية لشرط الخروج من الوكيل الحالي.");return;}
    s.money-=fee;record(s,"تغيير الوكيل","أنهيت اتفاق "+old.name+" ودفعت "+fee+" جنيه داخل اللعبة لاختيار "+a.name+".");
    s.agent=false;s.agentProfile=null;signAgent(id,quotedFeeRate,true);
  }

  function profileValue(s,key,fallback){
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return fallback;
    var base=Number(cfg[key]),r=rel(s);
    if(key==="contractMultiplier")return Math.max(.96,Math.min(1.18,(Number.isFinite(base)?base:1.08)+(r-50)*.00035+(Number(p.contractMultiplierDelta)||0)));
    if(key==="negotiationRaiseBonus")return Math.max(-.08,Math.min(.15,(Number.isFinite(base)?base:0)+(Number(p.negotiationRaiseBonusDelta)||0)));
    return Number.isFinite(base)?base:fallback;
  }
  function contractTerms(s){if(!s||!s.agent||!s.agentProfile)return false;return {contractMultiplier:profileValue(s,"contractMultiplier",1.08)};}
  function negotiationChanceBonus(s){if(!s||!s.agent||!s.agentProfile)return 0;return Math.round(profileValue(s,"negotiationBonus",0)+(rel(s)-50)*.08);}
  function transferOfferChance(s,base){if(!s||!s.agent||!s.agentProfile)return base;return Math.max(.12,Math.min(.82,Number(base)+profileValue(s,"offerChanceBonus",0)+(rel(s)-50)*.001));}
  function prioritizeTargets(s,targets){
    if(!Array.isArray(targets)||!targets.length)return targets||[];
    var cfg=agentConfig(s),p=s&&s.agentProfile;if(!cfg||!p)return targets;
    var strategy=p.strategyOverride||cfg.strategy,currentPower=Number(s.clubPower)||50,currentCountry=String(s.leagueCountry||"");
    var scored=targets.map(function(t,i){
      var power=Number(t.power)||50,d=power-currentPower,score=0;
      if(strategy==="local"){score+=String(t.country||"")===currentCountry?45:-5;score+=d>=-8&&d<=16?18:-Math.abs(d-3)*.35;}
      else if(strategy==="ambitious"){score+=d>0?25+Math.min(15,d):-18;score+=String(t.country||"")!==currentCountry?6:0;}
      else if(strategy==="brand"){score+=power*.38+(String(t.country||"")!==currentCountry?12:0);}
      else if(strategy==="salary"){score+=power*.22+Math.min(18,Math.max(-18,d));}
      else if(strategy==="rapid"){score+=24-Math.abs(d)*.7+(String(t.country||"")===currentCountry?8:0);}
      else if(strategy==="role"||strategy==="long-term"){score+=d>=-8&&d<=12?26:-Math.abs(d)*.5;score+=String(t.country||"")===currentCountry?6:0;}
      else{score+=d>=-5&&d<=15?25:-Math.abs(d)*.4;score+=String(t.country||"")!==currentCountry?4:0;}
      return {target:t,score:score,index:i};
    });
    scored.sort(function(a,b){return b.score-a.score||a.index-b.index;});
    return scored.slice(0,Math.min(5,scored.length)).map(function(x){return x.target;});
  }
  function adjustTransferWage(s,wage){
    if(!s||!s.agent||!s.agentProfile)return wage;
    var cfg=agentConfig(s);if(!cfg)return wage;
    var factor=(Number(cfg.transferWageMultiplier)||1)+(rel(s)-50)*.00025;
    return Math.max(0,Math.round((Number(wage)||0)*Math.max(.9,Math.min(1.16,factor))));
  }
  function feeRate(s){
    if(!s||!s.agent||!s.agentProfile)return 0;var cfg=agentConfig(s);if(!cfg)return 0;
    return Math.max(.02,Math.min(.14,Number(s.agentProfile.customFeeRate==null?cfg.feeRate:s.agentProfile.customFeeRate)||cfg.feeRate));
  }
  function chargeFee(s,reason,gross){
    if(!s||!s.agent||!s.agentProfile)return 0;
    var base=Math.max(0,Number(gross)||0);if(!base)return 0;
    var requested=Math.max(1,Math.round(base*feeRate(s))),available=Math.max(0,Number(s.money)||0),paid=Math.min(available,requested);
    s.money=available-paid;
    if(paid<requested){s.agentProfile.feeDebt=Math.max(0,Number(s.agentProfile.feeDebt)||0)+requested-paid;addTrust(s,-2);}else addTrust(s,1);
    var cfg=agentConfig(s)||LEGACY_AGENT;
    record(s,"أتعاب "+cfg.name,"دفع الوكيل مقابل خدمة "+String(reason||"تمثيل")+" أتعابًا قدرها "+paid+" جنيه داخل اللعبة"+(paid<requested?"، والمتبقي المسجل "+(requested-paid)+" جنيه.":"."));
    return paid;
  }
  function afterNegotiation(s,result){
    if(!s||!s.agent||!s.agentProfile||!result)return {fee:0,wage:Number(s&&s.weeklyWage)||0};
    if(result.status!=="success"){addTrust(s,-3);return {fee:0,wage:Number(s.weeklyWage)||0};}
    var old=Math.max(0,Number(result.oldWage)||0),raw=Math.max(old,Number(result.wage)||Number(s.weeklyWage)||old),gain=Math.max(0,raw-old),bonus=profileValue(s,"negotiationRaiseBonus",0);
    var wage=Math.max(old,Math.round(raw+gain*bonus));s.weeklyWage=wage;result.wage=wage;addTrust(s,5);
    var fee=chargeFee(s,"مفاوضات المرتب",Math.max(0,wage-old)*5);
    return {fee:fee,wage:wage,bonus:bonus};
  }
  function onContractRenewal(s,offer){
    if(!s||!s.agent||!s.agentProfile)return 0;addTrust(s,4);
    return chargeFee(s,"تجديد العقد",Math.max(0,Number(offer&&offer.wage)||Number(s.weeklyWage)||0));
  }
  function sponsorshipMultiplier(s){if(!s||!s.agent||!s.agentProfile)return 1;return Math.max(1,Math.min(1.45,1+profileValue(s,"sponsorshipBonus",.1)+(rel(s)-50)*.001));}
  function matchPayMultiplier(s){if(!s||!s.agent||!s.agentProfile)return 1;return Math.max(1,Math.min(1.15,1+profileValue(s,"matchPayBonus",.02)));}
  function dailyRecoveryBonus(s){return s&&s.agent&&s.agentProfile&&s.agentProfile.perks&&s.agentProfile.perks.recovery?3:0;}
  function renewRelationship(s){
    if(!s||!s.agent||!s.agentProfile)return false;var cfg=agentConfig(s);if(!cfg)return false;
    var p=s.agentProfile,milestone=Math.floor((Number(s.apps)||0)/5);if(milestone<=Number(p.lastPerformanceMilestone||0))return false;
    p.lastPerformanceMilestone=milestone;var rating=Number(s.lastRating)||0,delta=rating>=7.5?3:rating>=6.5?1:rating>0?-2:0;
    if(delta)addTrust(s,delta);
    if(delta>=3)record(s,"ثقة الوكيل زادت","أداؤك الأخير خلّى "+cfg.name+" أكثر ثقة في خطتك.");
    else if(delta<0)record(s,"الوكيل قلق من الأداء",cfg.name+" طلب منك تراجع مستواك وتحدد الخطوة الجاية.");
    return true;
  }
  function currentAgentData(){return AGENTS.map(function(a){return {id:a.id,name:a.name,title:a.title,style:a.style,feeRate:a.feeRate,strength:a.strength,weakness:a.weakness};});}
  function handleAction(action,element){
    var api=API(),s=api&&api.getState();if(!s)return;ensureState(s);
    var id=element&&element.getAttribute("data-agent-id")||selectedAgentId;
    if(action==="close"){closeDialog();return;}
    if(action==="agent-meet"){openMeeting(id);return;}
    if(action==="agent-active"){openActive();return;}
    if(action==="agent-counter"){negotiateFee(id);return;}
    if(action==="agent-sign"){signAgent(id,quotedFeeRate,false);return;}
    if(action==="agent-switch-sign"){switchAgent(id);return;}
    if(action==="agent-story"){openActive();return;}
    if(action==="agent-story-choice"){finishStory(Number(element.getAttribute("data-choice-index")));return;}
    if(action==="agent-end-current"){endCurrent();return;}
    if(action==="agent-confirm-end"){confirmEnd();return;}
  }
  function tick(){
    var api=API();if(!api)return;var s=api.getState();if(!s)return;
    var changed=ensureState(s);
    if(s.agent&&renewRelationship(s))changed=true;
    if(ensurePanel())renderPanel(s);
    if(changed&&api.save)api.save();
    lastSnapshot=[s.careerStarted,s.agent,s.agentProfile&&s.agentProfile.id,s.agentProfile&&s.agentProfile.relationship,s.agentProfile&&s.agentProfile.storyStage,s.apps,s.season,s.seasonFinished,s.money,s.weeklyWage].join("|");
  }
  document.addEventListener("click",function(event){
    var b=event.target&&event.target.closest?event.target.closest("[data-lwag-action]"):null;
    if(!b||b.disabled)return;event.preventDefault();handleAction(b.getAttribute("data-lwag-action")||"",b);
  });
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&overlay&&!overlay.hidden)closeDialog();});
  function start(){tick();window.setInterval(tick,1000);window.addEventListener("pageshow",tick);window.addEventListener("storage",tick);}

  // Stage 2: post-retirement career paths. Actions are deterministic and persist in the career state.
  function postRetirementOptions(s){
    if(!s||!s.retired)return {available:false,reason:"لازم تعتزل الأول."};
    var wealth=Math.max(0,Number(s.money)||0),fame=Math.max(0,Number(s.mediaReputation)||0);
    return {
      available:true,
      agent:{available:wealth>=250000,minimumCapital:250000,networkScore:Math.round(Math.min(100,fame*.55+wealth/500000))},
      clubOwner:{available:wealth>=5000000,minimumCapital:5000000,requiredShare:51,academyBudget:Math.round(wealth*.08)}
    };
  }
  function startPostRetirementAgency(s,capital){
    var options=postRetirementOptions(s),amount=Math.max(0,Math.round(Number(capital)||250000));
    if(!options.available||!options.agent.available||amount<250000||amount>Math.max(0,Number(s.money)||0))return {ok:false,reason:"رأس المال غير كافٍ أو المسيرة لم تنتهِ."};
    s.money=Math.max(0,Number(s.money||0)-amount);
    s.retirementCareer={type:"agency",capital:amount,players:[],reputation:Math.round(Math.min(100,(Number(s.mediaReputation)||0)*.55+amount/500000)),season:Number(s.season)||1,history:[]};
    if(!Array.isArray(s.retirementCareer.history))s.retirementCareer.history=[];
    s.retirementCareer.history.push({type:"founded",season:s.retirementCareer.season,capital:amount});
    var api=API();if(api&&api.save)api.save();if(api&&api.render)api.render();
    return {ok:true,career:s.retirementCareer};
  }
  function acquireClubControl(s,club,clubValue,share){
    var options=postRetirementOptions(s),value=Math.max(1,Number(clubValue)||0),portion=Math.max(51,Math.min(100,Number(share)||51));
    var cost=Math.ceil(value*portion/100);
    if(!options.available||!options.clubOwner.available||!club||cost>Math.max(0,Number(s.money)||0))return {ok:false,reason:"لا يمكن شراء حصة حاكمة بهذه الميزانية."};
    s.money=Math.max(0,Number(s.money||0)-cost);
    s.retirementCareer={type:"club-owner",club:String(club),share:portion,investment:cost,academyBudget:Math.round(cost*.08),season:Number(s.season)||1,history:[{type:"acquisition",club:String(club),share:portion,cost:cost}]};
    var api=API();if(api&&api.save)api.save();if(api&&api.render)api.render();
    return {ok:true,career:s.retirementCareer};
  }
  function registerAgencyPlayer(s,player){
    if(!s||!s.retirementCareer||s.retirementCareer.type!=="agency"||!player||!player.id)return {ok:false,reason:"مسار الوكالة غير متاح أو بيانات اللاعب ناقصة."};
    var career=s.retirementCareer;career.players=Array.isArray(career.players)?career.players:[];
    if(career.players.some(function(p){return String(p.id)===String(player.id);}))return {ok:false,reason:"اللاعب مسجل بالفعل."};
    career.players.push({id:String(player.id),name:String(player.name||"لاعب جديد"),club:String(player.club||""),joinedSeason:Number(s.season)||1,appearancesAtSigning:Math.max(0,Number(player.appearances)||0)});
    career.reputation=Math.min(100,(Number(career.reputation)||0)+1);
    if(Array.isArray(career.history))career.history.unshift({type:"player-signed",playerId:String(player.id),season:Number(s.season)||1});
    var api=API();if(api&&api.save)api.save();
    return {ok:true,player:career.players[career.players.length-1]};
  }
  window.LWAgentRuntime={getAgents:currentAgentData,ensureState:ensureState,current:current,contractTerms:contractTerms,
    negotiationChanceBonus:negotiationChanceBonus,transferOfferChance:transferOfferChance,prioritizeTargets:prioritizeTargets,
    adjustTransferWage:adjustTransferWage,chargeFee:chargeFee,afterNegotiation:afterNegotiation,onContractRenewal:onContractRenewal,
    sponsorshipMultiplier:sponsorshipMultiplier,matchPayMultiplier:matchPayMultiplier,dailyRecoveryBonus:dailyRecoveryBonus,
    currentChapter:currentChapter,chapterProgress:progress,
    postRetirementOptions:postRetirementOptions,startPostRetirementAgency:startPostRetirementAgency,
    acquireClubControl:acquireClubControl,registerAgencyPlayer:registerAgencyPlayer};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
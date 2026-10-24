/* Curated football league/club layer for LAST WHISTLE.
 * OVR and prestige are gameplay estimates, not official ratings.
 * Player names are selected squad highlights, not complete registration lists.
 */
(function () {
  "use strict";
  var VERSION = 2;
  var SEASON = "2026/27";
  var RATINGS_NOTE = "قوة الأندية والهيبة هنا تقديرات توازن داخل اللعبة، مش تصنيفات رسمية. أسماء النجوم أمثلة من القوائم وليست قائمة كاملة.";
  var LEAGUES = [
    {id:"england",country:"إنجلترا",englishCountry:"England",league:"الدوري الإنجليزي الممتاز",english:"Premier League",tier2:"دوري البطولة الإنجليزية",tier2English:"EFL Championship",confederation:"UEFA",globalTier:1,strength:98,teams:20,matches:38,tier2Teams:24,currency:"£",cups:["fa-cup","efl-cup"],superCup:"community-shield",continental:["ucl","uel","uecl"],url:"https://www.premierleague.com/"},
    {id:"spain",country:"إسبانيا",englishCountry:"Spain",league:"الدوري الإسباني الدرجة الأولى",english:"LaLiga",tier2:"الدوري الإسباني الدرجة الثانية",tier2English:"LaLiga Hypermotion",confederation:"UEFA",globalTier:1,strength:96,teams:20,matches:38,tier2Teams:22,currency:"€",cups:["copa-del-rey"],superCup:"spanish-super-cup",continental:["ucl","uel","uecl"],url:"https://www.laliga.com/"},
    {id:"germany",country:"ألمانيا",englishCountry:"Germany",league:"الدوري الألماني الدرجة الأولى",english:"Bundesliga",tier2:"الدوري الألماني الدرجة الثانية",tier2English:"2. Bundesliga",confederation:"UEFA",globalTier:1,strength:94,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["dfb-pokal"],superCup:"german-super-cup",continental:["ucl","uel","uecl"],url:"https://www.bundesliga.com/"},
    {id:"italy",country:"إيطاليا",englishCountry:"Italy",league:"الدوري الإيطالي الدرجة الأولى",english:"Serie A",tier2:"الدوري الإيطالي الدرجة الثانية",tier2English:"Serie B",confederation:"UEFA",globalTier:1,strength:93,teams:20,matches:38,tier2Teams:20,currency:"€",cups:["coppa-italia"],superCup:"italian-super-cup",continental:["ucl","uel","uecl"],url:"https://www.legaseriea.it/"},
    {id:"france",country:"فرنسا",englishCountry:"France",league:"الدوري الفرنسي الدرجة الأولى",english:"Ligue 1",tier2:"الدوري الفرنسي الدرجة الثانية",tier2English:"Ligue 2",confederation:"UEFA",globalTier:1,strength:91,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["coupe-de-france"],superCup:"trophee-des-champions",continental:["ucl","uel","uecl"],url:"https://ligue1.com/"},
    {id:"portugal",country:"البرتغال",englishCountry:"Portugal",league:"الدوري البرتغالي الممتاز",english:"Primeira Liga",tier2:"الدوري البرتغالي الدرجة الثانية",tier2English:"Liga Portugal 2",confederation:"UEFA",globalTier:1,strength:88,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["taca-portugal","taca-liga"],superCup:"portuguese-super-cup",continental:["ucl","uel","uecl"],url:"https://www.ligaportugal.pt/"},
    {id:"egypt",country:"مصر",englishCountry:"Egypt",league:"الدوري المصري الممتاز",english:"Egyptian Premier League",tier2:"دوري الدرجة الثانية المصري",tier2English:"Egyptian Second Division",confederation:"CAF",globalTier:3,strength:76,teams:18,matches:34,tier2Teams:12,currency:"ج.م",cups:["egypt-cup","egypt-league-cup"],superCup:"egyptian-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.efa.com.eg/"},
    {id:"morocco",country:"المغرب",englishCountry:"Morocco",league:"البطولة الاحترافية المغربية",english:"Botola Pro",tier2:"القسم الثاني المغربي",tier2English:"Botola 2",confederation:"CAF",globalTier:3,strength:72,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["morocco-throne-cup"],superCup:"morocco-super-cup",continental:["caf-cl","caf-confed"],url:"https://frmf.ma/"},
    {id:"tunisia",country:"تونس",englishCountry:"Tunisia",league:"الرابطة التونسية المحترفة الأولى",english:"Tunisian Ligue Professionnelle 1",tier2:"الرابطة التونسية المحترفة الثانية",tier2English:"Ligue 2",confederation:"CAF",globalTier:3,strength:70,teams:16,matches:30,tier2Teams:24,currency:"$",cups:["tunisia-cup"],superCup:"tunisia-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.ftf.org.tn/"},
    {id:"algeria",country:"الجزائر",englishCountry:"Algeria",league:"الرابطة الجزائرية المحترفة الأولى",english:"Ligue Professionnelle 1",tier2:"الرابطة الجزائرية الثانية",tier2English:"Ligue 2",confederation:"CAF",globalTier:3,strength:69,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["algeria-cup"],superCup:"algeria-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.faf.dz/"},
    {id:"senegal",country:"السنغال",englishCountry:"Senegal",league:"الدوري السنغالي الممتاز",english:"Senegal Premier League",tier2:"الدرجة الثانية السنغالية",tier2English:"Senegal Ligue 2",confederation:"CAF",globalTier:3,strength:64,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["senegal-cup"],superCup:null,continental:["caf-cl","caf-confed"],url:"https://fsfoot.sn/"},
    {id:"nigeria",country:"نيجيريا",englishCountry:"Nigeria",league:"الدوري النيجيري الممتاز",english:"Nigeria Premier Football League",tier2:"الدوري النيجيري الوطني",tier2English:"Nigeria National League",confederation:"CAF",globalTier:3,strength:64,teams:20,matches:38,tier2Teams:20,currency:"$",cups:["nigeria-cup"],superCup:"nigeria-super-cup",continental:["caf-cl","caf-confed"],url:"https://thenff.com/"},
    {id:"ghana",country:"غانا",englishCountry:"Ghana",league:"الدوري الغاني الممتاز",english:"Ghana Premier League",tier2:"الدرجة الأولى الغانية",tier2English:"Division One League",confederation:"CAF",globalTier:3,strength:62,teams:18,matches:34,tier2Teams:48,currency:"$",cups:["ghana-fa-cup"],superCup:"ghana-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.ghanafa.org/"},
    {id:"brazil",country:"البرازيل",englishCountry:"Brazil",league:"الدوري البرازيلي الدرجة الأولى",english:"Campeonato Brasileiro Série A",tier2:"الدوري البرازيلي الدرجة الثانية",tier2English:"Série B",confederation:"CONMEBOL",globalTier:2,strength:84,teams:20,matches:38,tier2Teams:20,currency:"$",cups:["copa-do-brasil"],superCup:"brazilian-super-cup",continental:["libertadores","sudamericana"],url:"https://www.cbf.com.br/"},
    {id:"argentina",country:"الأرجنتين",englishCountry:"Argentina",league:"الدوري الأرجنتيني للمحترفين",english:"Liga Profesional de Fútbol",tier2:"الدرجة الثانية الأرجنتينية",tier2English:"Primera Nacional",confederation:"CONMEBOL",globalTier:2,strength:82,teams:30,matches:30,tier2Teams:36,currency:"$",cups:["copa-argentina"],superCup:"argentina-super-cup",continental:["libertadores","sudamericana"],url:"https://www.afa.com.ar/"}
  ];

  var TOURNAMENTS = [
    {id:"league",name:"الدوري المحلي",kind:"league",system:"league",format:"موسم دوري؛ عدد المباريات حسب الدوري والدرجة.",url:""},
    {id:"ucl",name:"UEFA Champions League",kind:"continental",confederation:"UEFA",system:"uefa36",qualificationPlaces:[1,2,3,4],url:"https://www.uefa.com/uefachampionsleague/",format:"مرحلة دوري من 36 ناديًا ثم ملحق وأدوار إقصائية.",qualification:"التأهل حسب ترتيب الدوري ولوائح UEFA."},
    {id:"uel",name:"UEFA Europa League",kind:"continental",confederation:"UEFA",system:"uefa36",qualificationPlaces:[5,6],url:"https://www.uefa.com/uefaeuropaleague/",format:"مرحلة دوري من 36 ناديًا ثم ملحق وأدوار إقصائية.",qualification:"التأهل حسب ترتيب الدوري والكأس ولوائح UEFA."},
    {id:"uecl",name:"UEFA Conference League",kind:"continental",confederation:"UEFA",system:"uefa36conference",qualificationPlaces:[7],url:"https://www.uefa.com/uefaconferenceleague/",format:"مرحلة دوري من 36 ناديًا ثم أدوار إقصائية.",qualification:"التأهل حسب ترتيب الدوري والكأس ولوائح UEFA."},
    {id:"uefa-super-cup",name:"UEFA Super Cup",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.uefa.com/uefasupercup/",format:"مباراة واحدة بين بطلي دوري الأبطال والدوري الأوروبي.",qualification:"للبطلين القاريين في الموسم السابق.",teams:["ريال مدريد","باريس سان جيرمان"]},
    {id:"caf-super-cup",name:"كأس السوبر الأفريقي",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://www.cafonline.com/",format:"مباراة واحدة بين بطلي دوري أبطال أفريقيا والكونفدرالية.",qualification:"للبطلين القاريين في الموسم السابق.",teams:["الأهلي","نهضة بركان"]},
    {id:"fa-cup",name:"FA Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.thefa.com/competitions/thefacup",format:"كأس إنجليزي بخروج المغلوب، وتشارك فيه أندية من درجات متعددة.",qualification:"وفق لائحة الاتحاد الإنجليزي.",countries:["england"],lower:true,teams:["أرسنال","ليفربول","مانشستر سيتي","مانشستر يونايتد","تشيلسي"]},
    {id:"efl-cup",name:"EFL Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.efl.com/competitions/carabao-cup/",format:"كأس رابطة إنجليزي بخروج المغلوب.",qualification:"الأندية المؤهلة من مسابقات الرابطة.",countries:["england"],lower:true,teams:["ليفربول","مانشستر سيتي","أرسنال","نيوكاسل يونايتد"]},
    {id:"community-shield",name:"FA Community Shield",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.thefa.com/competitions/the-fa-community-shield",format:"مباراة السوبر الإنجليزي وفق نتائج الموسم السابق.",qualification:"أبطال الدوري والكأس أو البديل المحدد باللائحة.",countries:["england"]},
    {id:"copa-del-rey",name:"Copa del Rey",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://rfef.es/",format:"كأس ملك إسبانيا بخروج المغلوب.",qualification:"وفق لائحة الاتحاد الإسباني.",countries:["spain"],lower:true,teams:["ريال مدريد","برشلونة","أتلتيكو مدريد","أتلتيك بلباو"]},
    {id:"spanish-super-cup",name:"Supercopa de España",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://rfef.es/",format:"السوبر الإسباني للفرق المتأهلة.",qualification:"وفق نتائج الدوري والكأس.",countries:["spain"]},
    {id:"dfb-pokal",name:"DFB-Pokal",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.dfb.de/dfb-pokal/",format:"كأس ألمانيا بخروج المغلوب.",qualification:"وفق لوائح الاتحاد الألماني.",countries:["germany"],lower:true,teams:["بايرن ميونخ","بوروسيا دورتموند","باير ليفركوزن"]},
    {id:"german-super-cup",name:"DFL-Supercup",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.bundesliga.com/",format:"السوبر الألماني وفق نتائج الموسم السابق.",qualification:"وفق لائحة الموسم.",countries:["germany"]},
    {id:"coppa-italia",name:"Coppa Italia",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.legaseriea.it/",format:"كأس إيطاليا بخروج المغلوب.",qualification:"دخول الأندية في الأدوار حسب فئتها.",countries:["italy"],lower:true,teams:["إنتر ميلان","يوفنتوس","ميلان","نابولي"]},
    {id:"italian-super-cup",name:"Supercoppa Italiana",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.legaseriea.it/",format:"السوبر الإيطالي وفق نظام الموسم.",qualification:"وفق نتائج الدوري والكأس.",countries:["italy"]},
    {id:"coupe-de-france",name:"Coupe de France",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.fff.fr/",format:"كأس فرنسا بمشاركة درجات مختلفة.",qualification:"وفق قواعد الاتحاد الفرنسي.",countries:["france"],lower:true,teams:["باريس سان جيرمان","مارسيليا","موناكو","ليون"]},
    {id:"trophee-des-champions",name:"Trophée des Champions",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.fff.fr/",format:"السوبر الفرنسي.",qualification:"وفق نتائج الموسم السابق.",countries:["france"]},
    {id:"taca-portugal",name:"Taça de Portugal",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.fpf.pt/",format:"كأس البرتغال بخروج المغلوب.",qualification:"وفق قواعد الاتحاد البرتغالي.",countries:["portugal"],lower:true,teams:["بنفيكا","بورتو","سبورتينغ لشبونة"]},
    {id:"taca-liga",name:"Taça da Liga",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.ligaportugal.pt/",format:"كأس الرابطة البرتغالية.",qualification:"وفق لائحة كأس الرابطة.",countries:["portugal"],teams:["بنفيكا","بورتو","سبورتينغ لشبونة"]},
    {id:"portuguese-super-cup",name:"Supertaça Cândido de Oliveira",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.fpf.pt/",format:"السوبر البرتغالي.",qualification:"بطل الدوري والكأس وفق اللائحة.",countries:["portugal"]},
    {id:"egypt-cup",name:"كأس مصر",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://www.efa.com.eg/",format:"كأس مصر بخروج المغلوب وفق لائحة الموسم.",qualification:"الأندية المسجلة المؤهلة وفق لائحة الاتحاد المصري.",countries:["egypt"],lower:true,teams:["الأهلي","الزمالك","بيراميدز","المصري"]},
    {id:"egypt-league-cup",name:"كأس الرابطة المصرية",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://www.efa.com.eg/",format:"كأس الرابطة المصرية وفق لائحة الموسم.",qualification:"وفق لائحة رابطة الأندية.",countries:["egypt"],teams:["الأهلي","الزمالك","بيراميدز","سيراميكا كليوباترا"]},
    {id:"egyptian-super-cup",name:"كأس السوبر المصري",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://www.efa.com.eg/",format:"السوبر المصري وفق لائحة الموسم.",qualification:"وفق نتائج الموسم السابق ولوائح البطولة.",countries:["egypt"]},
    {id:"morocco-throne-cup",name:"كأس العرش المغربي",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://frmf.ma/",format:"كأس العرش بخروج المغلوب.",qualification:"وفق لائحة الجامعة الملكية المغربية.",countries:["morocco"],lower:true,teams:["الرجاء","الوداد","الجيش الملكي","نهضة بركان"]},
    {id:"morocco-super-cup",name:"السوبر المغربي",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://frmf.ma/",format:"السوبر المغربي إن أُقيم وفق إعلان الموسم.",qualification:"تتحدد المشاركة رسميًا قبل الموسم.",countries:["morocco"]},
    {id:"tunisia-cup",name:"كأس تونس",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://www.ftf.org.tn/",format:"كأس تونس بخروج المغلوب.",qualification:"وفق لائحة الجامعة التونسية.",countries:["tunisia"],lower:true,teams:["الترجي الرياضي","النادي الإفريقي","النجم الساحلي"]},
    {id:"tunisia-super-cup",name:"كأس السوبر التونسي",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://www.ftf.org.tn/",format:"السوبر التونسي وفق لائحة الموسم.",qualification:"وفق نتائج الموسم السابق.",countries:["tunisia"]},
    {id:"algeria-cup",name:"كأس الجزائر",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://www.faf.dz/",format:"كأس الجزائر بخروج المغلوب.",qualification:"وفق قواعد الاتحاد الجزائري.",countries:["algeria"],lower:true,teams:["مولودية الجزائر","اتحاد العاصمة","شبيبة القبائل"]},
    {id:"algeria-super-cup",name:"كأس السوبر الجزائري",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://www.faf.dz/",format:"السوبر الجزائري وفق لائحة الموسم.",qualification:"وفق نتائج الموسم السابق.",countries:["algeria"]},
    {id:"senegal-cup",name:"Coupe du Sénégal",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://fsfoot.sn/",format:"الكأس الوطني السنغالي بخروج المغلوب.",qualification:"وفق لائحة الاتحاد السنغالي.",countries:["senegal"],lower:true,teams:["دياراف","جينيراسيون فوت"]},
    {id:"nigeria-cup",name:"Nigeria Federation Cup",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://thenff.com/",format:"كأس الاتحاد النيجيري بخروج المغلوب.",qualification:"وفق قواعد الاتحاد النيجيري.",countries:["nigeria"],lower:true,teams:["إنييمبا","ريفرز يونايتد"]},
    {id:"nigeria-super-cup",name:"Nigeria Super Cup",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://thenff.com/",format:"السوبر النيجيري إن أُقيم في الموسم.",qualification:"وفق إعلان الموسم.",countries:["nigeria"]},
    {id:"ghana-fa-cup",name:"MTN FA Cup",kind:"domestic-cup",confederation:"CAF",system:"knockout",url:"https://www.ghanafa.org/",format:"كأس الاتحاد الغاني بخروج المغلوب.",qualification:"وفق لائحة الاتحاد الغاني.",countries:["ghana"],lower:true,teams:["أسانتي كوتوكو","هارتس أوف أوك"]},
    {id:"ghana-super-cup",name:"Ghana Super Cup",kind:"supercup",confederation:"CAF",system:"supercup",url:"https://www.ghanafa.org/",format:"السوبر الغاني وفق اعتماد الموسم.",qualification:"وفق نتائج الموسم السابق.",countries:["ghana"]},
    {id:"copa-do-brasil",name:"Copa do Brasil",kind:"domestic-cup",confederation:"CONMEBOL",system:"knockout",url:"https://www.cbf.com.br/",format:"كأس البرازيل بخروج المغلوب.",qualification:"المقاعد وفق لائحة الاتحاد البرازيلي.",countries:["brazil"],lower:true,teams:["فلامنغو","بالميراس","كورينثيانز","ساو باولو"]},
    {id:"brazilian-super-cup",name:"Supercopa do Brasil",kind:"supercup",confederation:"CONMEBOL",system:"supercup",url:"https://www.cbf.com.br/",format:"السوبر البرازيلي.",qualification:"بطلا الدوري والكأس وفق اللائحة.",countries:["brazil"]},
    {id:"copa-argentina",name:"Copa Argentina",kind:"domestic-cup",confederation:"CONMEBOL",system:"knockout",url:"https://www.afa.com.ar/",format:"كأس الأرجنتين بخروج المغلوب.",qualification:"وفق لائحة الاتحاد الأرجنتيني.",countries:["argentina"],lower:true,teams:["بوكا جونيورز","ريفر بليت","راسينغ كلوب","إنديبندينتي"]},
    {id:"argentina-super-cup",name:"Supercopa Argentina",kind:"supercup",confederation:"CONMEBOL",system:"supercup",url:"https://www.afa.com.ar/",format:"السوبر الأرجنتيني.",qualification:"وفق البطولات المتوج بها الفريق.",countries:["argentina"]},
    {id:"caf-cl",name:"CAF Champions League",kind:"continental",confederation:"CAF",system:"caf",url:"https://www.cafonline.com/caf-champions-league/",format:"أدوار تمهيدية ثم مجموعات وأدوار إقصائية.",qualification:"التأهل حسب ترتيب الدوري ولوائح CAF.",teams:["الأهلي","بيراميدز","الترجي الرياضي","الرجاء","الوداد","مولودية الجزائر"]},
    {id:"caf-confed",name:"CAF Confederation Cup",kind:"continental",confederation:"CAF",system:"caf",url:"https://www.cafonline.com/caf-confederation-cup/",format:"أدوار تمهيدية ثم مجموعات وأدوار إقصائية.",qualification:"المقاعد حسب ترتيب الدوري والكأس ولوائح CAF.",teams:["الزمالك","المصري","نهضة بركان","اتحاد العاصمة"]},
    {id:"libertadores",name:"Copa Libertadores",kind:"continental",confederation:"CONMEBOL",system:"caf",url:"https://www.conmebol.com/libertadores/",format:"مراحل تأهيل ومجموعات ثم أدوار إقصائية.",qualification:"حسب ترتيب الدوري والكؤوس ولوائح CONMEBOL.",teams:["فلامنغو","بالميراس","ريفر بليت","بوكا جونيورز","بوتافوغو"]},
    {id:"sudamericana",name:"Copa Sudamericana",kind:"continental",confederation:"CONMEBOL",system:"caf",url:"https://www.conmebol.com/sudamericana/",format:"بطولة قارية بمراحل تأهيل وإقصاء.",qualification:"حسب ترتيب الدوري ولوائح CONMEBOL.",teams:["كورينثيانز","راسينغ كلوب","إنديبندينتي"]},
    {id:"fifa-club-world-cup",name:"FIFA Club World Cup",kind:"world",confederation:"FIFA",system:"world32",url:"https://www.fifa.com/tournaments/mens/club-world-cup",format:"بطولة عالمية للأندية المؤهلة وفق دورة ولوائح FIFA.",qualification:"المشاركة لا تتم تلقائيًا؛ يلزم التأهل وفق لوائح FIFA.",teams:["ريال مدريد","مانشستر سيتي","الأهلي","فلامنغو","بالميراس","ريفر بليت"]}
  ];

  var CLUBS = [
    {name:"ريال مدريد",aliases:["Real Madrid","Real Madrid CF"],country:"إسبانيا",leagueId:"spain",ovr:93,prestige:100,stars:["كيليان مبابي","فينيسيوس جونيور","جود بيلينغهام","فيديريكو فالفيردي","تيبو كورتوا","ترنت ألكسندر أرنولد","رودريغو","إندريك","برناردو سيلفا","أردا غولر"]},
    {name:"برشلونة",aliases:["Barcelona","FC Barcelona"],country:"إسبانيا",leagueId:"spain",ovr:92,prestige:99,stars:["لامين يامال","رافينيا","بيدري","فرينكي دي يونغ","جوان غارسيا","جواو كانسيلو","فيرمين لوبيز","جافي","داني أولمو","روني بردغجي","جابرييل جيسوس","كريم أديمي","أنتوني غوردون"]},
    {name:"أتلتيكو مدريد",aliases:["Atletico Madrid","Atlético Madrid"],country:"إسبانيا",leagueId:"spain",ovr:87,prestige:92,stars:["جوليان ألفاريز","أنطوان جريزمان","كوكي","يان أوبلاك"]},
    {name:"أتلتيك بلباو",aliases:["Athletic Bilbao"],country:"إسبانيا",leagueId:"spain",ovr:82,prestige:85,stars:["نيكو ويليامز","إينياكي ويليامز","أوناي سيمون"]},
    {name:"مانشستر سيتي",aliases:["Manchester City","Manchester City FC"],country:"إنجلترا",leagueId:"england",ovr:93,prestige:99,stars:["إيرلينغ هالاند","ريان شرقي","جيريمي دوكو","فيل فودين","أنطوان سيمينيو","إنزو فرنانديز","إليوت أندرسون","روبن دياز","مارك غيهي","جيانلويجي دوناروما","نيكو أوريلي"]},
    {name:"ليفربول",aliases:["Liverpool","Liverpool FC"],country:"إنجلترا",leagueId:"england",ovr:90,prestige:97,stars:["فيرجيل فان دايك","فلوريان فيرتز","دومينيك سوبوسلاي","أليكسيس ماك أليستر","ريان خرافنبرخ","ألكسندر إيزاك","فيديريكو كييزا","كودي جاكبو","هوجو إيكيتيكي","برادلي باركولا","جيريمي فريمبونغ","رونالد أراوخو","أليسون بيكر"]},
    {name:"أرسنال",aliases:["Arsenal","Arsenal FC"],country:"إنجلترا",leagueId:"england",ovr:90,prestige:94,stars:["بوكايو ساكا","ديكلان رايس","مارتن أوديغارد","فيكتور جيوكيريس","ويليام ساليبا","دافيد رايا"]},
    {name:"تشيلسي",aliases:["Chelsea","Chelsea FC"],country:"إنجلترا",leagueId:"england",ovr:88,prestige:93,stars:["كول بالمر","إنزو فرنانديز","مويسيس كايسيدو","رييس جيمس","نيكولاس جاكسون"]},
    {name:"مانشستر يونايتد",aliases:["Manchester United","Man United"],country:"إنجلترا",leagueId:"england",ovr:86,prestige:96,stars:["برونو فرنانديز","ماتيس دي ليخت","أماد ديالو","كوبي ماينو"]},
    {name:"نيوكاسل يونايتد",aliases:["Newcastle United"],country:"إنجلترا",leagueId:"england",ovr:85,prestige:88,stars:["برونو غيماريش","ألكسندر إيساك","أنتوني غوردون","ساندرو تونالي"]},
    {name:"بايرن ميونخ",aliases:["Bayern Munich","FC Bayern München"],country:"ألمانيا",leagueId:"germany",ovr:92,prestige:98,stars:["هاري كين","جمال موسيالا","جوشوا كيميش","مايكل أوليسيه","مانويل نوير","لويس دياز","دايوت أوباميكانو","جوناثان تاه","ألفونسو ديفيز","سيرج غنابري","ألكسندر بافلوفيتش"]},
    {name:"بوروسيا دورتموند",aliases:["Borussia Dortmund","BVB"],country:"ألمانيا",leagueId:"germany",ovr:86,prestige:92,stars:["جوليان براندت","نيكلاس زوله","كريم أديمي","جريجور كوبل"]},
    {name:"باير ليفركوزن",aliases:["Bayer Leverkusen"],country:"ألمانيا",leagueId:"germany",ovr:87,prestige:88,stars:["فلوريان فيرتز","جرانيت تشاكا","جيريمي فريمبونغ","لوكاس هراديكي"]},
    {name:"باريس سان جيرمان",aliases:["Paris Saint-Germain","PSG"],country:"فرنسا",leagueId:"france",ovr:91,prestige:97,stars:["أشرف حكيمي","عثمان ديمبيلي","خفيتشا كفاراتسخيليا","فيتينيا","جواو نيفيز","ديزيريه دويه","وارن زاير إيمري","نونو مينديز","ويليان باتشو","ماركينيوس","فابيان رويز"]},
    {name:"مارسيليا",aliases:["Olympique de Marseille","Marseille"],country:"فرنسا",leagueId:"france",ovr:84,prestige:90,stars:["مايسون غرينوود","أمين غويري","بيير إيمريك أوباميانغ"]},
    {name:"موناكو",aliases:["AS Monaco"],country:"فرنسا",leagueId:"france",ovr:83,prestige:86,stars:["تاكومي مينامينو","ألكسندر غولوفين","دينيس زكريا"]},
    {name:"إنتر ميلان",aliases:["Inter Milan","Internazionale"],country:"إيطاليا",leagueId:"italy",ovr:90,prestige:95,stars:["لاوتارو مارتينيز","نيكولو باريلا","أليساندرو باستوني","هاكان تشالهان أوغلو"]},
    {name:"ميلان",aliases:["AC Milan"],country:"إيطاليا",leagueId:"italy",ovr:86,prestige:94,stars:["رافائيل لياو","مايك مينيان","ثيو هيرنانديز"]},
    {name:"يوفنتوس",aliases:["Juventus"],country:"إيطاليا",leagueId:"italy",ovr:87,prestige:96,stars:["كينان يلدز","دوشان فلاهوفيتش","فيديريكو كييزا"]},
    {name:"بنفيكا",aliases:["Benfica","SL Benfica"],country:"البرتغال",leagueId:"portugal",ovr:86,prestige:91,stars:["أناتولي تروبين","كليمنت لينجليه","غابرييل إنديو","سوداكوف","جواو بالينيا","لوكباكيو","باڤليديس","ألكسندر باه","رافا سيلفا","أندرياس شيلديروب"]},
    {name:"بورتو",aliases:["Porto","FC Porto"],country:"البرتغال",leagueId:"portugal",ovr:85,prestige:91,stars:["ديوغو كوستا","سامو أوموروديون","ألان فاريلا"]},
    {name:"سبورتينغ لشبونة",aliases:["Sporting CP","Sporting Lisbon"],country:"البرتغال",leagueId:"portugal",ovr:86,prestige:89,stars:["فيكتور جيوكيريس","بيدرو غونسالفيس","مورتن هيولماند"]},
    {name:"الأهلي",aliases:["Al Ahly","Al Ahly SC","Al-Ahly"],country:"مصر",leagueId:"egypt",ovr:78,prestige:94,stars:["محمد الشناوي","إمام عاشور","مروان عطية","محمد هاني","أحمد سيد زيزو","أشرف بن شرقي","حسين الشحات","مصطفى شوبير","ياسر إبراهيم","أحمد نبيل كوكا","طاهر محمد طاهر","ياسين مرعي","كريم فؤاد","منصف بقرار","سفيان بن جديدة","حمزة علاء","عمر الساعي","محمد مجدي أفشة"]},
    {name:"الزمالك",aliases:["Zamalek","Zamalek SC"],country:"مصر",leagueId:"egypt",ovr:75,prestige:92,stars:["ناصر منسي","عبد الله السعيد","خوان بيزيرا","عدي الدباغ","محمود بنتايج","أحمد فتوح","محمد صبحي","محمد عواد","مهدي سليمان","عمر جابر","حسام أشرف","أحمد شريف","محمد شحاتة","أحمد ربيع","آدم كايد"]},
    {name:"بيراميدز",aliases:["Pyramids FC","Pyramids"],country:"مصر",leagueId:"egypt",ovr:77,prestige:82,stars:["فيستون مايلي","مصطفى فتحي","وليد الكرتي","مهند لاشين","أحمد الشناوي","محمد الشيبي","إبراهيم عادل"]},
    {name:"المصري",aliases:["Al Masry","Al-Masry"],country:"مصر",leagueId:"egypt",ovr:70,prestige:74,stars:["صلاح محسن","باهر المحمدي","محمود حمادة"]},
    {name:"الإسماعيلي",aliases:["Ismaily SC","Ismaily"],country:"مصر",leagueId:"egypt",ovr:64,prestige:82,stars:["عبد الرحمن مجدي","محمد حسن","محمد بيومي"]},
    {name:"الرجاء",aliases:["Raja Club Athletic","Raja Casablanca"],country:"المغرب",leagueId:"morocco",ovr:73,prestige:87,stars:["آدم النفاتي","يوسف بلعمري","محمد زريدة"]},
    {name:"الوداد",aliases:["Wydad AC","Wydad Casablanca"],country:"المغرب",leagueId:"morocco",ovr:72,prestige:86,stars:["زكرياء ناسيك","أيوب العملود","منتصر لحتيمي"]},
    {name:"الجيش الملكي",aliases:["AS FAR","FAR Rabat"],country:"المغرب",leagueId:"morocco",ovr:73,prestige:82,stars:["رضى سليم","أمين زحزوح","يوسف الفحلي"]},
    {name:"نهضة بركان",aliases:["RS Berkane","Renaissance Sportive de Berkane"],country:"المغرب",leagueId:"morocco",ovr:72,prestige:81,stars:["يوسف زغودي","عادل تاحيف","ياسين البحيري"]},
    {name:"الترجي الرياضي",aliases:["Espérance de Tunis","Esperance Tunis","EST"],country:"تونس",leagueId:"tunisia",ovr:75,prestige:89,stars:["حمزة رفيعة","يوسف بيشة","أشرف جبري","محمد بن علي"]},
    {name:"النادي الإفريقي",aliases:["Club Africain"],country:"تونس",leagueId:"tunisia",ovr:69,prestige:84,stars:["أسامة الشريمي","غيث الزعلوني","حمدي العبيدي"]},
    {name:"النجم الساحلي",aliases:["Étoile du Sahel","Etoile du Sahel"],country:"تونس",leagueId:"tunisia",ovr:68,prestige:83,stars:["حمزة الجلاصي","يوسف العبدلي","أسامة عبيد"]},
    {name:"مولودية الجزائر",aliases:["MC Alger","Mouloudia Club d'Alger"],country:"الجزائر",leagueId:"algeria",ovr:72,prestige:87,stars:["يوسف بلايلي","عبد الرحمن مزيان","أكرم بوراس"]},
    {name:"اتحاد العاصمة",aliases:["USM Alger","Union Sportive Médina d'Alger"],country:"الجزائر",leagueId:"algeria",ovr:70,prestige:84,stars:["أسامة بن بوط","زين الدين بلعيد"]},
    {name:"شبيبة القبائل",aliases:["JS Kabylie","Jeunesse Sportive de Kabylie"],country:"الجزائر",leagueId:"algeria",ovr:69,prestige:83,stars:["رياض بودبوز","أيمن محيوس","سفيان بن دبكة"]},
    {name:"دياراف",aliases:["ASC Jaraaf","Jaraaf Dakar"],country:"السنغال",leagueId:"senegal",ovr:65,prestige:73,stars:["بابي ديمبا ديوب","مامادو لامين كامارا"]},
    {name:"جينيراسيون فوت",aliases:["Generation Foot"],country:"السنغال",leagueId:"senegal",ovr:64,prestige:70,stars:["لامين كامارا","بابي مسار"]},
    {name:"إنييمبا",aliases:["Enyimba FC","Enyimba"],country:"نيجيريا",leagueId:"nigeria",ovr:66,prestige:78,stars:["أوتشي كالو","إيمكا أوبا"]},
    {name:"ريفرز يونايتد",aliases:["Rivers United"],country:"نيجيريا",leagueId:"nigeria",ovr:65,prestige:73,stars:["أوكي أوغونديكا","فيستوس أوكون"]},
    {name:"أسانتي كوتوكو",aliases:["Asante Kotoko"],country:"غانا",leagueId:"ghana",ovr:66,prestige:81,stars:["ألبين غرانت","ستيفن أمبروسيوس"]},
    {name:"هارتس أوف أوك",aliases:["Hearts of Oak"],country:"غانا",leagueId:"ghana",ovr:64,prestige:79,stars:["كونادو ييادوم","محمد ألوه"]},
    {name:"فلامنغو",aliases:["Flamengo","CR Flamengo"],country:"البرازيل",leagueId:"brazil",ovr:84,prestige:91,stars:["جورجيان دي أراسكايتا","صامويل لينو","بيدرو","إريك بولغار","جورج كاراسكال","غونزالو بلاتا","أجوستين روسي","لويس أراوخو","دانييلو"]},
    {name:"بالميراس",aliases:["Palmeiras","SE Palmeiras"],country:"البرازيل",leagueId:"brazil",ovr:84,prestige:90,stars:["فيتور روكي","غوستافو غوميز","أندرياس بيريرا","جوني أرياس","باولينيو","فيليبي أندرسون","فلاكو لوبيز","موريلو","خواكين بيكيريز"]},
    {name:"بوتافوغو",aliases:["Botafogo FR","Botafogo"],country:"البرازيل",leagueId:"brazil",ovr:82,prestige:83,stars:["جون","ألكسندر باربوزا","إيغور جيسوس"]},
    {name:"كورينثيانز",aliases:["Corinthians","Sport Club Corinthians Paulista"],country:"البرازيل",leagueId:"brazil",ovr:79,prestige:89,stars:["ميمفيس ديباي","روميرو"]},
    {name:"ريفر بليت",aliases:["River Plate","Club Atlético River Plate"],country:"الأرجنتين",leagueId:"argentina",ovr:82,prestige:94,stars:["أنخيل كوريا","تياغو ألمادا","سيباستيان دروسي","غونزالو مونتييل","ماركوس أكونيا","نيكولاس أوتاميندي","فاوستو فيرا","أنبال مورينو","لوكاس بيلتران","رافائيل بوري"]},
    {name:"بوكا جونيورز",aliases:["Boca Juniors","CA Boca Juniors"],country:"الأرجنتين",leagueId:"argentina",ovr:81,prestige:96,stars:["لياندرو باريديس","ميغيل ميرينتييل","ميلتون خيمينيز","كيفن زينون","رودريغو باتاغليا","آلان فيلاسكو","آلفارو مونتيرو","أنخل روميرو","سيباستيان فيا"]},
    {name:"راسينغ كلوب",aliases:["Racing Club","Racing Club de Avellaneda"],country:"الأرجنتين",leagueId:"argentina",ovr:78,prestige:85,stars:["أدريان مارتينيز","خوان فيرنانديز"]},
    {name:"إنديبندينتي",aliases:["Independiente","CA Independiente"],country:"الأرجنتين",leagueId:"argentina",ovr:76,prestige:89,stars:["إيفان ماركوني","غابرييل أفيليس"]}
    {name:"كوفنتري سيتي",aliases:["Coventry City"],country:"إنجلترا",leagueId:"england",division:2,ovr:68,prestige:66,stars:[]},
    {name:"برمنغهام سيتي",aliases:["Birmingham City"],country:"إنجلترا",leagueId:"england",division:2,ovr:65,prestige:69,stars:[]},
    {name:"ريكسهام",aliases:["Wrexham AFC","Wrexham"],country:"إنجلترا",leagueId:"england",division:2,ovr:63,prestige:58,stars:[]},
    {name:"ديبورتيفو لاكورونيا",aliases:["Deportivo La Coruña","Deportivo La Coruna"],country:"إسبانيا",leagueId:"spain",division:2,ovr:64,prestige:77,stars:[]},
    {name:"لاس بالماس",aliases:["UD Las Palmas"],country:"إسبانيا",leagueId:"spain",division:2,ovr:65,prestige:68,stars:[]},
    {name:"شالكه 04",aliases:["Schalke 04","FC Schalke 04"],country:"ألمانيا",leagueId:"germany",division:2,ovr:65,prestige:83,stars:[]},
    {name:"هرتا برلين",aliases:["Hertha BSC","Hertha Berlin"],country:"ألمانيا",leagueId:"germany",division:2,ovr:64,prestige:81,stars:[]},
    {name:"باليرمو",aliases:["Palermo FC","Palermo"],country:"إيطاليا",leagueId:"italy",division:2,ovr:64,prestige:78,stars:[]},
    {name:"سامبدوريا",aliases:["UC Sampdoria","Sampdoria"],country:"إيطاليا",leagueId:"italy",division:2,ovr:62,prestige:85,stars:[]},
    {name:"سانت إيتيان",aliases:["AS Saint-Étienne","Saint-Etienne"],country:"فرنسا",leagueId:"france",division:2,ovr:65,prestige:82,stars:[]},
    {name:"المقاولون العرب",aliases:["Arab Contractors","Al Mokawloon Al Arab"],country:"مصر",leagueId:"egypt",division:2,ovr:62,prestige:63,stars:[]},
    {name:"وادي دجلة",aliases:["Wadi Degla"],country:"مصر",leagueId:"egypt",division:2,ovr:61,prestige:59,stars:[]},
    {name:"القناة",aliases:["El Qanah","El Qanah FC"],country:"مصر",leagueId:"egypt",division:2,ovr:59,prestige:55,stars:[]},
    {name:"كوريتِيبا",aliases:["Coritiba","Coritiba FC"],country:"البرازيل",leagueId:"brazil",division:2,ovr:69,prestige:78,stars:[]},
    {name:"غوياس",aliases:["Goiás Esporte Clube","Goias"],country:"البرازيل",leagueId:"brazil",division:2,ovr:68,prestige:75,stars:[]},
    {name:"ريال سرقسطة",aliases:["Real Zaragoza"],country:"إسبانيا",leagueId:"spain",division:2,ovr:63,prestige:76,stars:[]}
  ];


  var PLAYER_POSITION_HINTS = {
    "محمد الشناوي":"حارس مرمى","مصطفى شوبير":"حارس مرمى","تيبو كورتوا":"حارس مرمى","جوان غارسيا":"حارس مرمى","أليسون بيكر":"حارس مرمى",
    "فيرجيل فان دايك":"قلب دفاع","ماركينيوس":"قلب دفاع","روبن دياز":"قلب دفاع","جوناثان تاه":"قلب دفاع","غوستافو غوميز":"قلب دفاع",
    "أشرف حكيمي":"ظهير","جواو كانسيلو":"ظهير","ترنت ألكسندر أرنولد":"ظهير","ألفونسو ديفيز":"ظهير","محمد هاني":"ظهير","أحمد فتوح":"ظهير",
    "إمام عاشور":"وسط مهاجم","جود بيلينغهام":"وسط مهاجم","بيدري":"وسط مهاجم","جمال موسيالا":"وسط مهاجم","جواو نيفيز":"وسط دفاعي",
    "مروان عطية":"وسط دفاعي","جوشوا كيميش":"وسط دفاعي","إريك بولغار":"وسط دفاعي","أنبال مورينو":"وسط دفاعي",
    "كيليان مبابي":"مهاجم","إيرلينغ هالاند":"مهاجم","هاري كين":"مهاجم","ألكسندر إيزاك":"مهاجم","هوجو إيكيتيكي":"مهاجم","ناصر منسي":"مهاجم","عدي الدباغ":"مهاجم","فيتور روكي":"مهاجم","بيدرو":"مهاجم",
    "فينيسيوس جونيور":"جناح","لامين يامال":"جناح","رافينيا":"جناح","محمد صلاح":"جناح","عثمان ديمبيلي":"جناح","جورجيان دي أراسكايتا":"وسط مهاجم"
  };
  var PLAYER_OVR_HINTS = {
    "كيليان مبابي":93,"فينيسيوس جونيور":92,"جود بيلينغهام":91,"إيرلينغ هالاند":92,"لامين يامال":91,
    "هاري كين":91,"جمال موسيالا":90,"أشرف حكيمي":88,"عثمان ديمبيلي":89,"محمد الشناوي":83,
    "إمام عاشور":82,"محمد صلاح":90,"فيرجيل فان دايك":89,"ألكسندر إيزاك":88,"فلوريان فيرتز":90,
    "جورجيان دي أراسكايتا":86,"بيدري":90,"رافينيا":89,"برناردو سيلفا":88
  };
  function buildPlayerRecords(item) {
    return (item.stars || []).map(function (name, index) {
      var offsets = [4,3,2,1,0,-1,-2,-3];
      var estimate = PLAYER_OVR_HINTS[name];
      if (!Number.isFinite(estimate)) estimate = Math.max(42, Math.min(96, Number(item.ovr || 60) + offsets[index % offsets.length]));
      return {
        id: item.leagueId + "-" + normalize(name),
        name: name,
        clubName: item.name,
        country: item.country,
        leagueId: item.leagueId,
        division: Number(item.division) || 1,
        position: PLAYER_POSITION_HINTS[name] || "غير محدد",
        ovr: estimate,
        isRealPlayer: true,
        season: SEASON,
        ratingType: "simulation-estimate"
      };
    });
  }
  function normalize(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
  }
  function leagueById(id) { return LEAGUES.find(function (item) { return item.id === String(id); }) || null; }
  function leagueByCountry(country) {
    var target = normalize(country);
    return LEAGUES.find(function (item) { return normalize(item.country) === target || normalize(item.englishCountry) === target; }) || null;
  }
  function tournamentById(id) { return TOURNAMENTS.find(function (item) { return item.id === String(id); }) || null; }
  function clubsForCountry(country, division) {
    var profile = leagueByCountry(country);
    var targetDivision = Math.max(1, Number(division) || 1);
    if (!profile) return [];
    return CLUBS.filter(function (item) {
      return item.leagueId === profile.id && (Number(item.division) || 1) === targetDivision;
    }).slice().sort(function (a, b) {
      return b.ovr - a.ovr || a.name.localeCompare(b.name, "ar");
    }).map(function (item) { return normalizeClub(item); });
  }
  function findClub(name, country) {
    var target = normalize(name), profile = country ? leagueByCountry(country) : null;
    var list = CLUBS.filter(function (item) {
      if (profile && item.leagueId !== profile.id) return false;
      return normalize(item.name) === target || (item.aliases || []).some(function (alias) { return normalize(alias) === target; });
    });
    if (!list.length) list = CLUBS.filter(function (item) {
      return normalize(item.name) === target || (item.aliases || []).some(function (alias) { return normalize(alias) === target; });
    });
    return list[0] || null;
  }
  function normalizeClub(item) {
    var profile = leagueById(item.leagueId);
    var division = Math.max(1, Number(item.division) || 1);
    return {name:item.name,aliases:(item.aliases || []).slice(),country:item.country,leagueId:item.leagueId,division:division,
      leagueName:profile ? (division >= 2 ? profile.tier2 : profile.league) : "",
      leagueEnglish:profile ? (division >= 2 ? profile.tier2English : profile.english) : "",
      ovr:item.ovr,prestige:item.prestige,stars:(item.stars || []).slice(),players:buildPlayerRecords(item),
      season:SEASON,ratingType:"simulation-estimate",rosterStatus:(item.stars || []).length ? "curated-highlights" : "ratings-only"};
  }
  function leagueFor(country, division) {
    var profile = leagueByCountry(country);
    if (!profile) return null;
    var second = Number(division || 1) >= 2;
    return Object.assign({}, profile, {division:second ? 2 : 1,name:second ? profile.tier2 : profile.league,
      englishName:second ? profile.tier2English : profile.english,teamCount:second ? profile.tier2Teams : profile.teams,
      matchesPerSeason:second ? ({england:46,spain:42,germany:34,italy:38,france:34,portugal:34,egypt:22,morocco:30,tunisia:46,algeria:30,senegal:30,nigeria:38,ghana:34,brazil:38,argentina:34}[profile.id] || Math.max(22, 2 * (profile.tier2Teams - 1))) : profile.matches,
      globalTier:second ? 4 : profile.globalTier,strength:second ? Math.max(42, profile.strength - 18) : profile.strength,
      season:SEASON,officialUrl:profile.url,ratingNote:RATINGS_NOTE});
  }
  function competitionsForCountry(country, context) {
    var profile = leagueByCountry(country);
    if (!profile) return [];
    context = context || {};
    var division = Math.max(1, Number(context.division) || 1);
    var qualifiedWorld = !!(context.worldClubQualified || context.continentalChampion || context.worldClubQualifiedSeason === context.season);
    var ids = ["league"].concat(profile.cups).concat(profile.superCup ? [profile.superCup] : [])
      .concat(profile.continental)
      .concat(profile.confederation === "UEFA" ? ["uefa-super-cup"] : profile.confederation === "CAF" ? ["caf-super-cup"] : [])
      .concat(["fifa-club-world-cup"]);
    return ids.filter(function (id, index) { return ids.indexOf(id) === index; }).map(function (id) {
      var tournament = tournamentById(id);
      if (!tournament) return null;
      var status = "scheduled", label = "مجدولة / تتحدد حسب شروط التأهل";
      if (id === "league") { status = "active"; label = "بطولة الدوري المحلي"; }
      else if (tournament.kind === "domestic-cup") {
        if (division >= 2 && !tournament.lower) { status = "not-eligible"; label = "مقفولة على الدرجة الحالية"; }
        else { status = "scheduled"; label = "مقررة في جدول البطولات المحلي"; }
      } else if (tournament.kind === "continental") {
        status = "qualification-pending"; label = "التأهل يتحدد حسب ترتيب الدوري واللوائح القارية";
      } else if (tournament.kind === "supercup") {
        status = "conditional"; label = "تتفتح حسب نتائج الموسم السابق ولائحة البطولة";
      } else if (tournament.kind === "world") {
        status = qualifiedWorld ? "qualified" : "locked";
        label = qualifiedWorld ? "متأهل حسب سجل المسيرة" : "مقفولة لحد التأهل وفق لائحة FIFA";
      }
      var eligible = status !== "not-eligible" && status !== "locked" && status !== "conditional" && status !== "qualification-pending";
      return {id:tournament.id,name:id === "league" ? profile.league : tournament.name,kind:tournament.kind,system:tournament.system || "",
        season:context.season || SEASON,country:profile.country,leagueId:profile.id,confederation:tournament.confederation || profile.confederation,
        format:id === "league" ? profile.english + " • " + profile.matches + " مباراة مستهدفة بالموسم" : tournament.format,
        qualificationRule:tournament.qualification || "يحدد ترتيب الفريق المحلي مسار الموسم والتأهل القاري.",
        officialUrl:id === "league" ? profile.url : tournament.url || "",status:status,statusLabel:label,eligible:eligible,
        simulationSupported:!!(tournament.system && tournament.kind !== "supercup" && tournament.kind !== "league"),teams:(tournament.teams || []).slice()};
    }).filter(Boolean);
  }
  function simulationCupDefinitions() {
    return TOURNAMENTS.filter(function (item) {
      return item.id !== "league" && (!!item.system || item.kind === "supercup");
    }).map(function (item) {
      var countries = item.countries || [];
      var league = countries.length ? leagueById(countries[0]) : null;
      var region = league ? league.country : item.confederation === "UEFA" ? "أوروبا" :
        item.confederation === "CAF" ? "أفريقيا" : item.confederation === "CONMEBOL" ? "أمريكا الجنوبية" : "عالمي";
      return {
        id:item.id,name:item.name,region:region,format:item.format,system:item.system || (item.kind === "supercup" ? "supercup" : "knockout"),
        teams:(item.teams || []).slice(),countries:countries.slice(),confederation:item.confederation || (league && league.confederation) || "",
        officialUrl:item.url || "",kind:item.kind,qualification:item.qualification || "",
        qualificationPlaces:(item.qualificationPlaces || []).slice(),lower:!!item.lower,
        simulationRatingNote:"صيغة محاكاة داخل اللعبة؛ لا تمثل الجدول أو القرعة الرسمية الحية."
      };
    });
  }
  function profileSummary(country) {
    var p = leagueByCountry(country);
    if (!p) return null;
    return Object.assign({}, p, {season:SEASON,clubs:clubsForCountry(p.country,1),ratingNote:RATINGS_NOTE});
  }

  window.LWWorldDB = {
    version:VERSION,season:SEASON,ratingNote:RATINGS_NOTE,
    leagues:function () { return LEAGUES.map(function (item) { return profileSummary(item.country); }); },
    leagueById:leagueById,leagueByCountry:leagueByCountry,leagueFor:leagueFor,
    clubs:function () { return CLUBS.map(normalizeClub); },clubsForCountry:clubsForCountry,
    clubByName:function (name,country) { var item = findClub(name,country); return item ? normalizeClub(item) : null; },
    playersForClub:function (name,country) { var item = findClub(name,country); return item ? item.stars.slice() : []; },
    playerRecordsForClub:function (name,country) {
      var item = findClub(name,country);
      return item ? buildPlayerRecords(item).map(function (row) { return Object.assign({},row); }) : [];
    },
    playerByName:function (name,country) {
      var target=normalize(name), list=CLUBS.filter(function (club) {
        if(country && normalize(club.country)!==normalize(country)) return false;
        return (club.stars || []).some(function (star) { return normalize(star)===target; });
      });
      if(!list.length) return null;
      return buildPlayerRecords(list[0]).find(function (row) { return normalize(row.name)===target; }) || null;
    },
    tournamentById:tournamentById,allTournaments:function () { return TOURNAMENTS.map(function (item) {
      return Object.assign({},item,{teams:(item.teams || []).slice(),countries:(item.countries || []).slice(),qualificationPlaces:(item.qualificationPlaces || []).slice()});
    }); },
    competitionsForCountry:competitionsForCountry,simulationCupDefinitions:simulationCupDefinitions,
    profileForClub:function (name) { var item=findClub(name);return item?profileSummary(item.country):null; },
    clubPower:function (name,country) { var item=findClub(name,country);return item?item.ovr:null; },normalize:normalize
  };
})();
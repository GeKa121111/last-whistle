/* Curated football league/club layer for LAST WHISTLE.
 * OVR and prestige are gameplay estimates, not official ratings.
 * Player names are selected squad highlights, not complete registration lists.
 */
(function () {
  "use strict";
  var VERSION = 4;
  var SEASON = "2026/27";
  var RATINGS_NOTE = "قوة الأندية والتقييمات تقديرات توازن داخل اللعبة. الأسماء من قوائم أندية 2026/27 المتاحة موثقة بمصدرها؛ أي اسم ناشئ مولّد موسوم داخل البيانات وليس لاعبًا حقيقيًا.";
  var LEAGUES = [
    {id:"england",country:"إنجلترا",englishCountry:"England",league:"الدوري الإنجليزي الممتاز",english:"Premier League",tier2:"دوري البطولة الإنجليزية",tier2English:"EFL Championship",confederation:"UEFA",globalTier:1,strength:98,teams:20,matches:38,tier2Teams:24,currency:"£",cups:["fa-cup","efl-cup"],superCup:"community-shield",continental:["ucl","uel","uecl"],url:"https://www.premierleague.com/"},
    {id:"spain",country:"إسبانيا",englishCountry:"Spain",league:"الدوري الإسباني الدرجة الأولى",english:"LaLiga",tier2:"الدوري الإسباني الدرجة الثانية",tier2English:"LaLiga Hypermotion",confederation:"UEFA",globalTier:1,strength:96,teams:20,matches:38,tier2Teams:22,currency:"€",cups:["copa-del-rey"],superCup:"spanish-super-cup",continental:["ucl","uel","uecl"],url:"https://www.laliga.com/"},
    {id:"germany",country:"ألمانيا",englishCountry:"Germany",league:"الدوري الألماني الدرجة الأولى",english:"Bundesliga",tier2:"الدوري الألماني الدرجة الثانية",tier2English:"2. Bundesliga",confederation:"UEFA",globalTier:1,strength:94,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["dfb-pokal"],superCup:"german-super-cup",continental:["ucl","uel","uecl"],url:"https://www.bundesliga.com/"},
    {id:"italy",country:"إيطاليا",englishCountry:"Italy",league:"الدوري الإيطالي الدرجة الأولى",english:"Serie A",tier2:"الدوري الإيطالي الدرجة الثانية",tier2English:"Serie B",confederation:"UEFA",globalTier:1,strength:93,teams:20,matches:38,tier2Teams:20,currency:"€",cups:["coppa-italia"],superCup:"italian-super-cup",continental:["ucl","uel","uecl"],url:"https://www.legaseriea.it/"},
    {id:"france",country:"فرنسا",englishCountry:"France",league:"الدوري الفرنسي الدرجة الأولى",english:"Ligue 1",tier2:"الدوري الفرنسي الدرجة الثانية",tier2English:"Ligue 2",confederation:"UEFA",globalTier:1,strength:91,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["coupe-de-france"],superCup:"trophee-des-champions",continental:["ucl","uel","uecl"],url:"https://ligue1.com/"},
    {id:"portugal",country:"البرتغال",englishCountry:"Portugal",league:"الدوري البرتغالي الممتاز",english:"Primeira Liga",tier2:"الدوري البرتغالي الدرجة الثانية",tier2English:"Liga Portugal 2",confederation:"UEFA",globalTier:1,strength:88,teams:18,matches:34,tier2Teams:18,currency:"€",cups:["taca-portugal","taca-liga"],superCup:"portuguese-super-cup",continental:["ucl","uel","uecl"],url:"https://www.ligaportugal.pt/"},
    {id:"turkey",country:"تركيا",englishCountry:"Turkey",league:"الدوري التركي الممتاز",english:"Süper Lig",tier2:"دوري الدرجة الأولى التركي",tier2English:"TFF 1. Lig",confederation:"UEFA",globalTier:2,strength:82,teams:18,matches:34,tier2Teams:20,currency:"€",cups:["turkish-cup"],superCup:"turkish-super-cup",continental:["ucl","uel","uecl"],url:"https://www.tff.org/"},
    {id:"netherlands",country:"هولندا",englishCountry:"Netherlands",league:"الدوري الهولندي الممتاز",english:"Eredivisie",tier2:"دوري الدرجة الأولى الهولندي",tier2English:"Eerste Divisie",confederation:"UEFA",globalTier:1,strength:86,teams:18,matches:34,tier2Teams:20,currency:"€",cups:["dutch-cup"],superCup:"dutch-super-cup",continental:["ucl","uel","uecl"],url:"https://eredivisie.nl/"},
    {id:"belgium",country:"بلجيكا",englishCountry:"Belgium",league:"الدوري البلجيكي الممتاز",english:"Belgian Pro League",tier2:"دوري التحدي البلجيكي",tier2English:"Challenger Pro League",confederation:"UEFA",globalTier:2,strength:82,teams:18,matches:34,tier2Teams:16,currency:"€",cups:["belgian-cup"],superCup:"belgian-super-cup",continental:["ucl","uel","uecl"],url:"https://www.rbfa.be/"},
    {id:"greece",country:"اليونان",englishCountry:"Greece",league:"الدوري اليوناني الممتاز",english:"Super League Greece",tier2:"دوري السوبر اليوناني 2",tier2English:"Super League 2",confederation:"UEFA",globalTier:2,strength:80,teams:14,matches:26,tier2Teams:16,currency:"€",cups:["greek-cup"],superCup:null,continental:["ucl","uel","uecl"],url:"https://www.slgr.gr/"},
    {id:"scotland",country:"اسكتلندا",englishCountry:"Scotland",league:"الدوري الاسكتلندي الممتاز",english:"Scottish Premiership",tier2:"دوري البطولة الاسكتلندي",tier2English:"Scottish Championship",confederation:"UEFA",globalTier:2,strength:80,teams:12,matches:38,tier2Teams:10,currency:"£",cups:["scottish-cup","scottish-league-cup"],superCup:null,continental:["ucl","uel","uecl"],url:"https://spfl.co.uk/"},
    {id:"egypt",country:"مصر",englishCountry:"Egypt",league:"الدوري المصري الممتاز",english:"Egyptian Premier League",tier2:"دوري الدرجة الثانية المصري",tier2English:"Egyptian Second Division",confederation:"CAF",globalTier:3,strength:76,teams:20,matches:34,tier2Teams:12,currency:"ج.م",cups:["egypt-cup","egypt-league-cup"],superCup:"egyptian-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.efa.com.eg/"},
    {id:"morocco",country:"المغرب",englishCountry:"Morocco",league:"البطولة الاحترافية المغربية",english:"Botola Pro",tier2:"القسم الثاني المغربي",tier2English:"Botola 2",confederation:"CAF",globalTier:3,strength:72,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["morocco-throne-cup"],superCup:"morocco-super-cup",continental:["caf-cl","caf-confed"],url:"https://frmf.ma/"},
    {id:"tunisia",country:"تونس",englishCountry:"Tunisia",league:"الرابطة التونسية المحترفة الأولى",english:"Tunisian Ligue Professionnelle 1",tier2:"الرابطة التونسية المحترفة الثانية",tier2English:"Ligue 2",confederation:"CAF",globalTier:3,strength:70,teams:16,matches:30,tier2Teams:24,currency:"$",cups:["tunisia-cup"],superCup:"tunisia-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.ftf.org.tn/"},
    {id:"algeria",country:"الجزائر",englishCountry:"Algeria",league:"الرابطة الجزائرية المحترفة الأولى",english:"Ligue Professionnelle 1",tier2:"الرابطة الجزائرية الثانية",tier2English:"Ligue 2",confederation:"CAF",globalTier:3,strength:69,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["algeria-cup"],superCup:"algeria-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.faf.dz/"},
    {id:"senegal",country:"السنغال",englishCountry:"Senegal",league:"الدوري السنغالي الممتاز",english:"Senegal Premier League",tier2:"الدرجة الثانية السنغالية",tier2English:"Senegal Ligue 2",confederation:"CAF",globalTier:3,strength:64,teams:16,matches:30,tier2Teams:16,currency:"$",cups:["senegal-cup"],superCup:null,continental:["caf-cl","caf-confed"],url:"https://fsfoot.sn/"},
    {id:"nigeria",country:"نيجيريا",englishCountry:"Nigeria",league:"الدوري النيجيري الممتاز",english:"Nigeria Premier Football League",tier2:"الدوري النيجيري الوطني",tier2English:"Nigeria National League",confederation:"CAF",globalTier:3,strength:64,teams:20,matches:38,tier2Teams:20,currency:"$",cups:["nigeria-cup"],superCup:"nigeria-super-cup",continental:["caf-cl","caf-confed"],url:"https://thenff.com/"},
    {id:"ghana",country:"غانا",englishCountry:"Ghana",league:"الدوري الغاني الممتاز",english:"Ghana Premier League",tier2:"الدرجة الأولى الغانية",tier2English:"Division One League",confederation:"CAF",globalTier:3,strength:62,teams:18,matches:34,tier2Teams:48,currency:"$",cups:["ghana-fa-cup"],superCup:"ghana-super-cup",continental:["caf-cl","caf-confed"],url:"https://www.ghanafa.org/"},
    {id:"brazil",country:"البرازيل",englishCountry:"Brazil",league:"الدوري البرازيلي الدرجة الأولى",english:"Campeonato Brasileiro Série A",tier2:"الدوري البرازيلي الدرجة الثانية",tier2English:"Série B",confederation:"CONMEBOL",globalTier:2,strength:84,teams:20,matches:38,tier2Teams:20,currency:"$",cups:["copa-do-brasil"],superCup:"brazilian-super-cup",continental:["libertadores","sudamericana"],url:"https://www.cbf.com.br/"},
    {id:"argentina",country:"الأرجنتين",englishCountry:"Argentina",league:"الدوري الأرجنتيني للمحترفين",english:"Liga Profesional de Fútbol",tier2:"الدرجة الثانية الأرجنتينية",tier2English:"Primera Nacional",confederation:"CONMEBOL",globalTier:2,strength:82,teams:30,matches:30,tier2Teams:36,currency:"$",cups:["copa-argentina"],superCup:"argentina-super-cup",continental:["libertadores","sudamericana"],url:"https://www.afa.com.ar/"}
  ];
  var ELIGIBLE_CONTINENTAL_TOURNAMENTS = ["ucl", "caf-cl", "libertadores"];
  LEAGUES = LEAGUES.filter(function (league) {
    return (league.continental || []).some(function (tournamentId) {
      return ELIGIBLE_CONTINENTAL_TOURNAMENTS.indexOf(tournamentId) >= 0;
    });
  });

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
    {id:"turkish-cup",name:"Turkish Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.tff.org/",format:"كأس تركيا بخروج المغلوب وفق لائحة الموسم.",qualification:"حسب لوائح الاتحاد التركي لكرة القدم.",countries:["turkey"],lower:true,teams:["Galatasaray","Fenerbahçe","Beşiktaş","Trabzonspor"]},
    {id:"turkish-super-cup",name:"Turkish Super Cup",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.tff.org/",format:"كأس السوبر التركي وفق نظام الموسم.",qualification:"حسب نتائج الدوري والكأس واللائحة الرسمية.",countries:["turkey"]},
    {id:"dutch-cup",name:"KNVB Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.knvb.nl/",format:"كأس هولندا بخروج المغلوب.",qualification:"حسب لوائح الاتحاد الهولندي.",countries:["netherlands"],lower:true,teams:["Ajax","PSV Eindhoven","Feyenoord"]},
    {id:"dutch-super-cup",name:"Johan Cruyff Shield",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.knvb.nl/",format:"مباراة السوبر الهولندي وفق لائحة الموسم.",qualification:"بطل الدوري والكأس وفق اللائحة.",countries:["netherlands"]},
    {id:"belgian-cup",name:"Belgian Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.rbfa.be/",format:"كأس بلجيكا بخروج المغلوب.",qualification:"حسب لوائح الاتحاد البلجيكي.",countries:["belgium"],lower:true,teams:["Club Brugge","Anderlecht","Union Saint-Gilloise"]},
    {id:"belgian-super-cup",name:"Belgian Super Cup",kind:"supercup",confederation:"UEFA",system:"supercup",url:"https://www.rbfa.be/",format:"كأس السوبر البلجيكي وفق لائحة الموسم.",qualification:"حسب نتائج الدوري والكأس.",countries:["belgium"]},
    {id:"greek-cup",name:"Greek Football Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.epo.gr/",format:"كأس اليونان بخروج المغلوب.",qualification:"حسب لوائح الاتحاد اليوناني.",countries:["greece"],lower:true,teams:["Olympiakos","AEK","PAOK","Panathinaikos"]},
    {id:"scottish-cup",name:"Scottish Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://www.scottishfa.co.uk/",format:"كأس اسكتلندا بخروج المغلوب.",qualification:"حسب لوائح الاتحاد الاسكتلندي.",countries:["scotland"],lower:true,teams:["Celtic","Rangers","Heart of Midlothian"]},
    {id:"scottish-league-cup",name:"Scottish League Cup",kind:"domestic-cup",confederation:"UEFA",system:"knockout",url:"https://spfl.co.uk/",format:"كأس الرابطة الاسكتلندي.",qualification:"حسب لوائح المسابقة.",countries:["scotland"],teams:["Celtic","Rangers","Aberdeen"]},
    {id:"japanese-cup",name:"Emperor’s Cup",kind:"domestic-cup",confederation:"AFC",system:"knockout",url:"https://www.jfa.jp/",format:"كأس الإمبراطور الياباني بخروج المغلوب.",qualification:"حسب لوائح الاتحاد الياباني.",countries:["japan"],lower:true,teams:["Kashima Antlers","Urawa Red Diamonds","Vissel Kobe"]},
    {id:"japanese-super-cup",name:"Japanese Super Cup",kind:"supercup",confederation:"AFC",system:"supercup",url:"https://www.jfa.jp/",format:"كأس السوبر الياباني وفق لائحة الموسم.",qualification:"بطل الدوري والكأس وفق اللائحة.",countries:["japan"]},
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
    {id:"afc-cl",name:"AFC Champions League Elite",kind:"continental",confederation:"AFC",system:"afc-knockout",url:"https://www.the-afc.com/",format:"بطولة أندية آسيا للنخبة؛ المحاكاة تقريبية حسب التأهل القاري.",qualification:"حسب لوائح الاتحاد الآسيوي والبطولات المحلية."},
    {id:"afc-cl-two",name:"AFC Champions League Two",kind:"continental",confederation:"AFC",system:"afc-knockout",url:"https://www.the-afc.com/",format:"بطولة أندية آسيا الثانية؛ المحاكاة تقريبية حسب التأهل القاري.",qualification:"حسب لوائح الاتحاد الآسيوي والبطولات المحلية."},
    {id:"libertadores",name:"Copa Libertadores",kind:"continental",confederation:"CONMEBOL",system:"conmebol",url:"https://www.conmebol.com/libertadores/",format:"مراحل تأهيل ومجموعات ثم أدوار إقصائية.",qualification:"حسب ترتيب الدوري والكؤوس ولوائح CONMEBOL.",teams:["فلامنغو","بالميراس","ريفر بليت","بوكا جونيورز","بوتافوغو"]},
    {id:"sudamericana",name:"Copa Sudamericana",kind:"continental",confederation:"CONMEBOL",system:"conmebol",url:"https://www.conmebol.com/sudamericana/",format:"بطولة قارية بمراحل تأهيل وإقصاء.",qualification:"حسب ترتيب الدوري ولوائح CONMEBOL.",teams:["كورينثيانز","راسينغ كلوب","إنديبندينتي"]},
    {id:"fifa-club-world-cup",name:"FIFA Club World Cup",kind:"world",confederation:"FIFA",system:"world32",url:"https://www.fifa.com/tournaments/mens/club-world-cup",format:"بطولة عالمية للأندية المؤهلة وفق دورة ولوائح FIFA.",qualification:"المشاركة لا تتم تلقائيًا؛ يلزم التأهل وفق لوائح FIFA.",teams:["ريال مدريد","مانشستر سيتي","الأهلي","فلامنغو","بالميراس","ريفر بليت"]}
  ];
  // No Asian league remains in this game scope, so do not surface orphan AFC competitions.
  TOURNAMENTS = TOURNAMENTS.filter(function (item) { return item.confederation !== "AFC"; });

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
    {name:"إنديبندينتي",aliases:["Independiente","CA Independiente"],country:"الأرجنتين",leagueId:"argentina",ovr:76,prestige:89,stars:["إيفان ماركوني","غابرييل أفيليس"]},
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


  // Import a checked-in current-roster snapshot when available. The game does not fetch
  // roster data at runtime; this overlay keeps offline/Pages launches deterministic.
  var SQUAD_SNAPSHOT = window.LWFootballSquadData && Array.isArray(window.LWFootballSquadData.leagues)
    ? Object.assign({}, window.LWFootballSquadData, {
      leagues: window.LWFootballSquadData.leagues.filter(function (sourceLeague) {
        var profile = LEAGUES.find(function (league) { return league.id === sourceLeague.leagueId; });
        return !!profile && (profile.continental || []).some(function (tournamentId) {
          return ELIGIBLE_CONTINENTAL_TOURNAMENTS.indexOf(tournamentId) >= 0;
        });
      })
    }) : { leagues: [] };
  var IMPORTED_CLUB_COUNT = 0;
  var IMPORTED_PLAYER_COUNT = 0;
  function clubMatchKey(value) {
    var key = normalize(value);
    key = key.replace(/^(afc|fc|cf|sc)/, "");
    key = key.replace(/(footballclub|athleticclub|club|fc|afc|cf|sc|ac)$/, "");
    return key;
  }
  function estimatedClubPower(leagueId, division, index) {
    var profile = leagueById(leagueId) || {};
    var base = Number(profile.strength) || 60;
    if (Number(division) >= 2) base -= 18;
    var stableNoise = ((normalize(leagueId + "|" + division + "|" + index).split("").reduce(function (sum, ch) {
      return (sum * 33 + ch.charCodeAt(0)) >>> 0;
    }, 5381) % 11) - 5);
    return Math.max(42, Math.min(88, base + stableNoise));
  }
  function estimateImportedPlayer(player, club, index) {
    var base = Number(club.ovr) || 58;
    var age = Number(player.age) || 23;
    var position = String(player.position || "وسط مهاجم");
    var roleAdjust = position.indexOf("حارس") >= 0 ? -1
      : position.indexOf("مهاجم") >= 0 ? 1
      : position.indexOf("دفاع") >= 0 ? 0 : 1;
    var nameHash = normalize(player.name).split("").reduce(function (sum, ch) {
      return (Math.imul(sum ^ ch.charCodeAt(0), 16777619) >>> 0);
    }, 2166136261);
    var ageAdjust = age <= 21 ? 2 : age >= 31 ? -3 : age >= 28 ? -1 : 0;
    var ovr = Math.max(40, Math.min(92, Math.round(base - 3 + roleAdjust + ageAdjust + ((nameHash + index * 7) % 9) - 4)));
    return {
      id: club.leagueId + "-" + normalize(player.name),
      name: player.name,
      clubName: club.name,
      country: club.country,
      leagueId: club.leagueId,
      division: Number(club.division) || 1,
      position: position,
      ovr: ovr,
      potential: Math.min(96, ovr + (age <= 22 ? 8 : age <= 26 ? 4 : 1)),
      age: age,
      isRealPlayer: true,
      jerseyNumber: Number(player.number) || null,
      nationality: player.nationality || "",
      dateOfBirth: player.dob || "",
      season: SEASON,
      source: player.source || SQUAD_SNAPSHOT.source || "Current squad snapshot",
      ratingType: "simulation-estimate"
    };
  }
  var MANUAL_FIRST_DIVISION_CLUBS = [
    // Egypt — current 2026/27 first-division participants; clubs without sourced squad pages get explicit generated backups.
    {leagueId:"egypt",country:"مصر",division:1,name:"الاتحاد السكندري",aliases:["Al Ittihad Alexandria","Al-Ittihad Alexandria","Al Ittihad"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"أبو قير للأسمدة",aliases:["Abou Qir","Abu Qir Fertilizers"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"بترول أسيوط",aliases:["Asyut Petroleum","Petroleum Assiut"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"سيراميكا كليوباترا",aliases:["Ceramica Cleopatra"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"الجونة",aliases:["El Gouna"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"إنبي",aliases:["ENPPI"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"غزل المحلة",aliases:["Ghazl El Mahalla"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"مودرن سبورت",aliases:["Modern Future FC","Modern Sport","Future FC"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"البنك الأهلي",aliases:["National Bank of Egypt","National Bank"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"الأهلي",aliases:["Al Ahly","Al Ahly SC","Al-Ahly"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"الزمالك",aliases:["Zamalek","Zamalek SC"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"المصري",aliases:["Al Masry","Al Masry SC"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"بيراميدز",aliases:["Pyramids FC","Pyramids"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"وادي دجلة",aliases:["Wadi Degla"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"المقاولون العرب",aliases:["Arab Contractors","Al Mokawloon Al Arab"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"القناة",aliases:["El Qanah","El Qanah FC"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"سموحة",aliases:["Smouha SC","Smouha"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"بتروجيت",aliases:["Petrojet"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"طلائع الجيش",aliases:["Tala'ea El Geish","El Geish"]},
    {leagueId:"egypt",country:"مصر",division:1,name:"زد",aliases:["ZED FC","ZED"]},
    // Morocco — Botola Pro 1.
    {leagueId:"morocco",country:"المغرب",division:1,name:"أمل تزنيت",aliases:["US Amal Tiznit","Amal Tiznit"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"النادي المكناسي",aliases:["CODM Meknès","CODM Meknes"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"الدفاع الحسني الجديدي",aliases:["Difaâ El Jadida","Difaa Hassani El Jadidi"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"الفتح الرباطي",aliases:["FUS Rabat","Fath Union Sport"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"حسنية أكادير",aliases:["Hassania Agadir","HUSA"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"اتحاد طنجة",aliases:["Ittihad Tanger","IRT"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"الكوكب المراكشي",aliases:["Kawkab Marrakech"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"المغرب الفاسي",aliases:["Maghreb Fès","Maghreb Fes","MAS Fes"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"المغرب التطواني",aliases:["Moghreb Tétouan","Moghreb Tetouan","MAT"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"نهضة الزمامرة",aliases:["CR Khemis Zemamra","Renaissance Club Athletic Zemamra"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"الاتحاد التوركي",aliases:["UTS Rabat","Union Touarga Sportif"]},
    {leagueId:"morocco",country:"المغرب",division:1,name:"وداد تمارة",aliases:["Widad Témara","Widad Temara"]},
    // Tunisia — Ligue Professionnelle 1 2026/27.
    {leagueId:"tunisia",country:"تونس",division:1,name:"مستقبل المرسى",aliases:["AS Marsa","AS La Marsa"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"النادي الرياضي البنزرتي",aliases:["CA Bizertin","CAB"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"النادي الرياضي الصفاقسي",aliases:["CS Sfaxien","CS Sfaxien","CSS"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"النجم الرياضي بحمام سوسة",aliases:["ES Hammam Sousse","ESHS"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"النجم الرياضي بالمتلوي",aliases:["ES Métlaoui","ES Metlaoui","ESM"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"الترجي الجرجيسي",aliases:["ES Zarzis","ESZ"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"شبيبة العمران",aliases:["JS El Omrane","JSO"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"الأولمبي الباجي",aliases:["Olympique Béja","Olympique Beja","OB"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"الملعب التونسي",aliases:["Stade Tunisien","ST"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"الاتحاد الرياضي ببن قردان",aliases:["US Ben Guerdane","USBG"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"الاتحاد المنستيري",aliases:["US Monastir","USM"]},
    {leagueId:"tunisia",country:"تونس",division:1,name:"النادي الرياضي بحمام الأنف",aliases:["CS Hammam-Lif","CSHL"]},
    // Algeria — Ligue 1 2026/27.
    {leagueId:"algeria",country:"الجزائر",division:1,name:"أولمبي الشلف",aliases:["ASO Chlef"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"شباب بلوزداد",aliases:["CR Belouizdad"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"شباب قسنطينة",aliases:["CS Constantine"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"نجم بن عكنون",aliases:["ES Ben Aknoun"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"ترجي مستغانم",aliases:["ES Mostaganem"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"وفاق سطيف",aliases:["ES Sétif","ES Setif"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"شبيبة الساورة",aliases:["JS Saoura"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"مستقبل الرويسات",aliases:["MB Rouissat"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"مولودية البيض",aliases:["MC El Bayadh"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"مولودية وهران",aliases:["MC Oran"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"أولمبيك أقبو",aliases:["O Akbou","Olympique Akbou"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"نادي بارادو",aliases:["Paradou AC"]},
    {leagueId:"algeria",country:"الجزائر",division:1,name:"اتحاد خنشلة",aliases:["USM Khenchela"]},
    // Senegal — Ligue 1 2026/27.
    {leagueId:"senegal",country:"السنغال",division:1,name:"أجيل روفيسك",aliases:["AJEL de Rufisque","AJEL Rufisque"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"أكاديمية بيكين",aliases:["AS Pikine","Pikine"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"كازا سبورت",aliases:["Casa Sports","Casa-Sports"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"داكار ساكر كور",aliases:["Dakar Sacré-Cœur","Dakar Sacre-Coeur"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"ديامبارز",aliases:["Diambars","Diambars de Saly"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"إيساماي",aliases:["Essamaye FC"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"غيدياواي",aliases:["Guédiawaye FC","Guediawaye"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"إتش إل إم داكار",aliases:["ASC HLM Dakar","HLM"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"لا لينغير",aliases:["La Linguère","La Linguere","ASC La Linguère"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"ملعب مبور",aliases:["Stade de Mbour","Stade Mbour"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"تيونغيث",aliases:["Teungueth FC","Teungueth Rufisque"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"يو إس غوري",aliases:["US Gorée","US Goree"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"يو إس واكام",aliases:["US Ouakam"]},
    {leagueId:"senegal",country:"السنغال",division:1,name:"والي دان",aliases:["Wally Daan","Wally Daan FC"]},
    // Nigeria — NPFL 2026/27.
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"نيجر تورنادوز",aliases:["Niger Tornadoes FC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"كون خليفات",aliases:["Kun Khalifat FC","Kun Khalifat Football Club"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"ناساراوا يونايتد",aliases:["Nasarawa United FC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"إيكيورودو سيتي",aliases:["Ikorodu City FC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"كاتسينا يونايتد",aliases:["Katsina United FC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"سبورتينغ لاغوس",aliases:["Sporting Lagos"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"كانو بيلارز",aliases:["Kano Pillars"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"إنتر لاغوس",aliases:["Inter Lagos"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"رينجرز إنترناشيونال",aliases:["Rangers International","Enugu Rangers"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"واري وولفز",aliases:["Warri Wolves"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"دوما يونايتد",aliases:["Doma United"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"باراو",aliases:["Barau FC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"رانشرز بيز",aliases:["Ranchers Bees"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"بندل إنشورانس",aliases:["Bendel Insurance"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"بلاتو يونايتد",aliases:["Plateau United"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"شوتينغ ستارز",aliases:["Shooting Stars Sports Club","3SC"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"كوارا يونايتد",aliases:["Kwara United"]},
    {leagueId:"nigeria",country:"نيجيريا",division:1,name:"أبيا ووريورز",aliases:["Abia Warriors"]},
    // Ghana — Premier League 2026/27.
    {leagueId:"ghana",country:"غانا",division:1,name:"أدوانا ستارز",aliases:["Aduana FC","Aduana Stars"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"أشانتي غولد 04",aliases:["Ashantigold '04","Ashanti Gold"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"باساكي هولي ستارز",aliases:["Basake Holy Stars"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"بيشيم يونايتد",aliases:["Bechem United"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"بيركوم تشيلسي",aliases:["Berekum Chelsea"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"بيبياني غولد ستارز",aliases:["Bibiani Gold Stars"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"ديبيبي يونايتد",aliases:["Debibi United"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"دريمز إف سي",aliases:["Dreams FC"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"هارت أوف ليونز",aliases:["Heart of Lions"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"كاريلا يونايتد",aliases:["Karela United"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"ميديما",aliases:["Medeama SC","Medeama"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"بورت سيتي",aliases:["Port City FC","Port City"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"سامارتكس",aliases:["Samartex FC","FC Samartex"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"سْوِدرو أول بلاكس",aliases:["Swedru All Blacks"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"فيجن إف سي",aliases:["Vision FC"]},
    {leagueId:"ghana",country:"غانا",division:1,name:"يونغ أبوستلز",aliases:["Young Apostles FC"]},
    // Argentina — 2026 first division clubs.
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"ألدوسيفي",aliases:["Aldosivi"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"أرجنتينوس جونيورز",aliases:["Argentinos Juniors","Argentinos"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"أتلتيكو توكومان",aliases:["Atlético Tucumán","Atletico Tucuman"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"بانفيلد",aliases:["Banfield"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"باراكاس سنترال",aliases:["Barracas Central"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"بيلغرانو",aliases:["Belgrano"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"روساريو سنترال",aliases:["Rosario Central","Central"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"سنترال كوردوبا",aliases:["Central Córdoba","Central Cordoba"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"ديفينسا خوستيكا",aliases:["Defensa y Justicia","Defensa"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"إستوديانتس لا بلاتا",aliases:["Estudiantes de La Plata"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"إستوديانتس ريو كوارتو",aliases:["Estudiantes de Río Cuarto","Estudiantes de Rio Cuarto"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"خيمناسيا لا بلاتا",aliases:["Gimnasia La Plata"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"خيمناسيا ميندوزا",aliases:["Gimnasia de Mendoza","Gimnasia (Mendoza)"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"هوراكان",aliases:["Huracán","Huracan"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"إنديبندينتي ريفادافيا",aliases:["Independiente Rivadavia"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"إنستيتوتو",aliases:["Instituto"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"لانوس",aliases:["Lanús","Lanus"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"نيويلز أولد بويز",aliases:["Newell's Old Boys","Newell’s"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"بلاتينسي",aliases:["Platense"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"دِيِسترا",aliases:["Deportivo Riestra","Riestra"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"سان لورينزو",aliases:["San Lorenzo"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"سارمينتو",aliases:["Sarmiento"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"تالريريس",aliases:["Talleres"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"تيغري",aliases:["Tigre"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"يونيون سانتا في",aliases:["Unión","Union"]},
    {leagueId:"argentina",country:"الأرجنتين",division:1,name:"فيليز سارسفيلد",aliases:["Vélez Sarsfield","Velez"]},
    // Brazilian top-flight clubs are fully imported via the roster refresh. This registry catches any missing entry.
  ];

  function applyManualClubRegistry() {
    MANUAL_FIRST_DIVISION_CLUBS.forEach(function (entry, index) {
      var candidates = [entry.name].concat(entry.aliases || []);
      var found = CLUBS.find(function (club) {
        if (club.leagueId !== entry.leagueId) return false;
        return [club.name].concat(club.aliases || []).some(function (name) {
          var key = clubMatchKey(name);
          return candidates.some(function (candidate) {
            var compare = clubMatchKey(candidate);
            return key && compare && key === compare;
          });
        });
      });
      if (found) {
        // Explicit 2026/27 current top-flight participants override outdated stored divisions.
        found.division = 1;
        found.aliases = Array.from(new Set((found.aliases || []).concat(candidates)));
      } else {
        var power = estimatedClubPower(entry.leagueId, 1, index);
        CLUBS.push({name:entry.name,aliases:candidates.slice(1),country:entry.country,
          leagueId:entry.leagueId,division:1,ovr:power,prestige:Math.max(35,Math.min(94,power+4)),stars:[],
          rosterSource:"generated-squad; no verified full roster source"});
      }
    });
    // Ismaily did not appear in the current official 20-club Egyptian league list.
    var ismaily = CLUBS.find(function (club) { return club.leagueId === "egypt" && club.aliases && club.aliases.some(function(alias){return clubMatchKey(alias)==="ismaily";}); });
    if (ismaily && ismaily.name === "الإسماعيلي") ismaily.division = 2;
  }
  applyManualClubRegistry();

  function applyImportedSquads() {
    var imported = [];
    (SQUAD_SNAPSHOT.leagues || []).forEach(function (league) {
      (league.clubs || []).forEach(function (sourceClub, sourceIndex) {
        if (!sourceClub || !sourceClub.name || !Array.isArray(sourceClub.players) || !sourceClub.players.length) return;
        var sourceKey = clubMatchKey(sourceClub.name);
        var aliases = [sourceClub.name].concat(sourceClub.aliases || []);
        var found = CLUBS.find(function (club) {
          if (club.leagueId !== league.leagueId || (Number(club.division) || 1) !== Number(league.division || 1)) return false;
          return [club.name].concat(club.aliases || []).some(function (name) {
            var key = clubMatchKey(name);
            return key && (key === sourceKey || aliases.some(function (alias) { return key === clubMatchKey(alias); }));
          });
        });
        var profile = leagueById(league.leagueId) || {};
        if (!found) {
          var power = estimatedClubPower(league.leagueId, league.division, sourceIndex);
          found = {
            name: sourceClub.name,
            aliases: aliases,
            country: league.country || profile.country || "",
            leagueId: league.leagueId,
            division: Math.max(1, Number(league.division) || 1),
            ovr: power,
            prestige: Math.max(40, Math.min(92, power + 4)),
            stars: [],
            fullRoster: [],
            rosterSource: sourceClub.source || SQUAD_SNAPSHOT.source || "Current squad snapshot"
          };
          CLUBS.push(found);
        } else {
          // Keep the curated Arabic display name, club strength and highlight names;
          // fullRoster stores the complete sourced squad independently.
          found.division = Math.max(1, Number(league.division) || 1);
          found.aliases = Array.from(new Set((found.aliases || []).concat(aliases)));
        }
        var rosterSeen = new Set();
        var fullRoster = sourceClub.players.map(function (player, playerIndex) {
          if (!player || !player.name) return null;
          var key = normalize(player.name);
          if (!key || rosterSeen.has(key)) return null;
          rosterSeen.add(key);
          return estimateImportedPlayer(player, found, playerIndex);
        }).filter(Boolean);
        if (!fullRoster.length) return;
        found.fullRoster = fullRoster;
        // Do not overwrite curated Arabic highlight names with English source names.
        found.rosterSource = sourceClub.source || SQUAD_SNAPSHOT.source || "Current squad snapshot";
        found.sourceUrl = sourceClub.sourceUrl || "";
        imported.push({ leagueId: found.leagueId, division: found.division, club: found.name, players: fullRoster.length });
        IMPORTED_CLUB_COUNT++;
        IMPORTED_PLAYER_COUNT += fullRoster.length;
      });
    });
    return imported;
  }
  var IMPORTED_SQUAD_SUMMARY = applyImportedSquads();

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
  function generatedBackupRecords(item, currentPlayers) {
    var players = currentPlayers.slice();
    var positions = ["حارس مرمى","حارس مرمى","حارس مرمى","قلب دفاع","قلب دفاع","قلب دفاع","قلب دفاع","ظهير","ظهير",
      "وسط دفاعي","وسط دفاعي","وسط مهاجم","وسط مهاجم","وسط مهاجم","جناح","جناح","جناح","مهاجم","مهاجم","مهاجم",
      "قلب دفاع","وسط مهاجم","ظهير","مهاجم","حارس مرمى"];
    var index = 1;
    var base = Number(item.ovr) || 58;
    while (players.length < 25) {
      var pos = positions[(players.length) % positions.length];
      var seed = normalize(item.leagueId + "|" + item.name + "|" + index).split("").reduce(function (sum, ch) {
        return (Math.imul(sum ^ ch.charCodeAt(0), 16777619) >>> 0);
      }, 2166136261);
      var ovr = Math.max(38, Math.min(78, Math.round(base - 11 + (seed % 15))));
      var name = item.name + " • لاعب مُولّد " + String(index).padStart(2, "0");
      players.push({
        id:"generated-" + item.leagueId + "-" + (Number(item.division) || 1) + "-" + normalize(item.name) + "-" + index,
        name:name,clubName:item.name,country:item.country,leagueId:item.leagueId,division:Number(item.division)||1,
        position:pos,ovr:ovr,potential:Math.min(88,ovr+6),age:18+(seed%12),isRealPlayer:false,isGenerated:true,
        season:SEASON,source:"توليد داخلي لتكميل قائمة الفريق؛ ليس لاعبًا حقيقيًا",ratingType:"simulation-estimate"
      });
      index++;
    }
    return players;
  }

  var CONTINENTAL_RATING_FACTORS = Object.freeze({ UEFA: 1, CONMEBOL: 0.985, CAF: 0.955, AFC: 0.97, OFC: 0.94, FIFA: 1 });
  function ratingProfileForLeague(item) {
    item = item || {};
    var league = leagueById(item.leagueId) || {};
    var division = Math.max(1, Number(item.division) || 1);
    var confederation = league.confederation || item.confederation || "FIFA";
    var catalog = window.LWCatalog;
    if (catalog && typeof catalog.ratingProfile === "function") {
      try {
        var sourced = catalog.ratingProfile(item.country || league.country, {
          englishCountry: league.englishCountry, confederation: confederation,
          leagueStrength: Number(league.strength) || 60, division: division
        });
        if (sourced && sourced.confederation) confederation = sourced.confederation;
      } catch (_) { /* Keep the deterministic local fallback. */ }
    }
    var snapshotFactors = SQUAD_SNAPSHOT && SQUAD_SNAPSHOT.ratingNormalization && SQUAD_SNAPSHOT.ratingNormalization.factors || {};
    var snapshotFactor = Number(snapshotFactors[confederation]);
    var factor = Number.isFinite(snapshotFactor) && snapshotFactor > 0 ? Math.max(0.9, Math.min(1, snapshotFactor)) : (CONTINENTAL_RATING_FACTORS[confederation] || 0.97);
    var strength = Math.max(35, Math.min(100, (Number(league.strength) || 60) - (division >= 2 ? 18 : 0)));
    return { confederation: confederation, coefficient: factor, leagueStrength: strength,
      baseline: 52 + strength * 0.12, division: division, source: catalog && typeof catalog.ratingProfile === "function" ? "global-catalog+league-profile" : "league-profile-fallback" };
  }
  function normalizeRating(value, profile) {
    profile = profile || {};
    var raw = Math.max(35, Math.min(99, Number(value) || 60));
    var baseline = Number.isFinite(Number(profile.baseline)) ? Number(profile.baseline) : 60;
    var factor = Math.max(0.9, Math.min(1, Number(profile.coefficient) || 0.97));
    return Math.round(Math.max(35, Math.min(99, baseline + (raw - baseline) * factor)));
  }
  function normalizedPlayer(player, profile) {
    var copy = Object.assign({}, player);
    var base = Number(copy.baseOvr != null ? copy.baseOvr : copy.ovr);
    if (!Number.isFinite(base)) base = 60;
    copy.baseOvr = base;
    copy.normalizedOvr = normalizeRating(base, profile);
    copy.continentalRatingFactor = Number(profile.coefficient) || 0.97;
    copy.ratingNormalizationSource = profile.source || "league-profile-fallback";
    return copy;
  }
  function normalizeClub(item) {
    var profile = leagueById(item.leagueId);
    var division = Math.max(1, Number(item.division) || 1);
    var hasCurrentRoster = Array.isArray(item.fullRoster) && item.fullRoster.length > 0;
    var players = hasCurrentRoster
      ? item.fullRoster.map(function (player) { return Object.assign({}, player); })
      : buildPlayerRecords(item);
    var curatedNames = (item.stars || []).slice();
    var ratingProfile = ratingProfileForLeague(item);
    var rosterSource = item.rosterSource || "";
    if (!hasCurrentRoster && players.length < 25) {
      players = generatedBackupRecords(item, players);
      if (!rosterSource) rosterSource = curatedNames.length ? "curated highlights + generated in-game backups" : "generated in-game squad; no verified full-roster source";
    }
    players = players.map(function (player) { return normalizedPlayer(player, ratingProfile); });
    return {name:item.name,aliases:(item.aliases || []).slice(),country:item.country,leagueId:item.leagueId,division:division,
      leagueName:profile ? (division >= 2 ? profile.tier2 : profile.league) : "",
      leagueEnglish:profile ? (division >= 2 ? profile.tier2English : profile.english) : "",
      ovr:item.ovr,baseOvr:item.ovr,normalizedOvr:normalizeRating(item.ovr, ratingProfile),continentalRatingFactor:ratingProfile.coefficient,
      ratingNormalizationSource:ratingProfile.source,prestige:item.prestige,stars:curatedNames.length ? curatedNames : (hasCurrentRoster ? players.map(function (player) { return player.name; }) : curatedNames),
      players:players,season:SEASON,ratingType:"simulation-estimate",
      rosterStatus:hasCurrentRoster ? "current-squad" : curatedNames.length ? "curated-highlights+generated-backups" : "generated-squad",
      rosterSource:rosterSource,sourceUrl:item.sourceUrl || ""};
  }
  function leagueFor(country, division) {
    var profile = leagueByCountry(country);
    if (!profile) return null;
    var second = Number(division || 1) >= 2;
    return Object.assign({}, profile, {division:second ? 2 : 1,name:second ? profile.tier2 : profile.league,
      englishName:second ? profile.tier2English : profile.english,teamCount:second ? profile.tier2Teams : profile.teams,
      matchesPerSeason:second ? ({england:46,spain:42,germany:34,italy:38,france:34,portugal:34,turkey:38,netherlands:38,belgium:34,greece:30,scotland:36,japan:38,egypt:22,morocco:30,tunisia:46,algeria:30,senegal:30,nigeria:38,ghana:34,brazil:38,argentina:34}[profile.id] || Math.max(22, 2 * (profile.tier2Teams - 1))) : profile.matches,
      globalTier:second ? 4 : profile.globalTier,strength:second ? Math.max(42, profile.strength - 18) : profile.strength,
      season:SEASON,officialUrl:profile.url,ratingNote:RATINGS_NOTE});
  }
  function competitionsForCountry(country, context) {
    var profile = leagueByCountry(country);
    if (!profile) return [];
    context = context || {};
    var division = Math.max(1, Number(context.division) || 1);
    var qualifiedWorld = !!(context.worldClubQualified || context.continentalChampion || (context.worldClubQualifiedSeason != null && context.season != null && context.worldClubQualifiedSeason === context.season));
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
    clubNames:function () { return CLUBS.map(function (item) { return {name:item.name,country:item.country,leagueId:item.leagueId,division:Math.max(1,Number(item.division)||1)}; }); },
    clubs:function () { return CLUBS.map(normalizeClub); },clubsForCountry:clubsForCountry,
    rosterCoverage:function () {
      var byLeague = {};
      var totalDatabasePlayers = 0, totalRealPlayers = 0, totalGeneratedPlayers = 0;
      CLUBS.forEach(function (club) {
        var key = String(club.leagueId) + ":" + String(Number(club.division) || 1);
        if (!byLeague[key]) byLeague[key] = {leagueId:club.leagueId,division:Number(club.division)||1,clubCount:0,
          clubsWithCurrentRoster:0,clubsWithPartialRoster:0,listedPlayers:0,realPlayers:0,generatedPlayers:0,clubsNeedingRealRoster:[]};
        var row = normalizeClub(club);
        byLeague[key].clubCount++;
        byLeague[key].listedPlayers += row.players.length;
        totalDatabasePlayers += row.players.length;
        row.players.forEach(function (player) {
          if (player.isRealPlayer !== false && !player.isGenerated) { byLeague[key].realPlayers++; totalRealPlayers++; }
          else { byLeague[key].generatedPlayers++; totalGeneratedPlayers++; }
        });
        if (Array.isArray(club.fullRoster) && club.fullRoster.length) byLeague[key].clubsWithCurrentRoster++;
        else if ((club.stars || []).length) byLeague[key].clubsWithPartialRoster++;
        else byLeague[key].clubsNeedingRealRoster.push(club.name);
      });
      return {season:SEASON,source:SQUAD_SNAPSHOT.source || "",snapshotGeneratedAt:SQUAD_SNAPSHOT.generatedAt || null,
        importedClubs:IMPORTED_CLUB_COUNT,importedPlayers:IMPORTED_PLAYER_COUNT,totalClubs:CLUBS.length,
        totalDatabasePlayers:totalDatabasePlayers,totalRealPlayers:totalRealPlayers,totalGeneratedPlayers:totalGeneratedPlayers,
        leagues:Object.values(byLeague).sort(function(a,b){return a.leagueId.localeCompare(b.leagueId)||a.division-b.division;})};
    },
    clubByName:function (name,country) { var item = findClub(name,country); return item ? normalizeClub(item) : null; },
    playersForClub:function (name,country) { var item = findClub(name,country); return item ? normalizeClub(item).players.map(function (row) { return row.name; }) : []; },
    playerRecordsForClub:function (name,country) {
      var item = findClub(name,country);
      return item ? normalizeClub(item).players.map(function (row) { return Object.assign({},row); }) : [];
    },
    playerByName:function (name,country) {
      var target=normalize(name), list=CLUBS.filter(function (club) {
        if(country && normalize(club.country)!==normalize(country)) return false;
        return normalizeClub(club).players.some(function (player) { return normalize(player.name)===target; });
      });
      if(!list.length) return null;
      return normalizeClub(list[0]).players.find(function (row) { return normalize(row.name)===target; }) || null;
    },
    tournamentById:tournamentById,allTournaments:function () { return TOURNAMENTS.map(function (item) {
      return Object.assign({},item,{teams:(item.teams || []).slice(),countries:(item.countries || []).slice(),qualificationPlaces:(item.qualificationPlaces || []).slice()});
    }); },
    competitionsForCountry:competitionsForCountry,simulationCupDefinitions:simulationCupDefinitions,
    profileForClub:function (name) { var item=findClub(name);return item?profileSummary(item.country):null; },
    clubPower:function (name,country) { var item=findClub(name,country);if(!item)return null;return normalizeRating(item.ovr,ratingProfileForLeague(item)); },
    ratingProfileForLeague:ratingProfileForLeague,normalizeRating:normalizeRating,continentalRatingFactors:CONTINENTAL_RATING_FACTORS,normalize:normalize
  };
})();
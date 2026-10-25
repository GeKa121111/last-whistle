/* Static data bridge: FIFA competition directory + sourced club names + award references. */
(() => {
  "use strict";
  const DATA_FILES = {
    fifa: "data/snapshots/fifa-global-2023.json.gz.b64",
    clubs: "data/snapshots/openfootball-clubs.json.gz.b64",
    football: "data/snapshots/football-reference.json.gz.b64",
    awards: "data/snapshots/awards.json.gz.b64"
  };
  const DIRECTORY_TO_ARABIC = {
    "Austria": "النمسا", "Belgium": "بلجيكا", "Germany": "ألمانيا", "England": "إنجلترا",
    "Spain": "إسبانيا", "France": "فرنسا", "Greece": "اليونان", "Italy": "إيطاليا",
    "Netherlands": "هولندا", "Portugal": "البرتغال", "Scotland": "اسكتلندا",
    "Türkiye": "تركيا", "Turkey": "تركيا", "Argentina": "الأرجنتين", "Brazil": "البرازيل",
    "China PR": "الصين", "China": "الصين", "Colombia": "كولومبيا", "Japan": "اليابان",
    "USA": "الولايات المتحدة وكندا"
  };
  let fifa = null, clubSnapshot = null, footballReference = null, awardReference = null, loadError = "";

  async function readJSON(path) {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) throw new Error(path + ": HTTP " + response.status);
    const encoded = (await response.text()).trim();
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error(path + ": invalid base64 snapshot");
    }
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser does not support gzip snapshot decompression.");
    }
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }

  async function load() {
    const results = await Promise.allSettled([
      readJSON(DATA_FILES.fifa), readJSON(DATA_FILES.clubs),
      readJSON(DATA_FILES.football), readJSON(DATA_FILES.awards)
    ]);
    [fifa, clubSnapshot, footballReference, awardReference] = results.map(result =>
      result.status === "fulfilled" ? result.value : null
    );
    const rejected = results.filter(result => result.status === "rejected");
    loadError = rejected.map(result => String(result.reason?.message || result.reason)).join("; ");
    if (!fifa || !Array.isArray(fifa.associations)) {
      throw new Error(loadError || "FIFA directory data is unavailable");
    }
    return summary();
  }

  function latestDomesticCompetitions() {
    return Array.isArray(clubSnapshot?.latestDomesticCompetitions) ? clubSnapshot.latestDomesticCompetitions : [];
  }
  function clubsForCountry(country) {
    const record = latestDomesticCompetitions().find(item => item.country === country);
    return record && Array.isArray(record.clubs) ? record : null;
  }
  function directoryRows() {
    if (!fifa) return [];
    const rosters = new Map(latestDomesticCompetitions().map(item => [item.country, item]));
    return fifa.associations.filter(item => item && item.country).map(item => {
      const arabic = DIRECTORY_TO_ARABIC[item.country] || "";
      const roster = arabic ? rosters.get(arabic) : null;
      return {
        country: item.country, association: item.association || "", confederation: item.confederation || "",
        sourceYear: item.sourceYear || fifa.sourceYear || "2023", competition: item.topTier?.name || "",
        teamCount: Number.isFinite(Number(item.topTier?.teams)) ? Number(item.topTier.teams) : null,
        professionalStatus: item.topTier?.professionalStatus || "", listed: Boolean(item.topTier),
        fifaSource: item.source || fifa.sourceUrl, playableRoster: roster,
        rosterCountryArabic: roster?.country || "", rosterSeason: roster?.season || "", rosterSource: roster?.sourceUrl || ""
      };
    });
  }
  function officialCompetitions() {
    return Array.isArray(footballReference?.officialCompetitions) ? footballReference.officialCompetitions : [];
  }
  function officialAwards() {
    return Array.isArray(awardReference?.officialAwards) ? awardReference.officialAwards : [];
  }
  function simulatedAwards() {
    return Array.isArray(awardReference?.careerSimulationAwards) ? awardReference.careerSimulationAwards : [];
  }

  function ratingProfile(country, fallback) {
    fallback = fallback || {};
    const normalise = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu, "");
    const target = normalise(country);
    const row = directoryRows().find(item =>
      normalise(item.country) === target || normalise(item.rosterCountryArabic) === target ||
      normalise(item.association) === target
    ) || null;
    const confederation = row && row.confederation || fallback.confederation || "FIFA";
    const factors = { UEFA: 1, CONMEBOL: 0.985, CAF: 0.955, AFC: 0.97, OFC: 0.94, FIFA: 1 };
    return {
      country: country || fallback.country || "",
      confederation,
      coefficient: factors[confederation] || 0.97,
      sourceYear: row && row.sourceYear || fifa && fifa.sourceYear || "2023",
      catalogMatched: !!row,
      leagueStrength: Number(fallback.leagueStrength) || 60,
      division: Math.max(1, Number(fallback.division) || 1)
    };
  }
  function summary() {
    return {
      fifaAssociations: Array.isArray(fifa?.associations) ? fifa.associations.length : 0,
      fifaTopTiers: Array.isArray(fifa?.associations) ? fifa.associations.filter(item => item?.topTier).length : 0,
      sourceYear: fifa?.sourceYear || "2023",
      sourcedLeagueRosters: latestDomesticCompetitions().length,
      sourcedClubs: Number(clubSnapshot?.coverage?.distinctDomesticClubNames) || 0,
      officialCompetitions: officialCompetitions().length, officialAwards: officialAwards().length,
      rosterSource: clubSnapshot?.repository || "", rosterLicense: clubSnapshot?.license || "",
      rosterVerifiedAt: clubSnapshot?.verifiedAt || "",
      limitations: Array.isArray(fifa?.limitations) ? fifa.limitations : [], partialData: !!loadError, loadError
    };
  }
  window.LWCatalog = { load, summary, directoryRows, latestDomesticCompetitions, clubsForCountry, officialCompetitions, officialAwards, simulatedAwards, ratingProfile };
})();
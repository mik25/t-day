require("dotenv").config();
var torrentStream = require("torrent-stream");
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
// var WebTorrent = require("webtorrent");
var torrentStream = require("torrent-stream");
const { XMLParser } = require("fast-xml-parser");
const {
  checkTorrentFileinRD,
  addTorrentFileinRD,
  selectFilefromRD,
  getTorrentInfofromRD,
  unrestrictLinkfromRD,
} = require("./helper");

let nbreAdded = 0;

let containEandS = (name = "", s, e, abs, abs_season, abs_episode) =>
  //SxxExx ./ /~/-
  //SxExx
  //SxExx
  //axb
  //Sxx - Exx
  //Sxx.Exx
  //Season xx Exx
  //SasEae selon abs
  //SasEaex  selon abs
  //SasEaexx  selon abs
  //SxxEaexx selon abs
  //SxxEaexxx  selon abs
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`${s}x${e}`) ||
  name?.includes(`s${s?.padStart(2, "0")} - e${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s?.padStart(2, "0")}.e${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e} `) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e}.`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e}-`) ||
  name?.includes(`season ${s} e${e}`) ||
  (abs &&
    (name?.includes(
      `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`
    ) ||
      name?.includes(
        `s${s?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`
      ) ||
      name?.includes(
        `s${s?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`
      ) ||
      name?.includes(
        `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`
      ) ||
      name?.includes(
        `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(4, "0")}`
      )));

let containE_S = (name = "", s, e, abs, abs_season, abs_episode) =>
  //Sxx - xx
  //Sx - xx
  //Sx - x
  //Season x - x
  //Season x - xx
  name?.includes(`s${s?.padStart(2, "0")} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s} - ${e?.padStart(2, "0")}`) ||
  // name?.includes(`s${s} - ${e}`) ||
  // name?.includes(`season ${s} - ${e}`) ||
  name?.includes(`season ${s} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`season ${s} - ${e?.padStart(2, "0")}`);

let containsAbsoluteE = (name = "", s, e, abs, abs_season, abs_episode) =>
  //- xx
  //- xxx
  //- xxxx
  //- 0x
  name?.includes(` ${abs_episode?.padStart(2, "0")} `) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")} `) ||
  name?.includes(` 0${abs_episode} `) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")} `);

let containsAbsoluteE_ = (name = "", s, e, abs, abs_season, abs_episode) =>
  // xx.
  // xxx.
  // xxxx.
  // 0x.
  name?.includes(` ${abs_episode?.padStart(2, "0")}.`) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")}.`) ||
  name?.includes(` 0${abs_episode}.`) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")}.`);

let hosts = [];

const raw_content = require("fs").readFileSync("./servers.txt");
let content = Buffer.isBuffer(raw_content)
  ? raw_content.toString()
  : raw_content;
hosts = content
  .split("\n")
  .map((el) => el.trim())
  .map((el) => {
    if (!el.includes("|")) return null;
    return {
      host: el.split("|")[0],
      apiKey: el.split("|").pop(),
    };
  });

hosts = hosts.filter((el) => !!el);

let fetchTorrent = async (query, type = "series") => {
  let hostdata = hosts[Math.floor(Math.random() * hosts.length)];
  if (!hostdata) return [];

  let url = `${
    hostdata.host
  }/api/v2.0/indexers/abnormal/results/torznab/api?apikey=${hostdata.apiKey}&${
    type == "movie" ? "t=movie" : "t=tvsearch"
  }&${type == "movie" ? "cat=2000" : "cat=5000"}&q=${query}&cache=false`;

  return await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
      cookie:
        "Jackett=CfDJ8AG_XUDhxS5AsRKz0FldsDJIHUJANrfynyi54VzmYuhr5Ha5Uaww2hSQytMR8fFWjPvDH2lKCzaQhRYI9RuK613PZxJWz2tgHqg1wUAcPTMfi8b_8rm1Igw1-sZB_MnimHHK7ZSP7HfkWicMDaJ4bFGZwUf0xJOwcgjrwcUcFzzsVSTALt97-ibhc7PUn97v5AICX2_jsd6khO8TZosaPFt0cXNgNofimAkr5l6yMUjShg7R3TpVtJ1KxD8_0_OyBjR1mwtcxofJam2aZeFqVRxluD5hnzdyxOWrMRLSGzMPMKiaPXNCsxWy_yQhZhE66U_bVFadrsEeQqqaWb3LIFA",
    },
    referrerPolicy: "no-referrer",
    method: "GET",
  })
    .then(async (res) => {
      try {
        // return await res.json();
        const parser = new XMLParser({ ignoreAttributes: false });
        let jObj = parser.parse(await res.text());

        let results =
          "rss" in jObj &&
          "channel" in jObj["rss"] &&
          "item" in jObj["rss"]["channel"]
            ? jObj["rss"]["channel"]["item"]
            : [];

        return results;
      } catch (error) {
        console.log({ error });
        return [];
      }
    })
    .then(async (results) => {
      results = Array.isArray(results) ? results : [results];
      console.log({ Initial: results?.length });
      if (results.length != 0) {
        // return [];
        torrent_results = await Promise.all(
          results.map((result) => {
            let torznab_attr = {};
            result["torznab:attr"]?.length
              ? result["torznab:attr"]?.forEach((el) => {
                  torznab_attr[el["@_name"]] = el["@_value"];
                })
              : false;
            return new Promise((resolve, reject) => {
              resolve({
                Tracker:
                  "#text" in result["jackettindexer"]
                    ? result["jackettindexer"]["#text"]
                    : "Torrent",
                Title: result["title"],
                Seeders: torznab_attr ? torznab_attr["seeders"] : "",
                Peers: torznab_attr ? torznab_attr["peers"] : "",
                Link: result["link"],
                MagnetUri:
                  "@_url" in result["enclosure"]
                    ? result["enclosure"]["@_url"]
                    : null,
              });
            });
          })
        );
        return torrent_results;
      } else {
        return [];
      }
    })
    .catch((err) => {
      return [];
    });
};
let fetchTorrent2 = async (query, type = "series") => {
  let hostdata = hosts[Math.floor(Math.random() * hosts.length)];
  if (!hostdata) return [];

  let url = `${hostdata.host}/api/v2.0/indexers/all/results?apikey=${hostdata.apiKey}&Query=${query}&Tracker%5B%5D=thepiratebay&Category%5B%5D=2000&Category%5B%5D=5000&cache=false`;

  return await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
    },
    referrerPolicy: "no-referrer",
    method: "GET",
  })
    .then((res) => res.json())
    .then(async (results) => {
      console.log({ Initial: results["Results"]?.length });
      // console.log({ Response: results["Results"] });
      if (results["Results"].length != 0) {
        torrent_results = await Promise.all(
          results["Results"].map((result) => {
            return new Promise((resolve, reject) => {
              resolve({
                Tracker: result["Tracker"],
                Category: result["CategoryDesc"],
                Title: result["Title"],
                Seeders: result["Seeders"],
                Peers: result["Peers"],
                Link: result["Link"],
                MagnetUri: result["MagnetUri"],
              });
            });
          })
        );
        return torrent_results;
      } else {
        return [];
      }
    });
};

function getMeta(id, type) {
  var [tt, s, e] = id.split(":");

  return fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
    .then((res) => res.json())
    .then((json) => {
      return {
        name: json.meta["name"],
        year: json.meta["releaseInfo"]?.substring(0, 4) ?? 0,
      };
    })
    .catch((err) =>
      fetch(`https://v2.sg.media-imdb.com/suggestion/t/${tt}.json`)
        .then((res) => res.json())
        .then((json) => {
          return json.d[0];
        })
        .then(({ l, y }) => ({ name: l, year: y }))
    );
}

async function getImdbFromKitsu(id) {
  var [kitsu, _id, e] = id.split(":");

  return fetch(`https://anime-kitsu.strem.fun/meta/anime/${kitsu}:${_id}.json`)
    .then((_res) => _res.json())
    .then((json) => {
      return json["meta"];
    })
    .then((json) => {
      try {
        let imdb = json["imdb_id"];
        let meta = json["videos"].find((el) => el.id == id);
        return [
          imdb,
          (meta["imdbSeason"] ?? 1).toString(),
          (meta["imdbEpisode"] ?? 1).toString(),
          (meta["season"] ?? 1).toString(),
          (meta["imdbSeason"] ?? 1).toString() == 1
            ? (meta["imdbEpisode"] ?? 1).toString()
            : (meta["episode"] ?? 1).toString(),
          meta["imdbEpisode"] != meta["episode"] || meta["imdbSeason"] == 1,
        ];
      } catch (error) {
        return null;
      }
    })
    .catch((err) => null);
}

let isRedirect = async (url) => {
  try {
    const controller = new AbortController();
    // 5 second timeout:
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 301 || response.status === 302) {
      const locationURL = new URL(
        response.headers.get("location"),
        response.url
      );
      if (response.headers.get("location").startsWith("http")) {
        await isRedirect(locationURL);
      } else {
        return response.headers.get("location");
      }
    } else if (response.status >= 200 && response.status < 300) {
      return response.url;
    } else {
      return response.url;
      // return null;
    }
  } catch (error) {
    // console.log({ error });
    return null;
  }
};

const getParsedFromMagnetorTorrentFile = async (tor, uri) => {
  return new Promise(async (resolve, reject) => {
    //follow redirection cause some http url sent magnet url
    let realUrl = uri?.startsWith("magnet:?") ? uri : await isRedirect(uri);
    realUrl = realUrl ?? null;

    if (realUrl) {
      let parsedTorrent = null;
      if (realUrl?.startsWith("magnet:?")) {
        parsedTorrent = parseTorrent(realUrl);
      } else if (realUrl?.startsWith("http")) {
        parsedTorrent = await new Promise((resolve, reject) => {
          parseTorrent.remote(realUrl, (err, parsed) => {
            if (!err) {
              resolve(parsed);
            } else {
              // console.log({ err });
              resolve(null);
            }
          });
        });
      } else {
        console.log({ WhatTF: realUrl });
        resolve(null);
      }

      if (!parsedTorrent?.infoHash) resolve(null);

      if (!parsedTorrent?.files) {
        console.log("no files");
        if (!parsedTorrent?.files && realUrl.startsWith("magnet:?")) {
          try {
            let res = await new Promise((resolve, reject) => {
              var engine = torrentStream(realUrl, {
                connections: 40,
              });
              engine.on("ready", function () {
                resolve(engine.files);
              });
              setTimeout(() => {
                resolve([]);
              }, 10000); //
            });

            if (res && res.length > 0) {
              console.log("got no files but parsed");
            }

            parsedTorrent.files = [...res];
          } catch (error) {
            console.log("Done with that error");
          }
        }
      } else {
        console.log("got files directly");
      }

      if (!(parsedTorrent?.files && parsedTorrent?.files.length)) {
        resolve(null);
      }

      resolve({ parsedTor: parsedTorrent, ...tor });
    } else {
      resolve(null);
    }
  });
};

const toStream = async (
  tor,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs,
  max_element
) => {
  let parsed = tor?.parsedTor;
  if (!parsed) return null;

  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  let index = -1;

  if (!parsed.files) {
    return null;
  }

  if (type == "series") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      if (!element["name"]) {
        return false;
      }

      let name = element["name"].toLowerCase();

      if (name.includes("live") || name.includes("ova")) {
        return false;
      }

      return (
        isVideo(element) &&
        (containEandS(name, s, e, abs, abs_season, abs_episode) ||
          containE_S(name, s, e, abs, abs_season, abs_episode) ||
          (s == 1 &&
            (containsAbsoluteE(name, s, e, true, s, e) ||
              containsAbsoluteE_(name, s, e, true, s, e))) ||
          (((abs &&
            containsAbsoluteE(name, s, e, abs, abs_season, abs_episode)) ||
            (abs &&
              containsAbsoluteE_(name, s, e, abs, abs_season, abs_episode))) &&
            !(
              name?.includes("s0") ||
              name?.includes(`s${abs_season}`) ||
              name?.includes("e0") ||
              name?.includes(`e${abs_episode}`) ||
              name?.includes("season")
            )))
      );
    });

    if (index == -1) {
      return null;
    }

    title = !!title ? title + "\n" + parsed.files[index]["name"] : null;
  } else if (type == "movie") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      return isVideo(element);
    });
    //
    if (index == -1) {
      return null;
    }
  }

  // ========================== RD =============================
  console.log("Trynna some RD");
  let folderId = null;

  let details = [];

  let available = await checkTorrentFileinRD(infoHash);
  let availableCheck =
    !!available && infoHash in available
      ? "rd" in available[infoHash]
        ? Array.isArray(available[infoHash]["rd"]) &&
          available[infoHash]["rd"].length > 0
        : false
      : false;

  let data = {};
  console.log({ max_element });
  let sleep = Math.floor(Math.random() * max_element * 1000);

  console.log("sleeping for " + sleep.toString() + " ms");
  await new Promise((r) => setTimeout(r, sleep));

  if (availableCheck || nbreAdded < 5) {
    console.log({ nbreAdded });
    if (availableCheck) console.log("Cached");
    data = await addTorrentFileinRD(parseTorrent.toMagnetURI(parsed));
    if (!availableCheck) {
      nbreAdded++;
      console.log("Added");
    }
  }

  folderId = data && "id" in data ? data["id"] : null;
  let added = await selectFilefromRD(folderId);
  console.log({ added });
  if (folderId) {
    let torrentDetails = await getTorrentInfofromRD(folderId);
    let files = (torrentDetails["files"] ?? []).filter(
      (el) => el["selected"] == 1
    );
    let links = torrentDetails["links"] ?? [];

    let selectedIndex =
      files.length == 1
        ? 0
        : files.findIndex((el) =>
            el["path"]
              ?.toLowerCase()
              ?.includes(parsed.files[index]["name"]?.toLowerCase())
          );
    details = [await unrestrictLinkfromRD(links[selectedIndex] ?? null)];
  }

  //=============================================================================

  title = title ?? parsed.files[index]["name"];

  title += "\n" + getQuality(title);

  const subtitle = "S:" + tor["Seeders"] + " | P:" + tor["Peers"];
  title += ` | ${
    index == -1 || parsed.files == []
      ? `${getSize(0)}`
      : `${getSize(parsed.files[index]["length"] ?? 0)}`
  } | ${subtitle}`;

  if (
    details.length > 0 &&
    details[details.length > 1 ? index : 0]["download"]
  ) {
    return {
      name: `RD-${tor["Tracker"]}`,
      url: details[details.length > 1 ? index : 0]["download"],
      title:
        (title ?? details[details.length > 1 ? index : 0]["filename"]) +
        getFlagFromName(
          title ?? details[details.length > 1 ? index : 0]["filename"]
        ),
      behaviorHints: {
        bingeGroup: `Jackett-Addon|${infoHash}`,
      },
    };
  }

  if (process.env.PUBLIC == "1")
    return {
      name: `${tor["Tracker"]}`,
      type: type,
      infoHash: infoHash,
      fileIdx: index == -1 ? 0 : index,
      sources: (parsed.announce || [])
        .map((x) => {
          return "tracker:" + x;
        })
        .concat(["dht:" + infoHash]),
      title: title + getFlagFromName(title),
      behaviorHints: {
        bingeGroup: `Jackett-Addon|${infoHash}`,
        notWebReady: true,
      },
    };
};

const qualities = {
  "4k": "🌟4k",
  fhd: "🎥FHD",
  hd: "📺HD",
  sd: "📱SD",
  unknown: "none",
};

const vf = ["vf", "vff", "french", "frn"];
const multi = ["multi"];
const vostfr = ["vostfr", "english", "eng"];

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    "💾 " +
    (size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`)
  );
}

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].filter((x) => name.includes(x)).length > 0)
    return " " + qualities["4k"];
  if (["1080", "fhd"].filter((x) => name.includes(x)).length > 0)
    return " " + qualities.fhd;
  if (["720", "hd"].filter((x) => name.includes(x)).length > 0)
    return " " + qualities.hd;
  if (["480p", "380p", "sd"].filter((x) => name.includes(x)).length > 0)
    return " " + qualities.sd;
  return "";
}

const isSomeContent = (file_name = "", langKeywordsArray = []) => {
  file_name = file_name.toLowerCase();
  return langKeywordsArray.some((word) => file_name.includes(word));
};

const isVfContent = (file_name) => isSomeContent(file_name, vf);
const isMultiContent = (file_name) => isSomeContent(file_name, multi);
const isVostfrContent = (file_name) => isSomeContent(file_name, vostfr);

const bringFrenchVideoToTheTopOfList = (streams = []) => {
  streams.sort((a, b) => {
    let a_lower = a.title.toLowerCase();
    let b_lower = b.title.toLowerCase();
    return isVfContent(a_lower) ||
      isVostfrContent(a_lower) ||
      isMultiContent(a_lower)
      ? -1
      : isVfContent(b_lower) ||
        isVostfrContent(b_lower) ||
        isMultiContent(a_lower)
      ? 1
      : 0;
  });
  return streams;
};

const filterBasedOnQuality = (streams = [], quality = "") => {
  if (!quality) return [];
  if (!Object.values(qualities).includes(quality)) return [];

  if (quality == qualities.unknown) {
    streams = streams.filter((el) => {
      const l = `${el?.title}`;
      return (
        !l.includes(qualities["4k"]) &&
        !l.includes(qualities.fhd) &&
        !l.includes(qualities.hd) &&
        !l.includes(qualities.sd)
      );
    });
  } else {
    streams = streams.filter((el) => el.title.includes(quality));
  }
  return bringFrenchVideoToTheTopOfList(streams);
};

const getFlagFromName = (file_name) => {
  switch (true) {
    case isVfContent(file_name):
      return "| 🇫🇷";
    case isMultiContent(file_name):
      return "| 🌐";
    case isVostfrContent(file_name):
      return "| 🇬🇧";
    default:
      return "| 🏴󠁰󠁴󠀰󠀶󠁿";
  }
};

let cleanName = (name = "") => {
  return name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s{2,}/g, " ");
};

let simplifiedName = (name = "") => {
  name = name.includes("-") ? name.split("-")[0] : name;
  name = name.includes(":") ? name.split(":")[0] : name;
  name = name.trim();
  console.log(cleanName(name));
  return cleanName(name);
};

module.exports = {
  containEandS,
  containE_S,
  containsAbsoluteE,
  containsAbsoluteE_,
  fetchTorrent,
  fetchTorrent2,
  getMeta,
  getImdbFromKitsu,
  isRedirect,
  getParsedFromMagnetorTorrentFile,
  toStream,
  isVideo,
  getSize,
  getQuality,
  filterBasedOnQuality,
  qualities,
  bringFrenchVideoToTheTopOfList,
  getFlagFromName,
  cleanName,
  simplifiedName,
};

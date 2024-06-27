const path = require("path");
const serversFilePath = path.resolve(__dirname, "./servers.txt");

const fs = require("fs");
require("dotenv").config();
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
// var WebTorrent = require("webtorrent");
const { XMLParser, XMLBuilder, XMLValidator } = require("fast-xml-parser");

var torrentStream = require("torrent-stream");
const {
  addTorrentFileinRD,
  getTorrentInfofromRD,
  selectFilefromRD,
  unrestrictLinkfromRD,
  removeDuplicate,
  checkTorrentFileinRD,
} = require("./helper");

const UTILS = require("./utils");

let caches = {};
let lastCached = null;

const REGEX = {
  season_range:
    /S(?:(eason )|(easons )|(eason )|(easons )|(aisons )|(aison ))?(?<start>\d{1,2})\s*?(?:-|&|à|et)\s*?(?<end>\d{1,2})/, //start and end Sxx-xx|Season(s) xx-xx|Sxx à xx
  ep_range: /((?:e)|(?:ep))?(?: )?(?<start>\d{1,4})-(?<end>\d{1,4})/, //xxx-xxx
  ep_rangewithS:
    /((?:e)|(?:pisode))\s*(?<start>\d{1,3}(?!\d)|\d\d\d??)(?:-?e?(?<end>\d{1,3}))?(?!\d)/, //Exxx-xxx
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

let nbreAdded = 0;

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].filter((x) => name.includes(x)).length > 0)
    return "🌟4k";
  if (["1080", "fhd"].filter((x) => name.includes(x)).length > 0)
    return " 🎥FHD";
  if (["720", "hd"].filter((x) => name.includes(x)).length > 0) return "📺HD";
  if (["480p", "380p", "sd"].filter((x) => name.includes(x)).length > 0)
    return "📱SD";
  return "";
}

// ----------------------------------------------

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

//------------------------------------------------------------------------------------------

const toStream = async (
  parsed,
  uri,
  tor,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  let index = -1;
  
  if (!parsed.files && uri.startsWith("magnet:?")) {
    
    var engine = torrentStream("magnet:" + uri, { connections: 20 });
    try {
      let res = await new Promise((resolve, reject) => {
        engine.on("ready", function () {
          resolve(engine.files);
        });
        setTimeout(() => {
          resolve([]);
        }, 20000); //
      });
      parsed.files = res;
    } catch (error) {
      console.log("Done with that error");
      return null;
    }
    engine ? engine.destroy() : null;
  }
  
  //console.log("--------------------------------------------&");
  //console.log(parsed?.files ?? []);
  //console.log("--------------------------------------------$");

  if (media == "series") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      if (!element["name"]) {
        return false;
      }

      let name = element["name"].toLowerCase();

      if (
        name.includes("movie") ||
        name.includes("live") ||
        name.includes("ova")
      ) {
        return false;
      }

      return (
        isVideo(element) &&
        (UTILS.containEandS(name, s, e, abs, abs_season, abs_episode) ||
          UTILS.containE_S(name, s, e, abs, abs_season, abs_episode) ||
          (s==1 &&  (UTILS.containsAbsoluteE(
              name,
              s,
              e,
              true,
              s,
              e
            ) ||UTILS.containsAbsoluteE_(
                name,
                s,
                e,
                true,
                s,
                e
              ))) ||
            
          (((abs &&
            UTILS.containsAbsoluteE(
              name,
              s,
              e,
              abs,
              abs_season,
              abs_episode
            )) ||
            (abs &&
              UTILS.containsAbsoluteE_(
                name,
                s,
                e,
                abs,
                abs_season,
                abs_episode
              ))) &&
            !(
              name?.includes("s0") ||
              name?.includes(`s${abs_season}`) ||
              name?.includes("e0") ||
              name?.includes(`e${abs_episode}`) ||
              name?.includes("season")
            )))
      );
    });
    //
    //console.log({index})

    if (index == -1) {
      return null;
    }
    
    console.log({ Name: parsed?.files[index]["name"] });

    title = !!title ? title + "\n" + parsed.files[index]["name"] : null;
  }

  if (media == "movie") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      // console.log({ element: element["name"] });
      return isVideo(element);
    });
    //
    if (index == -1) {
      return null;
    }
  }

  // ========================== RD =============================
  // console.log({ parsed: parsed["name"] });
  // console.log({ magnetUri: parseTorrent.toMagnetURI(parsed) });

  console.log("Trynna some RD");
  let folderId = null;

  let details = [];

  let available = await checkTorrentFileinRD(infoHash);
  // console.log({ available });
  let availableCheck =
    !!available && infoHash in available
      ? "rd" in available[infoHash]
        ? Array.isArray(available[infoHash]["rd"]) &&
          available[infoHash]["rd"].length > 0
        : false
      : false;

  let data = {};

  if (availableCheck || nbreAdded < 3) {
    if (availableCheck) console.log("Cached");
    data = await addTorrentFileinRD(parseTorrent.toMagnetURI(parsed));
    //console.log({data})
    if (!availableCheck) {
      nbreAdded++;
      console.log("Added")
    }
  }

  folderId = "id" in data ? data["id"] : null;
  let added = await selectFilefromRD(folderId);
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
      title: title ?? details[details.length > 1 ? index : 0]["filename"],
      behaviorHints: {
        bingeGroup: `Jackett-Addon|${infoHash}`,
      },
    };
  }

  return null;
};

//====================================================================================

let isRedirect = async (url) => {
  try {
    // console.log({ url });
    const controller = new AbortController();
    // 5 second timeout:
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    // console.log(response.status);
    // console.log(response.headers);

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
      // return response.url;
      return null;
    }
  } catch (error) {
    // console.log({ error });
    return null;
  }
};

const streamFromMagnet = (
  tor,
  uri,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  return new Promise(async (resolve, reject) => {
    //follow redirection cause some http url sent magnet url
    let realUrl = uri?.startsWith("magnet:?") ? uri : await isRedirect(uri);

    realUrl = realUrl ?? null;

    if (realUrl) {
      //console.log({ realUrl });
      if (realUrl?.startsWith("magnet:?")) {
        resolve(
          toStream(
            parseTorrent(realUrl),
            realUrl,
            tor,
            type,
            s,
            e,
            abs_season,
            abs_episode,
            abs
          )
        );
      } else if (realUrl?.startsWith("http")) {
        parseTorrent.remote(realUrl,{ timeout: 1000 * 10 }, (err, parsed) => {
          if (!err) {
            resolve(
              toStream(
                parsed,
                realUrl,
                tor,
                type,
                s,
                e,
                abs_season,
                abs_episode,
                abs
              )
            );
          } else {
            //console.log({err})
            console.log("err parsing http");
            resolve(null);
          }
        });
      } else {
        // console.log("no http nor magnet");
        resolve(realUrl);
      }
    } else {
      // console.log("no real uri");
      resolve(null);
    }
  });
};

let torrent_results = [];
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

  // let url = `${hostdata.host}/api/v2.0/indexers/all/results?apikey=${
  //   hostdata.apiKey
  // }&Query=${query}${
  //   type == "series"
  //     ? "&Category%5B%5D=5000"
  //     : type == "movie"
  //     ? "&Category%5B%5D=2000"
  //     : ""
  // }&Category%5B%5D=8000&Tracker%5B%5D=yggtorrent&cache=false`;

  let url = `${
    hostdata.host
  }/api/v2.0/indexers/torrentscsv/results/torznab/api?apikey=${
    hostdata.apiKey
  }&${type == "movie" ? "t=movie" : "t=tvsearch"}&${
    type == "movie" ? "cat=8000" : "cat=8000"
  }&q=${query}&cache=false`;

  //console.log({ url });

  // return [];

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

        return "rss" in jObj &&
          "channel" in jObj["rss"] &&
          "item" in jObj["rss"]["channel"]
          ? jObj["rss"]["channel"]["item"]
          : [];
      } catch (error) {
        console.log({ error });
        return [];
      }
    })
    .then(async (results) => {
      results = Array.from(results);
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

app
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    var json = {
      id: "hy.jackettka.stream",
      version: "1.0.3",
      name: "Torrents-CSV",
      description: "Movie & TV Streams from Torrents-CSV",
      logo: "data:image/png;base64,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",
      resources: [
        {
          name: "stream",
          types: ["movie", "series"],
          idPrefixes: ["tt", "kitsu"],
        },
      ],
      types: ["movie", "series", "anime", "other"],
      catalogs: [],
    };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    let tmp = [];

    if (
      id in caches &&
      caches[id]?.length &&
      Date.now() < lastCached + 24 * 60 * 60 * 1000
    ) {
      console.log(`Returning results from cache: ${caches[id]?.length} found`);
      return res.send({ streams: caches[id] });
    }

    if (id.includes("kitsu")) {
      tmp = await getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs] = tmp;

    console.log(tmp);

    let meta = await getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    let query = "";
    query = meta?.name;

    let result = [];

    if (media == "movie") {
      query += " " + meta?.year;
      result = await fetchTorrent(encodeURIComponent(query), "movie");
    } else if (media == "series") {
      let promises = [
        fetchTorrent(
          encodeURIComponent(`${query} S${(s ?? "1").padStart(2, "0")}`)
        ),
        fetchTorrent(encodeURIComponent(`${query} Complet`)),
        // fetchTorrent(
        //   encodeURIComponent(`${query} Saison ${(s ?? "1").padStart(2, "0")}`)
        // ),
        fetchTorrent(encodeURIComponent(`${query} Integrale`)),
        fetchTorrent(
          encodeURIComponent(
            `${query} S${s?.padStart(2, "0")}E${e?.padStart(2, "0")}`
          )
        ),
      ];

      if (+s == 1) {
        promises.push(
          fetchTorrent(encodeURIComponent(`${query} ${e?.padStart(2, "0")}`))
        );
        // promises.push(fetchTorrent(encodeURIComponent(`${query}`)));
      }

      if (abs) {
        promises.push(
          fetchTorrent(
            encodeURIComponent(`${query} E${abs_episode?.padStart(3, "0")}`)
          )
        );
      }

      // console.log(`Check si s==1: ${+s == 1}`);

      result = await Promise.all(promises);

      // console.log(`Taille ${result?.length ?? 0}`);

      result = [
        ...result[0],
        ...result[1],
        ...result[2],
        ...result[3],
        // ...result[4],
        // ...(result?.length >= 4 ? result[3] : []),
        ...(result?.length >= 5 ? result[4] : []),
        ...(result?.length >= 6 ? result[5] : []),
        // ...(result?.length >= 7 ? result[6] : []),
      ];
    }

    // ------------------------------- FOR RANGE THINGS ---------------------------------------------

    let matches = [];

    for (const key in result) {
      const element = result[key];

      let r = new RegExp(REGEX.season_range, "gmi");
      let match = r.exec(element["Title"]);
      if (match && match["groups"] != null) {
        if (
          ![match["groups"]["start"], match["groups"]["end"]].includes(
            meta?.year
          )
        ) {
          if (s > +match["groups"]["start"] && s <= +match["groups"]["end"]) {
            matches.push(result[key]);
            result.splice(key, 1);
            continue;
          }
        }
      }

      r = new RegExp(REGEX.ep_range, "gmi");
      match = r.exec(element["Title"]);

      if (match && match["groups"] != null) {
        if (
          ![match["groups"]["start"], match["groups"]["end"]].includes(
            meta?.year
          )
        ) {
          if (
            abs_episode > +match["groups"]["start"] &&
            abs_episode <= +match["groups"]["end"]
          ) {
            matches.push(result[key]);
            result.splice(key, 1);
          }
        }
      }
    }
    result = [...matches, ...result];
    result = removeDuplicate(result, "Title");
    result.sort((a, b) => {
      return -(+a["Peers"] - +b["Peers"]) ?? 0;
    });

    console.log({ Retenus: result.length });

    const MAX_RES = process.env.MAX_RES ?? 20;
    result = result?.length >= MAX_RES ? result.splice(0, MAX_RES) : result;

    // ----------------------------------------------------------------------------

    let stream_results = await Promise.all(
      result.map((torrent) => {
        if (
          (torrent["MagnetUri"] != "" || torrent["Link"] != "") &&
          torrent["Peers"] >= 1
        ) {
          console.log(`${torrent["Title"]} ==> ${torrent["Peers"]}`);
          return streamFromMagnet(
            torrent,
            torrent["MagnetUri"] || torrent["Link"],
            media,
            s,
            e,
            abs_season,
            abs_episode,
            abs
          );
        }
      })
    );

    stream_results = Array.from(new Set(stream_results)).filter((e) => !!e);

    if (stream_results.length) {
      caches[id] = stream_results;
      lastCached = Date.now();
    }

    console.log({ Final: stream_results.length });

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 3001, () => {
    console.log("The server is working on " + process.env.PORT || 3001);
  });

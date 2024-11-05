require("dotenv").config();
var torrentStream = require("torrent-stream");
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
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
    (name?.includes(`s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`) ||
    name?.includes(`s${s?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`) ||
    name?.includes(`s${s?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`) ||
    name?.includes(`s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`) ||
    name?.includes(`s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(4, "0")}`)));

let containE_S = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(`s${s?.padStart(2, "0")} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`season ${s} - ${e?.padStart(2, "0")}`);

let containsAbsoluteE = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(` ${abs_episode?.padStart(2, "0")} `) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")} `) ||
  name?.includes(` 0${abs_episode} `) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")} `);

let containsAbsoluteE_ = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(` ${abs_episode?.padStart(2, "0")}.`) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")}.`) ||
  name?.includes(` 0${abs_episode}.`) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")}.`);

let hosts = [];

const raw_content = require("fs").readFileSync("./servers.txt");
let content = Buffer.isBuffer(raw_content) ? raw_content.toString() : raw_content;
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
        torrent_results = await Promise.all(
          results.map((result) => {
            let torznab_attr = {};
            result["torznab:attr"]?.length
              ? result["torznab:attr"]?.forEach((el) => {
                  torznab_attr[el["@_name"]] = el["@_value"];
                })
              : false;
            return new Promise((resolve) => {
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
    .catch(() => {
      return [];
    });
};

let fetchTorrent2 = async (query, type = "series") => {
  let hostdata = hosts[Math.floor(Math.random() * hosts.length)];
  if (!hostdata) return [];

  let url = `${hostdata.host}/api/v2.0/indexers/all/results?apikey=${hostdata.apiKey}&Query=${query}&Tracker%5B%5D=iptorrents&Category%5B%5D=2000&Category%5B%5D=5000&Category%5B%5D=3000&Category%5B%5D=7000&Category%5B%5D=4000`;

  return await fetch(url, {
    method: "GET",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
    },
  })
    .then(async (res) => {
      let json = await res.json();
      let results = Array.isArray(json) ? json : [json];
      console.log({ Initial: results?.length });
      if (results.length != 0) {
        torrent_results = await Promise.all(
          results.map((result) => {
            return new Promise((resolve) => {
              resolve({
                Title: result.title,
                Link: result.link,
                Seeders: result.seeds,
                Peers: result.leechers,
                MagnetUri: result.magnetUri,
                Tracker: result.tracker,
              });
            });
          })
        );
        return torrent_results;
      } else {
        return [];
      }
    })
    .catch(() => {
      return [];
    });
};

let findSeriesEpisodeInTorrents = async (name, s, e) => {
  let episode = e.toString().padStart(2, "0");
  let season = s.toString().padStart(2, "0");
  let torrents = await fetchTorrent(name, "series");
  let result = torrents.filter((el) => {
    return containEandS(el.Title, s, e) || containE_S(el.Title, s, e);
  });
  console.log("total result found", result.length);
  return result.length > 0 ? result : await fetchTorrent2(name, "series");
};

app.get("/fetch", async (req, res) => {
  const { query } = req.query;
  let torrents = await fetchTorrent(query);
  res.json(torrents);
});

app.get("/fetch2", async (req, res) => {
  const { query } = req.query;
  let torrents = await fetchTorrent2(query);
  res.json(torrents);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running on port", process.env.PORT || 3000);
});

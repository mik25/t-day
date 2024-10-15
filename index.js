const path = require("path");
const serversFilePath = path.resolve(__dirname, "./servers.txt");
require("dotenv").config();
const express = require("express");
const app = express();
const { removeDuplicate } = require("./helper");
const UTILS = require("./utils");
const config = require("./config");
const redisClient = require("./redis");

const REGEX = {
  season_range:
    /S(?:(eason )|(easons )|(eason )|(easons )|(aisons )|(aison ))?(?<start>\d{1,2})\s*?(?:-|&|à|et)\s*?(?<end>\d{1,2})/, //start and end Sxx-xx|Season(s) xx-xx|Sxx à xx
  ep_range: /((?:e)|(?:ep))?(?: )?(?<start>\d{1,4})\s?(-|~)\s?(?<end>\d{1,4})/, //xxx-xxx
  ep_rangewithS:
    /((?:e)|(?:pisode))\s*(?<start>\d{1,3}(?!\d)|\d\d\d??)(?:-?e?(?<end>\d{1,3}))?(?!\d)/, //Exxx-xxx
};

const redis = redisClient();

// ----------------------------------------------
app.get("/", (req, res) => {
  return res.status(200).send("okok");
});

app
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    var json = { ...config };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    try {
      await redis.connect();
      let ping = await redis.ping();
      console.log({ ping });
    } catch (error) {}

    //

    let media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    console.log({ media });
    console.log({ id });

    try {
      let stream_cached = await redis.json.get(config.id + "|" + id);
      if (!!stream_cached) {
        console.log(
          `Returning results from cache: ${stream_cached?.length} found`
        );
        await redis.disconnect();
        return res.send({ streams: stream_cached });
      }
    } catch (error) {
      console.log(`Failed to get ${id} from cache`);
    }

    let tmp = [];

    if (id.includes("kitsu")) {
      tmp = await UTILS.getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs] = tmp;

    console.log(tmp);

    let meta = await UTILS.getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    let query = "";
    query = meta?.name ?? "";

    let result = [];

    query = query.replace(/['<>:]/g, "");

    if (media == "movie") {
      query += " " + meta?.year;
      result = await UTILS.fetchTorrent2(encodeURIComponent(query), "movie");
    } else if (media == "series") {
      let promises = [
        UTILS.fetchTorrent2(
          encodeURIComponent(
            `${UTILS.simplifiedName(query)} S${(s ?? "1").padStart(2, "0")}`
          )
        ),
        UTILS.fetchTorrent2(
          encodeURIComponent(
            `${UTILS.simplifiedName(query)} Season ${s ?? "1"}`
          )
        ),
        UTILS.fetchTorrent2(
          encodeURIComponent(`${UTILS.simplifiedName(query)} Complet`)
        ),
        UTILS.fetchTorrent2(
          encodeURIComponent(
            `${UTILS.simplifiedName(query)} S${s?.padStart(
              2,
              "0"
            )}E${e?.padStart(2, "0")}`
          )
        ),
      ];

      if (+s == 1) {
        promises.push(
          UTILS.fetchTorrent2(
            encodeURIComponent(
              `${UTILS.simplifiedName(query)} ${e?.padStart(2, "0")}`
            )
          )
        );
      }

      if (abs) {
        promises.push(
          UTILS.fetchTorrent2(
            encodeURIComponent(
              `${UTILS.simplifiedName(query)} ${abs_episode?.padStart(2, "0")}`
            )
          )
        );
        promises.push(
          UTILS.fetchTorrent2(
            encodeURIComponent(
              `${UTILS.simplifiedName(query)} ${abs_episode?.padStart(3, "0")}`
            )
          )
        );
      }

      result = await Promise.all(promises);

      result = result.reduce((resArr, curr) => {
        if (curr) {
          resArr = [...resArr, ...curr];
        }
        return resArr;
      }, []);
    }

    result = removeDuplicate(result, "Title");

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
          if (s >= +match["groups"]["start"] && s <= +match["groups"]["end"]) {
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
            abs_episode >= +match["groups"]["start"] &&
            abs_episode <= +match["groups"]["end"]
          ) {
            matches.push(result[key]);
            result.splice(key, 1);
          }
        }
      }
    }

    console.log({ matches: matches.map((el) => el["Title"]) });

    result = [...matches, ...result];
    result.sort((a, b) => {
      return -(+a["Peers"] - +b["Peers"]) ?? 0;
    });

    console.log({ "Retenus for filtering": result.length });

    const MAX_RES = process.env.MAX_RES ?? 20;
    result = result?.length >= MAX_RES ? result.splice(0, MAX_RES) : result;

    // ----------------------------------------------------------------------------

    result = (result ?? []).filter(
      (torrent) =>
        (torrent["MagnetUri"] != "" || torrent["Link"] != "") &&
        torrent["Peers"] >= 0
    );

    console.log({ "Result after removing low peers items": result.length });

    let torrentParsed = await Promise.all(
      result.map((torrent) =>
        UTILS.getParsedFromMagnetorTorrentFile(
          torrent,
          torrent["MagnetUri"] || torrent["Link"]
        )
      )
    );
    console.log({
      "After parsing (non parsed included)": torrentParsed.length,
    });

    // engine ? engine.destroy() : null;

    torrentParsed = torrentParsed.filter(
      (torrent) =>
        torrent &&
        torrent?.parsedTor != null &&
        torrent?.parsedTor?.files?.length > 0
    );

    console.log({ "Parsed torrents": torrentParsed.length });

    let stream_results = await Promise.all(
      torrentParsed.map((torrent) =>
        UTILS.toStream(
          torrent,
          media,
          s,
          e,
          abs_season,
          abs_episode,
          abs,
          torrentParsed.length
        )
      )
    );

    stream_results = Array.from(new Set(stream_results)).filter((e) => !!e);

    stream_results = [
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities["4k"]),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.fhd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.hd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.sd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.unknown),
    ];

    nbreAdded = 0;

    if (stream_results.length != 0) {
      try {
        let cache_ok = await redis.json.set(
          `${config.id}|${id}`,
          "$",
          stream_results
        );
        if (cache_ok) {
          await redis.expireAt(
            `${config.id}|${id}`,
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
          );
        }
        console.log({ cache_ok });
      } catch (error) {
        console.log("Failed to cache " + id.toString() + ": ", error);
      }
    }
    console.log({ Final: stream_results.length });
    await redis.disconnect();

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });

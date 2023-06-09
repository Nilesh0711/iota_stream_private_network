const streams = require("@iota/streams-wasm/node/streams_wasm");
const crypto = require("crypto");
const fs = require("fs");
const csv = require("csv-parser");
const process = require("process");
const { fetchDDQN } = require("./readDDQN.js");

streams.set_panic_hook();

const toBytes = (str) => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; ++i) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
};

const makeSeed = (size) => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let seed = "";
  for (let i = 9; i < size; i++) {
    seed += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return seed;
};

const runDDQN = async () => {
  try {
    for (let index = 1; index <= 1; index++) {
      console.log("Setting up node...");
      let node = "http://localhost:14265";
      let builder = new streams.ClientBuilder();
      let client = await builder.node(node).build();
      let authSeed = makeSeed(81);
      const filePath = "./CSV/ddqn.csv";

      console.log("Creating preShared key..");

      const presharedkey = crypto.randomBytes(16).toString("hex");

      console.log("presharedkey: " + presharedkey);

      let auth = streams.Author.fromClient(
        streams.StreamsClient.fromClient(client),
        authSeed,
        streams.ChannelType.SingleBranch
      );
      console.log("Author seed: " + authSeed);
      console.log("Send Announce by author..");

      let response = await auth.clone().send_announce();
      let ann_link = response.link;
      console.log("announced at: ", ann_link.copy().toString());

      fs.appendFileSync(
        "channel_details_DDQN.txt",
        "\npresharedkey: " +
          presharedkey +
          "\nannounced at: " +
          ann_link.copy().toString()
      );
      let id = auth.store_psk(presharedkey);

      console.log("Creating stream public key...");

      const keys_a = new streams.PublicKeys();
      let ids = streams.PskIds.new();
      ids.add(id);

      console.log("Send keyload by author...");

      const res = await auth.clone().send_keyload(ann_link.copy(), ids, keys_a);
      const keyloadLink_a = res?.link;
      console.log("Sending signed data packet..");
      let lastlink = null;
      response = await auth.clone().send_signed_packet(
        keyloadLink_a.copy(),
        toBytes("Payload_DDQN"),
        toBytes(
          JSON.stringify({
            episode: "0",
            learning_rate_0_1: "0",
            learning_rate_0_0_1: "0",
            learning_rate_0_0_0_1: "0",
          })
        )
      );
      lastlink = response.link;

      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      const stream = fs.createReadStream(filePath);
      for await (const row of stream.pipe(csv())) {
        const data = {
          episode: row["episode"],
          learningRate_0_1: row["learning_rate_0.1"],
          learningRate_0_0_1: row["learning_rate_0.01"],
          learningRate_0_0_0_1: row["learning_rate_0.001"],
        };
        try {
          lastlink = await sendToIOTA(data, lastlink, auth);
        } catch (error) {
          console.error("Failed to process row:", error);
        }
      }
      // TIME
      const endTime = process.hrtime(startTime);
      const elapsedTimeInSeconds = endTime[0] + endTime[1] / 1e9;
      fs.appendFileSync(
        "attach_ddqn.txt",
        "\n" + elapsedTimeInSeconds.toFixed(2)
      );

      // CPU
      const endUsage = process.cpuUsage(startUsage);
      const cpuUtilization =
        ((endUsage.user + endUsage.system) / (endTime[0] * 1e9 + endTime[1])) *
        100;
      fs.appendFileSync("cpu_ddqn.txt", "\n" + cpuUtilization.toFixed(4));

      // MEM
      const memoryUsage = process.memoryUsage().heapUsed;
      const memoryUtilization = memoryUsage / 1024; // Convert bytes to KB
      fs.appendFileSync("mem_ddqn.txt", "\n" + memoryUtilization.toFixed(2));

      await fetchDDQN(presharedkey, ann_link.copy().toString());

      console.log(`Loop number ${index} is completed`);
    }
  } catch (e) {
    console.log("error:", e);
  }
};

async function sendToIOTA(data, lastlink, auth) {
  return new Promise(async (resolve, reject) => {
    console.log(data);
    try {
      let res = await auth
        .clone()
        .send_signed_packet(
          lastlink,
          toBytes("Payload_DDQN"),
          toBytes(JSON.stringify(data))
        );
      resolve(res.link);
    } catch (error) {
      console.log("Failed to sendToIOTA: " + error);
      reject(lastlink);
    }
  });
}

runDDQN().then(() => console.log("Happy Coding! :)"));

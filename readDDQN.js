const streams = require("@iota/streams-wasm/node/streams_wasm");
// const crypto = require("crypto");
const fs = require("fs");

streams.set_panic_hook();



exports.fetchDDQN = async (_presharedkey, _announce) => {
  return new Promise(async (resolve, reject) => {

    const fetchMessages = async (subscription) => {
      try {
        let foundNewMessage = true;
        let streamsMessages = [];
    
        while (foundNewMessage) {
          let nextMessages = [];
    
          nextMessages = await subscription.clone().fetch_next_msgs();
    
          if (!nextMessages || nextMessages.length === 0) {
            foundNewMessage = false;
          }
    
          if (nextMessages && nextMessages.length > 0) {
            const cData = await Promise.all(
              nextMessages.map(async (messageResponse) => {
                const address = messageResponse?.link;
                const link = address?.copy()?.toString();
                const message = messageResponse.message;
                const publicPayload =
                  message && fromBytes(message.get_public_payload());
                const maskedPayload =
                  message && fromBytes(message.get_masked_payload());
    
                try {
                  if (!publicPayload && !maskedPayload) {
                    return null;
                  }
    
                  return {
                    link,
                    publicPayload: publicPayload,
                    maskedPayload: JSON.parse(maskedPayload),
                  };
                } catch (e) {
                  console.log("e", e);
    
                  return null;
                }
              })
            );
            streamsMessages = [...streamsMessages, ...cData];
          }
        }
    
        return streamsMessages.filter((m) => m);
      } catch (error) {
        console.log("error:", error);
      }
    };
    
    const fromBytes = (bytes) => {
      let str = "";
      for (let i = 0; i < bytes.length; ++i) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    };

    try {
      let announceLink = _announce;
      let presharedkey = _presharedkey;
      let subSeed =
        "nshygbvgtmxtgrnaxnypctzaszhgjqdodihktyzmpyghzhkdqlieegypidctbxvpvxxyoacy";
      let node = "http://127.0.0.1:14265";

      // create subscriber using preshared key
      let builder2 = new streams.ClientBuilder();
      let client2 = await builder2.node(node).build();

      console.log("Creating subscriber...");
      // console.log("Subscriber seed: " + subSeed);

      let subscriber_a = streams.Subscriber.fromClient(
        streams.StreamsClient.fromClient(client2),
        // makeSeed(81)
        subSeed
      );

      let ann_link = streams.Address.parse(announceLink);

      await subscriber_a.clone().receive_announcement(ann_link.copy());
      await subscriber_a.clone().store_psk(presharedkey);

      // -----------------------------------------------------------------------------
      // -----------------------------------------------------------------------------
      // Subscriber A can now fetch these messages from the Author
      console.log("Fetching message...");
      let data = [];
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      const m = await fetchMessages(subscriber_a.clone());
      m.forEach((element) => {
        let payload = {
          publicPayload: element.publicPayload,
          maskedPayload: element.maskedPayload,
        };
        data.push(payload);
      });

      // TIME
      const endTime = process.hrtime(startTime);
      const elapsedTimeInSeconds = endTime[0] + endTime[1] / 1e9;
      fs.appendFileSync(
        "fetch_ddqn.txt",
        "\n" + elapsedTimeInSeconds.toFixed(2)
      );
      // fs.writeFileSync("output_DQN.json", JSON.stringify(data));
      resolve();
    } catch (e) {
      console.log("error:", e);
      reject();
    }
  });
};
// fetchDQN().then(() => console.log("Happy Coding :)"));

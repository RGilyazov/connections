import fs from "fs";
import * as Redis from "redisgraph.js";
import commandLineArgs from "command-line-args";

function printHelpString() {
  console.log(
    "to find connection between two users run program with params [--user1=<user1 name> --user2=<user2 name>] for example 'node index.js --user1=1 --user2=1_1_1'"
  );
}

const optionDefinitions = [
  { name: "user1", type: String },
  { name: "user2", type: String },
];

let options = {};
try {
  options = commandLineArgs(optionDefinitions);
} catch (err) {
  printHelpString();
  process.exit(0);
}
const RedisGraph = Redis.Graph;

let DATA = {};
try {
  const DATA_STRING = fs.readFileSync("./data.json");
  DATA = JSON.parse(DATA_STRING);
} catch (err) {
  console.log("error reading data");
  process.exit(0);
}
let graph = new RedisGraph("connections");

try {
  (async () => {
    //populating database
    //users
    for (let user of DATA.users) {
      await graph.query(`CREATE (:person{name:'${user.name}'})`);
    }
    //connections
    for (let connection of DATA.connections) {
      await graph.query(
        `MATCH (a:person), (b:person) WHERE (a.name = '${connection.user1}' AND b.name='${connection.user2}') CREATE (a)-[:connects]->(b)`
      );
    }

    if (options.user1 && options.user2) {
      if (options.user1 === options.user2) {
        console.log("please select different users");
      } else {
        //query shortest path length
        let param = { name1: options.user1, name2: options.user2 };
        let res = await graph.query(
          `MATCH (user1:person {name: $name1}), (user2:person {name: $name2}) RETURN length(shortestPath((user1)-[:connects*1..3]->(user2))) as nodesCount`,
          param
        );
        while (res.hasNext()) {
          const record = res.next();
          const nodeCount = record.get("nodesCount");
          console.log(
            nodeCount
              ? `users connected to each other in ${nodeCount} steep(s)`
              : "users do not connected to each other"
          );
        }
      }
    } else {
      printHelpString();
      console.log("list of users:");
      //print list of users
      let res = await graph.query(
        `MATCH (user:person) RETURN user.name as user`
      );
      while (res.hasNext()) {
        let record = res.next();
        console.log(record.get("user"));
      }
    }
    graph.deleteGraph();
    graph.close();
  })();
} catch (err) {
  console.log(err);
  graph.deleteGraph();
  graph.close();
}

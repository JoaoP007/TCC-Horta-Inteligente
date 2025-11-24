const http = require("http");
const RED = require("node-red");

const server = http.createServer();

const settings = {
  uiPort: process.env.PORT || 1880,
  httpAdminRoot: "/",
  httpNodeRoot: "/node",
  functionGlobalContext: {}
};

RED.init(server, settings);

server.listen(settings.uiPort);

RED.start();

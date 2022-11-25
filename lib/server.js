const iconv = require("iconv-lite");
const scripts = require("./scripts");
const setupWsServer = require("./wsServer");
const util = require("./util");
const Mock = require("mockjs");
const raw = require("raw-body");
const qs = require("qs");
const nilV = (o) => {
  return typeof o === "undefined" || o === null;
};
async function getRequestBody(req) {
  let { headers, method } = req || {};
  if (nilV(method) || nilV(headers)) {
    return {};
  }
  if (method.toLowerCase() !== "post") {
    return {};
  }
  let bodyStr;
  try {
    bodyStr = await raw(req, { encoding: "utf-8" });
  } catch (error) {
    console.log("出错了, ", error);
    return {};
  }
  let body = {};
  body._rawString = bodyStr;
  let contentType = headers["content-type"] || headers["CONTENT-TYPE"];
  if (nilV(contentType)) {
    contentType = "text/plain";
  }
  let bodyObj = {};
  if (contentType.indexOf("urlencoded") !== -1) {
    bodyObj = qs.parse(bodyStr, {
      allowPrototypes: true,
      arrayLimit: 100,
      depth: Infinity,
      parameterLimit: 1000,
    });
  } else if (contentType.indexOf("json") !== -1) {
    try {
      bodyObj = JSON.parse(bodyStr);
    } catch (error) {}
  }
  Object.assign(body, bodyObj);
  return body;
}

module.exports = (server, options) => {
  server.on("request", async (req, res) => {
    if (util.isRemote(req)) {
      return req.passThrough();
    }
    const ctx = util.getContext(req, res);

    ctx.mock = Mock.mock;
    ctx.random = Mock.Random;
    ctx.getStreamBuffer = util.getStreamBuffer;
    ctx.getCharset = util.getCharset;
    ctx.isText = util.isText;
    ctx.iconv = iconv;
    ctx.options = options;
    const { handleRequest } = scripts.getHandler(ctx);
    if (!util.isFunction(handleRequest)) {
      return req.passThrough();
    }
    const { dataSource, clearup } = util.getDataSource();
    ctx.dataSource = dataSource;
    try {
      // 解析 body
      let body = await getRequestBody(ctx.req);
      req.body = body;
      await handleRequest(ctx, req.request);
    } catch (err) {
      clearup();
      req.emit("error", err);
      console.error(err); // eslint-disable-line
    }
  });
  setupWsServer(server, options);
};

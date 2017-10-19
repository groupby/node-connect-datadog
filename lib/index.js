const DD  = require("node-dogstatsd").StatsD;
const _   = require('lodash');
const url = require('url');

module.exports = function (options) {
  const datadog       = options.dogstatsd || new DD();
  const stat          = options.stat || "node.express.router";
  const tags          = options.tags || [];
  const path          = options.path || false;
  const req_tags      = options.req_tags || null;
  const res_tags      = options.res_tags || null;
  const response_code = options.response_code || false;

  return function (req, res, next) {
		if (!req._startTime) {
			req._startTime = new Date();
		}

    const responseFinished = (connectionStatus) => () => {
      let statTags = [].concat(tags);

      if (typeof req_tags === 'function') {
        const reqTagValues = req_tags(req);

        if (!_.isArray(reqTagValues) || !_.every(reqTagValues, (value) => _.isString(value))) {
          console.log('req_tags did not return array of strings');
        } else {
          statTags = statTags.concat(reqTagValues);
        }
      }

      if (typeof res_tags === 'function') {
        const resTagValues = res_tags(res);

        if (!_.isArray(resTagValues) || !_.every(resTagValues, (value) => _.isString(value))) {
          console.log('res_tags did not return array of strings');
        } else {
          statTags = statTags.concat(resTagValues);
        }
      }

      if (options.method) {
        statTags.push("method:" + req.method.toLowerCase());
      }

      if (options.protocol && req.protocol) {
        statTags.push("protocol:" + req.protocol);
      }

      if (path !== false) {
        const thisUrl = (req.baseUrl || '') + (req.url);
        const path    = url.parse(thisUrl).pathname;
        statTags.push("path:" + path);
      }

      if (connectionStatus === 'close') {
        statTags.push("status:terminated");
      }

      if (response_code) {
        statTags.push("response_code:" + res.statusCode);
        datadog.increment(stat + '.response_code.' + res.statusCode, 1, statTags);
        datadog.increment(stat + '.response_code.all', 1, statTags);

        if (res.statusCode > 399) {
          datadog.increment(stat + '.response_code.error', 1, statTags);
        }
      }

			datadog.histogram(stat + '.response_time', (new Date() - req._startTime), 1, statTags);
    };

    res.on('finish', responseFinished('finish'));
    res.on('close', responseFinished('close'));

    next();
  };
};

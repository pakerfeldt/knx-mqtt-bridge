const yaml = require('js-yaml');
const fs   = require('fs');

exports.parse = function () {
    const file = './config.yaml';
    if (fs.existsSync(file)) {
        try {
          return yaml.safeLoad(fs.readFileSync(file, 'utf8'));
        } catch (e) {
          console.log(e);
          process.exit();
        }
    } else {
        return {
            loglevel: 'info',
            quickInspect: false,
            knx: {},
            mqtt: {
                url: 'mqtt://localhost',
                topicPrefix: 'knx'
            }
        }
    }
}

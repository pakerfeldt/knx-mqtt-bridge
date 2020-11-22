const yaml = require('js-yaml');
const fs   = require('fs');

exports.parse = function () {
    const file = process.env.KNX_MQTT_CONFIG || 'config.yaml';
    if (fs.existsSync(file)) {
        try {
          let config =  yaml.safeLoad(fs.readFileSync(file, 'utf8'));
          
          if (config.mqtt.options.key) config.mqtt.options.key = fs.readFileSync( config.mqtt.options.key );
          if (config.mqtt.options.cert) config.mqtt.options.cert = fs.readFileSync( config.mqtt.options.cert );
          if (config.mqtt.options.ca) config.mqtt.options.ca = fs.readFileSync( config.mqtt.options.ca );
          
          return config
        } catch (e) {
          console.log(e);
          process.exit();
        }
    } else {
        return {
            loglevel: 'info',
            knx: {
                etsExport: 'knx.xml'
            },
            mqtt: {
                url: 'mqtt://localhost',
                topicPrefix: 'knx',
                retain: false
            }
        }
    }
}

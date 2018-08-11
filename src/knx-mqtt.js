#!/usr/bin/env node
'use strict'

const c = require('./constants.js');
const knx = require('knx');
const mqtt = require('mqtt');
const { createLogger, format, transports } = require('winston');
const ets = require('./ets-xml');
const config = require('./config.js').parse();
const topicPrefix = config.mqtt.topicPrefix + (config.mqtt.topicPrefix.endsWith('/') ? '' : '/');
const gadRegExp = new RegExp((topicPrefix || 'knx/') + '(\\d+)\/(\\d+)\/(\\d+)\/(\\w+)(\/([\\w\\d]+))?');
const logger = createLogger({
  level: config.loglevel,
  format: format.combine(
    format.colorize(),
    format.splat(),
    format.simple(),
  ),
  transports: [new transports.Console()]

  //transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    //new winston.transports.File({ filename: 'error.log', level: 'error' }),
    //new winston.transports.File({ filename: 'combined.log' })
    //new winston.transports.Console({ format: winston.format.simple() })
  //]
});
const messageType = require('./messagetype.js').parse(config.messageType, logger);

let groupAddresses = ets.parse(config.knx.etsExport, logger) || {};

let mqttClient  = mqtt.connect(config.mqtt.url, config.mqtt.options);

mqttClient.on('connect', function () {
  logger.info('MQTT connected');
  mqttClient.subscribe(topicPrefix + '+/+/+/+');
  mqttClient.subscribe(topicPrefix + '+/+/+/+/+');
});

mqttClient.on('message', function (topic, message) {
    logger.silly('Received MQTT message on topic %s with value %s', topic, message);
    let gadArray = gadRegExp.exec(topic);
    let gad = gadArray[1] + "/" + gadArray[2] + "/" + gadArray[3];
    let command = gadArray[4];
    let dpt = gadArray.length >= 7 ? gadArray[6] : undefined;
    let parsedMessage;
    try {
        parsedMessage = message === undefined ? null : JSON.parse(message.toString('utf8'));
    } catch (err) {
        parsedMessage = null;
    }
    let isBuffer = parsedMessage !== null && typeof parsedMessage === 'object';
    logger.verbose('Parsed MQTT message into gad %s with command %s, value %j and dpt %s', gad, command, parsedMessage, dpt);
    if (command === 'write' && isBuffer) {
        let bitLength = getBitLength(dpt);
        let bufferMessage;
        try {
            bufferMessage = Buffer.from(parsedMessage.data);
            knxConnection.writeRaw(gad, bufferMessage, bitLength);
        } catch (err) {
            logger.error('Could not parse buffer %j', parsedMessage);
        }
    } else if (command === 'write' && !isBuffer) {
        if (groupAddresses.hasOwnProperty(gad)) {
            try {
                groupAddresses[gad].endpoint.write(parsedMessage);
            } catch (err) {
                logger.error('Could not write message %j to group address %s, err: %s', parsedMessage, gad, err);
            }
        } else {
            logger.error('Cannot write non-buffer value do an unknown group address %s. Don\'t know how to convert', gad);
        }
    } else if (command === 'read') {
        if (groupAddresses.hasOwnProperty(gad)) {
            groupAddresses[gad].endpoint.read();
        } else {
            knxConnection.read(gad);
        }
    } else {
        logger.warn('Unknown KNX command %s', command);
    }
});

let onKnxEvent = function (evt, dst, value, gad) {
    logger.silly("onKnxEvent %s, %s, %j", evt, dst, value);
    if (evt !== 'GroupValue_Write' && evt !== 'GroupValue_Response') {
        return;
    }

    let isResponse = evt === 'GroupValue_Response';
    let mqttMessage = value;
    if (messageType === c.MESSAGE_TYPE_VALUE_ONLY) {
        mqttMessage = !Buffer.isBuffer(value) ? "" + value : value
    } else if (messageType === c.MESSAGE_TYPE_FULL) {
        let mqttObject = {
            value: !Buffer.isBuffer(value) ? "" + value : value
        }
        if (gad !== undefined) {
            mqttObject.name = gad.name;
            mqttObject.unit = gad.unit;
        }
        if (isResponse) {
            mqttObject.response = true;
        }
        mqttMessage = JSON.stringify(mqttObject);
    } else {
        logger.error('Configured message type unknown. This should never happen and indicates a bug in the software.');
        return;
    }

    logger.verbose("%s **** KNX EVENT: %s, dst: %s, value: %j",
      new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
      evt, dst, mqttMessage);

    mqttClient.publish(topicPrefix + dst, mqttMessage);
}

let knxConnection = knx.Connection(Object.assign({
    handlers: {
     connected: function() {
       logger.info('KNX connected');
        for (let key in groupAddresses) {
           if (groupAddresses.hasOwnProperty(key)) {
               let endpoint = new knx.Datapoint({ga: key, dpt: groupAddresses[key].dpt}, knxConnection);
               groupAddresses[key].endpoint = endpoint;
               groupAddresses[key].unit = endpoint.dpt.subtype !== undefined ? endpoint.dpt.subtype.unit || '' : '';
               groupAddresses[key].endpoint.on('event', function(evt, value) {
                   onKnxEvent(evt, key, value, groupAddresses[key]);
               });
           }
        }
      },
      event: function (evt, src, dst, value) {
          if (!(config.ignoreUnknownGroupAddresses || groupAddresses.hasOwnProperty(dst))) {
              onKnxEvent(evt, dst, value);
          }
      }
  }}, config.knx.options));

  let getBitLength = function(dpt) {
      if (dpt === 'dpt1') {
          return 1;
      } else if (dpt === 'dpt2') {
          return 2;
      } else if (dpt === 'dpt3') {
          return 4;
      } else {
          return undefined;
      }
  }

FROM node:10

RUN npm install -g knx-mqtt-bridge
ADD https://raw.githubusercontent.com/pakerfeldt/knx-mqtt-bridge/master/config.example.yaml /config/config.yaml
ENV KNX_MQTT_CONFIG=/config/config.yaml
VOLUME /config
CMD knx-mqtt-bridge

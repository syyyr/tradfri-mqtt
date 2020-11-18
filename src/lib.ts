import MQTT from "async-mqtt";
type MQTTVars = {
    "friendly-name": string;
    "broker-address": string;
    client?: MQTT.AsyncMqttClient;
};

type LightState = {
    brightness: number;
    state: "on" | "off" | "toggle";
    warmth: number;
}

type SendInput = MQTTVars & LightState;

const getConnection = (input: MQTTVars) => {
    return MQTT.connectAsync(`tcp://${input["broker-address"]}`);
}

const getClient = async (input: MQTTVars) => {
    if (typeof input.client === "undefined") {
        input.client = await getConnection(input);
    }
    return input.client;
};

const send = async (input: SendInput) => {
    if (input.brightness > 254 || input.brightness < 0) {
        console.error("Brightness must be within 0 and 254");
        process.exit(1);
    }
    const client = await getClient(input);
    const message = {
        brightness: input.brightness,
        state: input.state,
        color_temp: input.warmth
    };
    await client.publish(`zigbee2mqtt/${input["friendly-name"]}/set`, JSON.stringify(message));
    await client.end();
}

export {MQTTVars};

export default {
    send
};
